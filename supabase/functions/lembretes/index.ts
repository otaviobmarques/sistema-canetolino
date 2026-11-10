// Canetolino · o Dose como companhia ao longo do dia (Web Push)
// Roda a cada 15 minutos (pg_cron). Também atende: o teste pedido pela pessoa e os botões da notificação.
// Regras para não ficar chato:
//  - cada tipo (água, refeição, treino, aplicação) pode ser desligado no Perfil;
//  - dois casos: sem nenhum registro, ou com registro mas a meta ainda não batida; meta batida = só comemoração;
//  - no máximo 2 lembretes por dia (água, refeição e treino), fora o da aplicação e as comemorações;
//  - horário de silêncio (padrão 22h às 8h);
//  - lembrete ignorado 3 dias seguidos: o Dose passa a lembrar menos e pergunta se a pessoa quer manter;
//  - mensagens variadas e gentis, nunca com nome de remédio, peso ou sintoma.
import webpush from 'npm:web-push@3.6.7'
import { createClient } from 'npm:@supabase/supabase-js@2.119.0'

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-lembretes-token',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}
const json = (corpo: unknown, status = 200) => new Response(JSON.stringify(corpo), { status, headers: { ...CORS, 'Content-Type': 'application/json' } })

type Tipo = 'agua' | 'refeicao' | 'treino' | 'aplicacao' | 'vespera' | 'comemoracao' | 'pergunta' | 'teste'
type Assinatura = { id: string; user_id: string; endpoint: string; p256dh: string; auth: string }
type Aviso = { tipo: Tipo; chave: string; titulo: string; texto: string; url: string; imagem?: string; acoes?: { action: string; title: string }[]; conta?: boolean; base?: Tipo }
type Config = {
  notificacoesDiscretas?: boolean
  lembretesAgua?: boolean
  lembretes?: Partial<Record<'agua' | 'refeicao' | 'treino' | 'aplicacao', boolean>>
  silencio?: { inicio?: string; fim?: string }
  metaTreinosSemana?: number
}

const LIMITE_DIA = 2
const SITE = 'https://canetolino.com.br'
const IMAGEM: Partial<Record<Tipo, string>> = {
  agua: `${SITE}/notificacao/agua.jpg`, refeicao: `${SITE}/notificacao/refeicao.jpg`, treino: `${SITE}/notificacao/treino.jpg`,
  aplicacao: `${SITE}/notificacao/aplicacao.jpg`, vespera: `${SITE}/notificacao/aplicacao.jpg`, comemoracao: `${SITE}/notificacao/comemoracao.jpg`,
  pergunta: `${SITE}/notificacao/aplicacao.jpg`, teste: `${SITE}/notificacao/comemoracao.jpg`,
}

/* Mensagens: curtas, gentis, sem culpa, sem peso nem remédio. Uma por dia, variando. */
// dois casos: sem nenhum registro ainda, ou com registro mas a meta ainda não batida
const MSG = {
  agua: ['O Dose tá com sede! Bora o primeiro copo? 💧', 'Bora um gole juntos? 💧', 'Um copo d’água agora cai bem. Vamos? 💧'],
  agua_falta: ['Falta pouco! Mais um copo e a meta é sua 💧', 'Já está no caminho! Mais uns goles e a meta de água é sua 💧', 'Bom ritmo na água! Bora mais um copo? 💧'],
  refeicao: ['Já almoçou? Registra aí pra gente acompanhar sua proteína.', 'O que teve no prato hoje? Uma foto rapidinha resolve 📸', 'Me conta do almoço? Uma foto já basta 📸'],
  refeicao_falta: ['Quase lá na proteína. Bora bater a meta? 💪', 'Falta pouquinho de proteína hoje. Um lanche caprichado resolve 💪', 'Sua proteína está quase lá! Bora fechar o dia na meta? 💪'],
  treino: ['Bora se mexer? Uma caminhada já conta 🚶', 'Dez minutinhos de movimento já fazem bem. Bora?', 'Uma alongada ou uma volta no quarteirão? Eu vou junto.'],
  treino_falta: ['Falta pouco para a meta da semana. Bora? 💪', 'Mais um treino e a semana fecha na meta! Bora?', 'Você está perto da meta de treinos da semana. Vamos juntos?'],
  vespera: ['Amanhã é dia da sua aplicação. Estou com você 💜', 'Lembrete amigo: amanhã é o seu dia de aplicação 💜', 'Amanhã tem aplicação. Já deixa tudo pronto, sem pressa 💜'],
  comemoracao: ['Meta de água batida! Arrasou 🎉', 'Água em dia hoje! Que orgulho 💧🎉', 'Você bateu a meta de água! Bora manter 🎉'],
  comemoracao_proteina: ['Meta de proteína batida! Arrasou 💪🎉', 'Proteína em dia hoje! Que orgulho 🎉', 'Você bateu a meta de proteína! 💪'],
  comemoracao_treino: ['Meta de treinos da semana batida! Arrasou 🎉', 'Semana na meta de treinos! Que orgulho 💪🎉', 'Você fechou a meta de treinos da semana! 🎉'],
}
const NOME_TIPO: Record<'agua' | 'refeicao' | 'treino', string> = { agua: 'da água', refeicao: 'das refeições', treino: 'do movimento' }
function escolher(lista: string[], semente: string) {
  let h = 0
  for (const c of semente) h = (h * 31 + c.charCodeAt(0)) >>> 0
  return lista[h % lista.length]
}

