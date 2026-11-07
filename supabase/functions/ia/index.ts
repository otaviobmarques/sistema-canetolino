// Canetolino · função de servidor da IA (seção 7 do descritivo técnico)
// - refeicao_foto / refeicao_texto: a IA só identifica alimentos, preparo e porção;
//   os nutrientes vêm SEMPRE da tabela `foods` (TACO/TBCA). Nada é gravado aqui.
// - resumo_semanal: texto curto do Dose a partir de indicadores agregados (sem nome,
//   e-mail ou documento), com filtro que bloqueia dose, diagnóstico e causalidade.
// O app nunca fala direto com a Anthropic: a chave fica só no servidor (segredo ou tabela `segredos`).
import Anthropic from 'npm:@anthropic-ai/sdk@1.6.0'
import { createClient } from 'npm:@supabase/supabase-js@2.119.0'

const MODELO = 'claude-haiku-5-5' // rápido e barato; sem recuperação automática no servidor, o app cai para a busca manual
const VERSAO_PROMPT = 'ia-v2'
const COTA_BASICO = 30 // refeições por IA por mês no plano Básico

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}
const json = (corpo: unknown, status = 200) =>
  new Response(JSON.stringify(corpo), { status, headers: { ...CORS, 'Content-Type': 'application/json' } })

type Food = { id: string; nome: string; fonte: string; versao_tabela: string; proteina_100g: number; energia_100g: number }

/* ---------------- prompts (fixos, para o cache funcionar) ---------------- */
const SISTEMA_REFEICAO = `Você identifica alimentos em refeições brasileiras para o app Canetolino, um diário de quem faz tratamento com canetas (tirzepatida, semaglutida, liraglutida).

Sua tarefa é só reconhecer o que está no prato ou na descrição: o nome do alimento, o preparo e uma porção estimada em gramas. Não calcule nutrientes, calorias ou proteína: o app busca esses valores em tabelas nutricionais oficiais (TACO, TBCA, POF/IBGE).

Para cada alimento:
- nome: nome em português do Brasil, como uma pessoa diria (ex.: "Peito de frango grelhado").
- busca: de 1 a 3 palavras para procurar o alimento numa tabela nutricional brasileira, da mais importante para a menos importante, sem acento (ex.: "frango peito grelhado", "feijao carioca cozido", "arroz cozido", "ovo frito").
- preparo: grelhado, cozido, frito, cru, assado etc.
- porcao_g: estimativa em gramas da porção servida.
- porcao_texto: a porção em medida caseira (ex.: "1 concha (86 g)", "3 colheres (75 g)").
- confianca: de 0 a 1, o quanto você tem certeza do alimento e da porção.

Separe pratos compostos nos seus alimentos quando der para ver (arroz, feijão, carne). Se a imagem não mostrar comida ou o texto não descrever uma refeição, devolva a lista vazia. Não comente sobre dieta, medicamento, dose ou saúde.`

const SISTEMA_RESUMO = `Você é o Dose, o mascote do app Canetolino: uma caneta simpática que acompanha pessoas em tratamento com canetas para emagrecimento.

Escreva o resumo da semana a partir dos indicadores recebidos, em português do Brasil, com no máximo 3 frases curtas. Tom acolhedor, sem culpa e sem pressão. Comemore o que foi bom; quando algo ficou abaixo da meta, diga isso com leveza.

O texto aparece para o paciente e para profissionais de saúde autorizados, e não substitui avaliação médica. Por isso:
- Use só os dados recebidos. Se um indicador estiver ausente ou zerado por falta de registro, diga que faltou registro em vez de supor.
- Nunca fale de dose, ajuste, troca ou suspensão de medicamento.
- Nunca diagnostique nem sugira o que um sintoma significa.
- Nunca afirme que algo causou algo. Relações de tempo podem ser ditas como fato ("o enjoo apareceu no dia seguinte à aplicação"), sem explicar a causa.
- Não dê ordens nem recomendações médicas ou nutricionais.

Responda só com o texto do resumo, sem título nem aspas.`

// Filtro final: se o texto escapar das regras, o app mostra o resumo padrão sem IA.
const BLOQUEIO = /\b(doses?|mg|miligramas?|microgramas?|diagn[oó]stic\w*|causou|causad[oa]s?|por causa d|devido a|efeito colateral|aument(e|ar) a|diminu(a|ir) a|reduz(a|ir) a|suspend\w*|troc(ar|a) de (rem[eé]dio|medicamento)|procure (um )?m[eé]dico)\b/i