/* ---------------- horário local ---------------- */
function agoraNoFuso(fuso: string, base = new Date()) {
  const p = Object.fromEntries(
    new Intl.DateTimeFormat('en-CA', { timeZone: fuso, year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', weekday: 'short', hour12: false })
      .formatToParts(base)
      .map((x) => [x.type, x.value]),
  )
  const dia = `${p.year}-${p.month}-${p.day}`
  const dow = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].indexOf(p.weekday)
  const minutos = (Number(p.hour) % 24) * 60 + Number(p.minute)
  return { dia, dow, minutos, hora: Number(p.hour) % 24 }
}
function inicioDoDiaUtc(dia: string, fuso: string) {
  const meioDia = new Date(`${dia}T12:00:00Z`)
  const local = new Date(meioDia.toLocaleString('en-US', { timeZone: fuso }))
  return new Date(new Date(`${dia}T00:00:00Z`).getTime() + (meioDia.getTime() - local.getTime()))
}
const min = (hhmm: string | undefined, padrao: number) => {
  const m = String(hhmm ?? '').match(/^(\d{1,2}):(\d{2})/)
  return m ? Number(m[1]) * 60 + Number(m[2]) : padrao
}
/** Silêncio que pode virar a noite (ex.: 22:00 → 08:00). */
const emSilencio = (agora: number, ini: number, fim: number) => (ini === fim ? false : ini < fim ? agora >= ini && agora < fim : agora >= ini || agora < fim)
const naJanela = (agora: number, alvo: number) => agora >= alvo && agora < alvo + 15
const diaMenos = (dia: string, n: number) => new Date(Date.parse(`${dia}T12:00:00Z`) - n * 86400000).toISOString().slice(0, 10)

/* ---------------- token dos botões da notificação ---------------- */
async function assinar(segredo: string, texto: string) {
  const k = await crypto.subtle.importKey('raw', new TextEncoder().encode(segredo), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign'])
  const s = new Uint8Array(await crypto.subtle.sign('HMAC', k, new TextEncoder().encode(texto)))
  return btoa(String.fromCharCode(...s)).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')
}

/* ---------------- dose com unidade (só no modo não discreto, como já era) ---------------- */
const UNIDADE: Record<string, string> = { mg: 'mg', ml: 'mL', ui: 'UI', u: 'UI', unidades: 'UI', clique: 'cliques', cliques: 'cliques' }
function formatarDose(t?: string | null) {
  const s = String(t ?? '').trim()
  const m = s.match(/^(\d+(?:[.,]\d+)?)\s*([a-zA-Z]+)?$/)
  const u = m ? (m[2] ? UNIDADE[m[2].toLowerCase()] : 'mg') : null
  return m && u ? `${m[1].replace('.', ',')} ${u}` : s
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { status: 204, headers: CORS })
  if (req.method !== 'POST') return json({ erro: 'metodo' }, 405)

  const db = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!, { auth: { persistSession: false } })
  const { data: seg } = await db.from('segredos').select('nome, valor').in('nome', ['VAPID_PRIVATE_KEY', 'VAPID_PUBLIC_KEY', 'LEMBRETES_TOKEN'])
  const s = Object.fromEntries((seg ?? []).map((x) => [x.nome, x.valor]))
  if (!s.VAPID_PRIVATE_KEY || !s.VAPID_PUBLIC_KEY || !s.LEMBRETES_TOKEN) return json({ erro: 'sem_chaves' }, 503)
  webpush.setVapidDetails('mailto:contato@canetolino.com.br', s.VAPID_PUBLIC_KEY, s.VAPID_PRIVATE_KEY)
  const corpo = await req.json().catch(() => ({}))

  const enviar = async (a: Assinatura, payload: unknown) => {
    try {
      await webpush.sendNotification({ endpoint: a.endpoint, keys: { p256dh: a.p256dh, auth: a.auth } }, JSON.stringify(payload), { TTL: 3600, urgency: 'normal' })
      return true
    } catch (e) {
      const status = (e as { statusCode?: number }).statusCode
      if (status === 404 || status === 410) await db.from('push_subscriptions').delete().eq('id', a.id)
      else await db.from('push_subscriptions').update({ ultimo_erro: String(status ?? 'erro') }).eq('id', a.id)
      return false
    }
  }
  const montar = async (userId: string, av: Aviso) => {
    const e = Date.now() + 2 * 86400000
    const t = await assinar(s.LEMBRETES_TOKEN, `${userId}|${av.chave}|${e}`)
    return { titulo: av.titulo, texto: av.texto, url: av.url, imagem: av.imagem ?? IMAGEM[av.tipo], tipo: av.tipo, acoes: av.acoes ?? [], tag: av.tipo, token: { u: userId, c: av.chave, e, t } }
  }

  /* ---------- botões da notificação (+1 copo, lembrar mais tarde, abriu) ---------- */
  if (corpo.acao && corpo.token) {
    const { u, c, e, t } = corpo.token as { u: string; c: string; e: number; t: string }
    if (!u || !c || !e || Date.now() > e || t !== (await assinar(s.LEMBRETES_TOKEN, `${u}|${c}|${e}`))) return json({ erro: 'token' }, 401)
    await db.from('reminder_log').update({ respondido_em: new Date().toISOString() }).eq('user_id', u).eq('chave', c)
    if (corpo.acao === 'copo') {
      await db.from('hydration_records').insert({ id: crypto.randomUUID(), user_id: u, ml: 250, registrado_em: new Date().toISOString() })
      const { data: p } = await db.from('profiles').select('fuso, meta_agua_ml').eq('user_id', u).maybeSingle()
      const fuso = p?.fuso || 'America/Sao_Paulo'
      const { data: agua } = await db.from('hydration_records').select('ml').eq('user_id', u).gte('registrado_em', inicioDoDiaUtc(agoraNoFuso(fuso).dia, fuso).toISOString())
      const total = (agua ?? []).reduce((x, r) => x + r.ml, 0)
      return json({ ok: true, total_ml: total, meta: total >= (p?.meta_agua_ml ?? 2000) })
    }
    if (corpo.acao === 'soneca') {
      const tipo = c.split(':')[0]
      await db.from('lembrete_soneca').insert({ user_id: u, tipo, enviar_em: new Date(Date.now() + 60 * 60000).toISOString() })
      return json({ ok: true })
    }
    return json({ ok: true })
  }

  /* ---------- teste pedido pela própria pessoa ---------- */
  const token = req.headers.get('x-lembretes-token')
  if (!token) {
    const jwt = (req.headers.get('Authorization') ?? '').replace(/^Bearer\s+/i, '')
    const { data: u } = await db.auth.getUser(jwt)
    if (!u.user) return json({ erro: 'nao_autenticado' }, 401)
    const { data: subs } = await db.from('push_subscriptions').select('*').eq('user_id', u.user.id)
    const payload = await montar(u.user.id, { tipo: 'teste', chave: `teste:${Date.now()}`, titulo: 'Canetolino', texto: 'Oi! Sou eu, o Dose. Seus lembretes vão chegar assim 💜', url: '/#/app/home' })
    let ok = 0
    for (const a of (subs ?? []) as Assinatura[]) if (await enviar(a, payload)) ok++
    return json({ enviados: ok, aparelhos: subs?.length ?? 0 })
  }
  if (token !== s.LEMBRETES_TOKEN) return json({ erro: 'negado' }, 403)

  /* ---------- rodada agendada (ou simulação para teste: { simular: { user_id, agora } }) ---------- */
  const simular = corpo.simular as { user_id: string; agora: string } | undefined
  const base = simular ? new Date(simular.agora) : new Date()
  const { data: subs } = simular ? { data: [{ user_id: simular.user_id }] } : await db.from('push_subscriptions').select('*')
  const porUsuario = new Map<string, Assinatura[]>()
  for (const a of (subs ?? []) as Assinatura[]) porUsuario.set(a.user_id, [...(porUsuario.get(a.user_id) ?? []), a])
  let enviados = 0
  const relatorio: Record<string, unknown>[] = []

  for (const [userId, aparelhos] of porUsuario) {
    const { data: p } = await db.from('profiles').select('fuso, config, meta_agua_ml, meta_proteina_g').eq('user_id', userId).maybeSingle()
    if (!p) continue
    const cfg = (p.config ?? {}) as Config
    const liga = { agua: cfg.lembretes?.agua ?? cfg.lembretesAgua !== false, refeicao: cfg.lembretes?.refeicao !== false, treino: cfg.lembretes?.treino !== false, aplicacao: cfg.lembretes?.aplicacao !== false }
    const discreto = cfg.notificacoesDiscretas !== false
    const fuso = p.fuso || 'America/Sao_Paulo'
    const agora = agoraNoFuso(fuso, base)
    const inicioHoje = inicioDoDiaUtc(agora.dia, fuso).toISOString()
    const fimHoje = inicioDoDiaUtc(diaMenos(agora.dia, -1), fuso).toISOString()
    const silIni = min(cfg.silencio?.inicio, 22 * 60), silFim = min(cfg.silencio?.fim, 8 * 60)
    const calado = emSilencio(agora.minutos, silIni, silFim)
    const avisos: Aviso[] = []

    const [{ data: hojeLog }, { data: estados }, { data: aguaHoje }] = await Promise.all([
      db.from('reminder_log').select('chave, tipo').eq('user_id', userId).gte('enviado_em', inicioHoje).lt('enviado_em', fimHoje),
      db.from('lembrete_estado').select('*').eq('user_id', userId),
      db.from('hydration_records').select('ml, registrado_em').eq('user_id', userId).gte('registrado_em', inicioHoje).lte('registrado_em', base.toISOString()),
    ])
    const usadosHoje = (hojeLog ?? []).filter((x) => ['agua', 'refeicao', 'treino'].includes(x.tipo ?? '')).length
    const estado = (t: string) => (estados ?? []).find((x) => x.tipo === t)
    const aguaTotal = (aguaHoje ?? []).reduce((x, r) => x + r.ml, 0)
    const meta = p.meta_agua_ml ?? 2000

    /** Os 3 últimos lembretes deste tipo foram em 3 dias seguidos e nenhum foi atendido? */
    const ignorou3 = async (t: 'agua' | 'refeicao' | 'treino') => {
      const { data: ult } = await db.from('reminder_log').select('chave, enviado_em, respondido_em').eq('user_id', userId).eq('tipo', t).order('enviado_em', { ascending: false }).limit(3)
      if (!ult || ult.length < 3 || ult.some((x) => x.respondido_em)) return false
      const dias = ult.map((x) => agoraNoFuso(fuso, new Date(x.enviado_em)).dia)
      if (dias[0] !== diaMenos(agora.dia, 1) || dias[1] !== diaMenos(agora.dia, 2) || dias[2] !== diaMenos(agora.dia, 3)) return false
      const tabela = t === 'agua' ? 'hydration_records' : t === 'refeicao' ? 'meals' : 'workouts'
      const campo = t === 'refeicao' ? 'horario' : 'registrado_em'
      for (const [i, x] of ult.entries()) {
        const fimDia = inicioDoDiaUtc(diaMenos(agora.dia, i), fuso).toISOString()
        const { count } = await db.from(tabela).select('id', { count: 'exact', head: true }).eq('user_id', userId).gte(campo, x.enviado_em).lt(campo, fimDia)
        if (count) return false
      }
      return true
    }
    /** Decide se um lembrete de companhia sai agora (limite, ritmo e a pergunta depois de 3 ignorados). */
    const companhia = async (t: 'agua' | 'refeicao' | 'treino', av: Omit<Aviso, 'tipo'>) => {
      if (calado || usadosHoje + avisos.filter((x) => x.conta).length >= LIMITE_DIA) return
      if ((hojeLog ?? []).some((x) => x.tipo === t)) return
      const e = estado(t)
      if (e?.perguntar) return // já perguntou: espera a resposta no app
      if (e?.ritmo === 'reduzido') {
        const { count } = await db.from('reminder_log').select('chave', { count: 'exact', head: true }).eq('user_id', userId).eq('tipo', t).gte('enviado_em', inicioDoDiaUtc(diaMenos(agora.dia, 2), fuso).toISOString())
        if (count) return // ritmo menor: no máximo um a cada 3 dias
      } else if (await ignorou3(t)) {
        if (!simular) await db.from('lembrete_estado').upsert({ user_id: userId, tipo: t, ritmo: 'reduzido', perguntar: true, atualizado_em: new Date().toISOString() })
        avisos.push({ tipo: 'pergunta', base: t, conta: true, chave: `${t}:${agora.dia}:pergunta`, titulo: 'Canetolino', texto: `Percebi que os lembretes ${NOME_TIPO[t]} não estão ajudando. Quer que eu continue? Toque para escolher 💜`, url: '/#/app/perfil?lembretes=1' })
        return
      }
      avisos.push({ tipo: t, conta: true, ...av })
    }

    // proteína do dia (para "quase lá" e comemoração)
    const { data: refHoje } = await db.from('meals').select('id, horario').eq('user_id', userId).gte('horario', inicioHoje).lt('horario', fimHoje).lte('horario', base.toISOString())
    const protHoje = refHoje?.length ? ((await db.from('meal_items').select('proteina_g').in('meal_id', refHoje.map((r) => r.id))).data ?? []).reduce((x, i) => x + Number(i.proteina_g), 0) : 0
    const metaProt = p.meta_proteina_g ?? 100
    // treinos da semana (segunda a domingo, no fuso da pessoa)
    const segunda = diaMenos(agora.dia, (agora.dow + 6) % 7)
    const { data: treinosSemana } = await db.from('workouts').select('registrado_em').eq('user_id', userId).gte('registrado_em', inicioDoDiaUtc(segunda, fuso).toISOString()).lte('registrado_em', base.toISOString())
    const metaTreinos = Math.max(1, Math.min(7, Number(cfg.metaTreinosSemana) || 3))
    const treinosFeitos = treinosSemana?.length ?? 0
    const treinouHoje = (treinosSemana ?? []).some((t) => +new Date(t.registrado_em) >= +new Date(inicioHoje))

    const botoesAgua = [{ action: 'copo', title: '+1 copo' }, { action: 'soneca', title: 'Lembrar mais tarde' }]
    // 1) água: meio-dia sem nenhum copo; 16h com copo registrado mas sem a meta (ou ainda sem nenhum)
    if (liga.agua && aguaTotal < meta) {
      if (naJanela(agora.minutos, 12 * 60) && aguaTotal === 0)
        await companhia('agua', { chave: `agua:${agora.dia}:12`, titulo: 'Canetolino', texto: escolher(MSG.agua, agora.dia), url: '/#/app/home', acoes: botoesAgua })
      else if (naJanela(agora.minutos, 16 * 60))
        await companhia('agua', { chave: `agua:${agora.dia}:16`, titulo: 'Canetolino', texto: escolher(aguaTotal ? MSG.agua_falta : MSG.agua, agora.dia), url: '/#/app/home', acoes: botoesAgua })
    }
    // 2) alimentação: 14h30 sem nenhuma refeição; 17h30 com refeição mas a proteína ainda abaixo da meta
    if (liga.refeicao && protHoje < metaProt) {
      if (naJanela(agora.minutos, 14 * 60 + 30) && !refHoje?.length)
        await companhia('refeicao', { chave: `refeicao:${agora.dia}:almoco`, titulo: 'Canetolino', texto: escolher(MSG.refeicao, agora.dia), url: '/#/app/registrar/refeicao?modo=foto', acoes: [{ action: 'abrir', title: 'Registrar agora' }, { action: 'soneca', title: 'Lembrar mais tarde' }] })
      else if (naJanela(agora.minutos, 17 * 60 + 30) && refHoje?.length)
        await companhia('refeicao', { chave: `refeicao:${agora.dia}:proteina`, titulo: 'Canetolino', texto: escolher(MSG.refeicao_falta, agora.dia), url: '/#/app/registrar/refeicao?modo=foto', acoes: [{ action: 'abrir', title: 'Registrar lanche' }, { action: 'soneca', title: 'Lembrar mais tarde' }] })
    }
    // 3) treino: às 18h. Sem treino há 3 dias: convite leve. Com treino na semana mas abaixo da meta: de quinta a domingo, se não treinou hoje
    if (liga.treino && treinosFeitos < metaTreinos && !treinouHoje && naJanela(agora.minutos, 18 * 60)) {
      const { count: recentes } = await db.from('workouts').select('id', { count: 'exact', head: true }).eq('user_id', userId).gte('registrado_em', inicioDoDiaUtc(diaMenos(agora.dia, 2), fuso).toISOString()).lte('registrado_em', base.toISOString())
      const botoes = [{ action: 'abrir', title: 'Registrar treino' }, { action: 'soneca', title: 'Lembrar mais tarde' }]
      if (!treinosFeitos && !recentes) await companhia('treino', { chave: `treino:${agora.dia}`, titulo: 'Canetolino', texto: escolher(MSG.treino, agora.dia), url: '/#/app/registrar/treino', acoes: botoes })
      else if (treinosFeitos && [4, 5, 6, 0].includes(agora.dow)) await companhia('treino', { chave: `treino:${agora.dia}`, titulo: 'Canetolino', texto: escolher(MSG.treino_falta, agora.dia), url: '/#/app/registrar/treino', acoes: botoes })
    }
    // 4) aplicação: na véspera e no dia (não entram no limite; o do dia respeita o horário que a pessoa escolheu)
    if (liga.aplicacao) {
      const { data: agendas } = await db.from('application_schedules').select('dia_semana, horario').eq('user_id', userId)
      for (const ag of agendas ?? []) {
        const alvo = min(String(ag.horario), 8 * 60)
        if (ag.dia_semana === agora.dow && agora.minutos >= alvo && agora.minutos < alvo + 120 && !(hojeLog ?? []).some((x) => x.chave === `aplicacao:${agora.dia}`)) {
          const { count } = await db.from('applications').select('id', { count: 'exact', head: true }).eq('user_id', userId).gte('aplicado_em', inicioHoje).lt('aplicado_em', fimHoje)
          if (!count) {
            let texto = 'Hoje é o seu dia Canetolino. Estou aqui com você 💜'
            if (!discreto) {
              const [{ count: feitas }, { data: ult }, { data: receita }] = await Promise.all([
                db.from('applications').select('id', { count: 'exact', head: true }).eq('user_id', userId),
                db.from('applications').select('dose_texto').eq('user_id', userId).not('dose_texto', 'is', null).order('aplicado_em', { ascending: false }).limit(1),
                db.from('prescriptions').select('dose_texto').eq('user_id', userId).limit(1),
              ])
              const bruta = ult?.[0]?.dose_texto ?? receita?.[0]?.dose_texto
              const dose = bruta && !/conforme/i.test(bruta) ? formatarDose(bruta) : ''
              texto = `Hoje é dia da sua ${(feitas ?? 0) + 1}ª aplicação${dose ? ` (${dose})` : ''}, às ${String(ag.horario).slice(0, 5)}. Estou com você 💜`
            }
            avisos.push({ tipo: 'aplicacao', chave: `aplicacao:${agora.dia}`, titulo: 'Canetolino', texto, url: '/#/app/jornada', acoes: [{ action: 'abrir', title: 'Registrar aplicação' }] })
          }
        }
        // véspera: às 20h (ou 30 min antes do silêncio, se ele começar mais cedo)
        const vespera = Math.min(20 * 60, silIni >= 12 * 60 ? silIni - 30 : 20 * 60)
        if ((ag.dia_semana + 6) % 7 === agora.dow && naJanela(agora.minutos, vespera) && !calado && !(hojeLog ?? []).some((x) => x.chave === `vespera:${agora.dia}`))
          avisos.push({ tipo: 'vespera', chave: `vespera:${agora.dia}`, titulo: 'Canetolino', texto: escolher(MSG.vespera, agora.dia), url: '/#/app/jornada' })
      }
    }
    // 5) comemorações (fora do limite de lembretes): logo depois de bater a meta, uma vez por meta
    const recente = (datas: string[]) => {
      const ult = datas.map((x) => +new Date(x)).sort((a, b) => b - a)[0]
      return !!ult && base.getTime() - ult >= 0 && base.getTime() - ult < 30 * 60000
    }
    const jaFoi = async (chave: string) => (hojeLog ?? []).some((x) => x.chave === chave) || !!(await db.from('reminder_log').select('chave').eq('user_id', userId).eq('chave', chave).maybeSingle()).data
    if (!calado) {
      if (liga.agua && aguaTotal >= meta && recente((aguaHoje ?? []).map((x) => x.registrado_em)) && !(await jaFoi(`comemoracao:${agora.dia}:agua`)))
        avisos.push({ tipo: 'comemoracao', chave: `comemoracao:${agora.dia}:agua`, titulo: 'Canetolino', texto: escolher(MSG.comemoracao, agora.dia), url: '/#/app/home' })
      if (liga.refeicao && protHoje >= metaProt && recente((refHoje ?? []).map((x) => x.horario)) && !(await jaFoi(`comemoracao:${agora.dia}:proteina`)))
        avisos.push({ tipo: 'comemoracao', chave: `comemoracao:${agora.dia}:proteina`, titulo: 'Canetolino', texto: escolher(MSG.comemoracao_proteina, agora.dia), url: '/#/app/home' })
      if (liga.treino && treinosFeitos >= metaTreinos && recente((treinosSemana ?? []).map((x) => x.registrado_em)) && !(await jaFoi(`comemoracao:${segunda}:treino`)))
        avisos.push({ tipo: 'comemoracao', chave: `comemoracao:${segunda}:treino`, titulo: 'Canetolino', texto: escolher(MSG.comemoracao_treino, agora.dia), url: '/#/app/radar' })
    }
    // 6) "lembrar mais tarde": reenvia o lembrete adiado (sem contar de novo no limite)
    const { data: sonecas } = await db.from('lembrete_soneca').select('*').eq('user_id', userId).eq('enviado', false).lte('enviar_em', base.toISOString())
    for (const z of sonecas ?? []) {
      if (!simular) await db.from('lembrete_soneca').update({ enviado: true }).eq('id', z.id)
      if (calado) continue
      const t = z.tipo as 'agua' | 'refeicao' | 'treino'
      // se a meta foi batida enquanto o lembrete estava adiado, não manda mais
      if ((t === 'agua' && aguaTotal >= meta) || (t === 'refeicao' && protHoje >= metaProt) || (t === 'treino' && (treinosFeitos >= metaTreinos || treinouHoje))) continue
      const texto = t === 'agua' ? escolher(aguaTotal ? MSG.agua_falta : MSG.agua, `${agora.dia}${z.id}`) : t === 'refeicao' ? escolher(refHoje?.length ? MSG.refeicao_falta : MSG.refeicao, `${agora.dia}${z.id}`) : escolher(treinosFeitos ? MSG.treino_falta : MSG.treino, `${agora.dia}${z.id}`)
      avisos.push({ tipo: t, chave: `${t}:${agora.dia}:soneca${z.id}`, titulo: 'Canetolino', texto, url: t === 'agua' ? '/#/app/home' : t === 'refeicao' ? '/#/app/registrar/refeicao?modo=foto' : '/#/app/registrar/treino', acoes: t === 'agua' ? [{ action: 'copo', title: '+1 copo' }] : [{ action: 'abrir', title: 'Registrar agora' }] })
    }

    if (simular) {
      relatorio.push({ local: agora, silencio: calado, usadosHoje, avisos: avisos.map((a) => ({ tipo: a.tipo, chave: a.chave, texto: a.texto })) })
      continue
    }
    for (const aviso of avisos) {
      // grava antes de enviar: se já existe, outro ciclo já mandou
      const { error } = await db.from('reminder_log').insert({ user_id: userId, chave: aviso.chave, tipo: aviso.base ?? aviso.tipo })
      if (error) continue
      const payload = await montar(userId, aviso)
      for (const a of aparelhos) if (await enviar(a, payload)) enviados++
    }
  }
  return json(simular ? { simulacao: relatorio } : { usuarios: porUsuario.size, enviados })
})