const ESQUEMA_REFEICAO = {
  type: 'object',
  additionalProperties: false,
  required: ['itens'],
  properties: {
    itens: {
      type: 'array',
      items: {
        type: 'object',
        additionalProperties: false,
        required: ['nome', 'busca', 'preparo', 'porcao_g', 'porcao_texto', 'confianca'],
        properties: {
          nome: { type: 'string' },
          busca: { type: 'string' },
          preparo: { type: 'string' },
          porcao_g: { type: 'number' },
          porcao_texto: { type: 'string' },
          confianca: { type: 'number' },
        },
      },
    },
  },
}

type ItemIA = { nome: string; busca: string; preparo: string; porcao_g: number; porcao_texto: string; confianca: number }

/** Procura o alimento na base; se não achar com todos os termos, tira o último e tenta de novo. */
// deno-lint-ignore no-explicit-any
async function casarAlimento(admin: any, item: ItemIA): Promise<Food | null> {
  const termos = `${item.busca}`.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().split(/\s+/).filter(Boolean).slice(0, 4)
  for (let n = termos.length; n >= 1; n--) {
    const { data } = await admin.rpc('buscar_alimentos', { p_q: termos.slice(0, n).join(' '), p_limite: 1 })
    const f = (data as Food[] | null)?.[0]
    if (f && f.proteina_100g != null) return f
  }
  return null
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { status: 204, headers: CORS })
  if (req.method !== 'POST') return json({ erro: 'metodo' }, 405)

  // autenticação própria: o token da sessão do app
  const token = (req.headers.get('Authorization') ?? '').replace(/^Bearer\s+/i, '')
  const url = Deno.env.get('SUPABASE_URL')!
  const admin = createClient(url, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!, { auth: { persistSession: false } })
  const { data: u, error: eu } = await admin.auth.getUser(token)
  if (eu || !u.user) return json({ erro: 'nao_autenticado' }, 401)
  const userId = u.user.id

  // chave: segredo da função ou, se não houver, a tabela `segredos` (só o servidor lê)
  const chave = Deno.env.get('ANTHROPIC_API_KEY') ?? (await admin.from('segredos').select('valor').eq('nome', 'ANTHROPIC_API_KEY').maybeSingle()).data?.valor
  if (!chave) return json({ erro: 'ia_indisponivel' }, 503)

  let corpo: { acao?: string; imagem?: string; media_type?: string; texto?: string; semana?: string; indicadores?: Record<string, unknown> }
  try {
    corpo = await req.json()
  } catch {
    return json({ erro: 'corpo_invalido' }, 400)
  }

  const { data: perfil } = await admin.from('profiles').select('plano, config').eq('user_id', userId).maybeSingle()
  if ((perfil?.config as { ia?: boolean } | null)?.ia === false) return json({ erro: 'ia_desligada' }, 403)

  const claude = new Anthropic({ apiKey: chave })
  const registrarUso = (tipo: string, r: Anthropic.Message) =>
    admin.from('ai_usage').insert({ user_id: userId, tipo, modelo: r.model, tokens_entrada: r.usage.input_tokens, tokens_saida: r.usage.output_tokens })

  try {
    /* ---------------- refeição por foto ou texto ---------------- */
    if (corpo.acao === 'refeicao_foto' || corpo.acao === 'refeicao_texto') {
      if (perfil?.plano !== 'premium') {
        const inicioMes = new Date()
        inicioMes.setUTCDate(1)
        inicioMes.setUTCHours(0, 0, 0, 0)
        const { count } = await admin.from('ai_usage').select('id', { count: 'exact', head: true }).eq('user_id', userId).in('tipo', ['refeicao_foto', 'refeicao_texto']).gte('em', inicioMes.toISOString())
        if ((count ?? 0) >= COTA_BASICO) return json({ erro: 'cota', limite: COTA_BASICO }, 429)
      }

      let conteudo: Anthropic.ContentBlockParam[]
      if (corpo.acao === 'refeicao_foto') {
        const tipo = corpo.media_type ?? 'image/jpeg'
        if (!corpo.imagem || !['image/jpeg', 'image/png', 'image/webp'].includes(tipo)) return json({ erro: 'imagem_invalida' }, 400)
        if (corpo.imagem.length > 2_000_000) return json({ erro: 'imagem_grande' }, 413) // o app reduz a foto antes de enviar
        conteudo = [
          { type: 'image', source: { type: 'base64', media_type: tipo as 'image/jpeg', data: corpo.imagem } },
          { type: 'text', text: 'Identifique os alimentos desta refeição.' },
        ]
      } else {
        const texto = (corpo.texto ?? '').trim().slice(0, 1000)
        if (texto.length < 3) return json({ erro: 'texto_curto' }, 400)
        conteudo = [{ type: 'text', text: `Identifique os alimentos desta refeição descrita pela pessoa: "${texto}"` }]
      }

      const r = await claude.messages.create({
        model: MODELO,
        max_tokens: 4000,
        output_config: { effort: 'low', format: { type: 'json_schema', schema: ESQUEMA_REFEICAO } },
        system: [{ type: 'text', text: SISTEMA_REFEICAO, cache_control: { type: 'ephemeral' } }],
        messages: [{ role: 'user', content: conteudo }],
      })
      await registrarUso(corpo.acao, r)
      if (r.stop_reason === 'refusal') return json({ erro: 'recusado' }, 422)
      if (r.stop_reason === 'max_tokens') return json({ erro: 'ia_falhou' }, 502)
      const txt = r.content.find((b) => b.type === 'text')
      const saida = JSON.parse(txt && txt.type === 'text' ? txt.text : '{"itens":[]}') as { itens: ItemIA[] }

      // nutrientes sempre da tabela; o que não casar volta marcado para busca manual
      const itens = await Promise.all(saida.itens.slice(0, 12).map(async (i) => {
        const f = await casarAlimento(admin, i)
        const g = Math.max(5, Math.min(1500, Math.round(i.porcao_g)))
        return f
          ? { food_id: f.id, nome: i.nome, nome_tabela: f.nome, fonte: f.fonte, porcao_g: g, porcao_texto: i.porcao_texto || `${g} g`, proteina_g: +((Number(f.proteina_100g) * g) / 100).toFixed(1), energia_kcal: Math.round((Number(f.energia_100g ?? 0) * g) / 100), confianca: i.confianca, nao_encontrado: false, versao_tabela: f.versao_tabela }
          : { food_id: '', nome: i.nome, nome_tabela: '', fonte: '', porcao_g: g, porcao_texto: i.porcao_texto || `${g} g`, proteina_g: 0, energia_kcal: 0, confianca: i.confianca, nao_encontrado: true, versao_tabela: '' }
      }))
      return json({ itens, modelo: r.model })
    }

    /* ---------------- resumo semanal do Radar ---------------- */
    if (corpo.acao === 'resumo_semanal') {
      const semana = /^\d{4}-\d{2}-\d{2}$/.test(corpo.semana ?? '') ? corpo.semana! : null
      if (!semana || !corpo.indicadores) return json({ erro: 'dados_invalidos' }, 400)
      const { data: salvo } = await admin.from('weekly_reports').select('resumo_ia').eq('user_id', userId).eq('semana', semana).maybeSingle()
      if (salvo) return json({ resumo: salvo.resumo_ia, guardado: true })

      // só números agregados vão ao modelo: nada de nome, e-mail ou documento
      const ind = corpo.indicadores
      const r = await claude.messages.create({
        model: MODELO,
        max_tokens: 2000,
        output_config: { effort: 'low' },
        system: [{ type: 'text', text: SISTEMA_RESUMO, cache_control: { type: 'ephemeral' } }],
        messages: [{ role: 'user', content: `Indicadores da semana (JSON):\n${JSON.stringify(ind).slice(0, 4000)}` }],
      })
      await registrarUso('resumo_semanal', r)
      if (r.stop_reason === 'refusal' || r.stop_reason === 'max_tokens') return json({ bloqueado: true })
      const txt = r.content.find((b) => b.type === 'text')
      const resumo = (txt && txt.type === 'text' ? txt.text : '').trim()
      if (!resumo || resumo.length > 600 || BLOQUEIO.test(resumo)) return json({ bloqueado: true })
      await admin.from('weekly_reports').upsert({ user_id: userId, semana, indicadores: ind, resumo_ia: resumo, modelo_ia: r.model, versao_prompt: VERSAO_PROMPT }, { onConflict: 'user_id,semana' })
      return json({ resumo, guardado: false })
    }

    return json({ erro: 'acao_desconhecida' }, 400)
  } catch (e) {
    // erros sem conteúdo de saúde nos logs
    if (e instanceof Anthropic.AuthenticationError) {
      console.error('ia: chave da Anthropic inválida')
      return json({ erro: 'ia_indisponivel' }, 503)
    }
    if (e instanceof Anthropic.RateLimitError) return json({ erro: 'ocupado' }, 503)
    if (e instanceof Anthropic.APIError) {
      console.error('ia: erro da API', e.status)
      return json({ erro: 'ia_falhou' }, 502)
    }
    console.error('ia: erro interno', (e as Error)?.name)
    return json({ erro: 'ia_falhou' }, 500)
  }
})
