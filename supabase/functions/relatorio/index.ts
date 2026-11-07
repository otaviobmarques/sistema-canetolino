// Canetolino · relatório em PDF gerado no servidor (POST /reports/pdf do descritivo)
// Lê os dados com a sessão de quem pediu: as regras de RLS limitam o relatório ao que essa
// pessoa pode ver (paciente: tudo; profissional: só módulos autorizados).
// Marca a origem de cada dado (registrado pelo paciente ou estimado pela IA) e cita as fontes.
import { PDFDocument, StandardFonts, rgb, type PDFFont, type PDFPage } from 'npm:pdf-lib@1.17.1'
import { createClient } from 'npm:@supabase/supabase-js@2.119.0'

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}
const json = (corpo: unknown, status = 200) => new Response(JSON.stringify(corpo), { status, headers: { ...CORS, 'Content-Type': 'application/json' } })

const ROXO = rgb(0.231, 0.102, 0.431)
const VIOLETA = rgb(0.424, 0.247, 0.769)
const TURQUESA = rgb(0.18, 0.769, 0.714)
const CINZA = rgb(0.369, 0.345, 0.451)
const LILAS = rgb(0.953, 0.933, 1)
const MODULO_NOME: Record<string, string> = { peso: 'Peso e medidas', nutricao: 'Alimentação e proteína', aplicacoes: 'Aplicações', sintomas: 'Sintomas', bemestar: 'Bem-estar e sono' }
const LOCAL: Record<string, string> = { 'Abdômen esq.': 'Abdômen esquerdo', 'Abdômen dir.': 'Abdômen direito', 'Coxa esq.': 'Coxa esquerda', 'Coxa dir.': 'Coxa direita', 'Braço esq.': 'Braço esquerdo', 'Braço dir.': 'Braço direito' }
const MEDIDA: Record<string, string> = { cintura: 'Cintura', abdomen: 'Abdômen', quadril: 'Quadril', peito: 'Peito', braco: 'Braço', coxa: 'Coxa', pescoco: 'Pescoço' }

/** As fontes padrão do PDF usam WinAnsi: troca o que não cabe nela. */
const limpar = (t: string) =>
  String(t ?? '')
    .replace(/−/g, '-')
    .replace(/→/g, '->')
    .replace(/[\u{1F000}-\u{1FFFF}\u{2600}-\u{27BF}\u{FE0F}]/gu, '')
    .replace(/[^\x00-\xFF–—‘’“”•…€]/g, '')
const sinal = (d: number) => (Math.abs(d) < 0.05 ? '' : d < 0 ? '-' : '+')
const n1 = (v: number) => v.toLocaleString('pt-BR', { minimumFractionDigits: 1, maximumFractionDigits: 1 })
const data = (iso: string, fuso = 'America/Sao_Paulo') => new Date(iso).toLocaleDateString('pt-BR', { timeZone: fuso })
const dataHora = (iso: string, fuso = 'America/Sao_Paulo') => new Date(iso).toLocaleString('pt-BR', { timeZone: fuso, day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' })

/** Dose sempre com unidade: "2,5" vira "2,5 mg", "5mg" vira "5 mg"; texto livre fica como está. */
const UNIDADE: Record<string, string> = { mg: 'mg', ml: 'mL', ui: 'UI', u: 'UI', unidades: 'UI', clique: 'cliques', cliques: 'cliques' }
function formatarDose(t?: string | null) {
  const s = String(t ?? '').trim()
  const m = s.match(/^(\d+(?:[.,]\d+)?)\s*([a-zA-Z]+)?$/)
  const u = m ? (m[2] ? UNIDADE[m[2].toLowerCase()] : 'mg') : null
  return m && u ? `${m[1].replace('.', ',')} ${u}` : s
}

class Doc {
  pdf!: PDFDocument
  pg!: PDFPage
  f!: PDFFont
  b!: PDFFont
  y = 0
  paginas: PDFPage[] = []
  static async criar() {
    const d = new Doc()
    d.pdf = await PDFDocument.create()
    d.f = await d.pdf.embedFont(StandardFonts.Helvetica)
    d.b = await d.pdf.embedFont(StandardFonts.HelveticaBold)
    d.nova()
    return d
  }
  nova() {
    this.pg = this.pdf.addPage([595.28, 841.89])
    this.paginas.push(this.pg)
    this.y = 800
  }
  espaco(h: number) {
    if (this.y - h < 70) this.nova()
  }
  texto(t: string, o: { tam?: number; negrito?: boolean; cor?: ReturnType<typeof rgb>; x?: number; larg?: number; entre?: number } = {}) {
    const tam = o.tam ?? 10
    const fonte = o.negrito ? this.b : this.f
    const x = o.x ?? 48
    const larg = o.larg ?? 595.28 - x - 48
    const linhas: string[] = []
    for (const par of limpar(t).split('\n')) {
      let atual = ''
      for (const p of par.split(' ')) {
        const tenta = atual ? `${atual} ${p}` : p
        if (fonte.widthOfTextAtSize(tenta, tam) > larg && atual) {
          linhas.push(atual)
          atual = p
        } else atual = tenta
      }
      linhas.push(atual)
    }
    for (const l of linhas) {
      this.espaco(tam + 4)
      this.pg.drawText(l, { x, y: this.y, size: tam, font: fonte, color: o.cor ?? rgb(0.118, 0.059, 0.239) })
      this.y -= tam + (o.entre ?? 4)
    }
  }
  titulo(t: string) {
    this.espaco(40)
    this.y -= 10
    this.pg.drawRectangle({ x: 48, y: this.y - 4, width: 4, height: 16, color: TURQUESA })
    this.texto(t, { tam: 13, negrito: true, cor: ROXO, x: 58 })
    this.y -= 2
  }
  tabela(linhas: string[][], larguras: number[]) {
    for (const [i, l] of linhas.entries()) {
      this.espaco(18)
      if (i % 2 === 0) this.pg.drawRectangle({ x: 48, y: this.y - 5, width: 499, height: 16, color: LILAS })
      let x = 54
      l.forEach((cel, j) => {
        let t = limpar(cel)
        const max = larguras[j] - 6
        while (t && this.f.widthOfTextAtSize(t, 8.5) > max) t = t.slice(0, -2)
        if (t !== limpar(cel)) t = t.slice(0, -1) + '…'
        this.pg.drawText(t, { x, y: this.y, size: 8.5, font: j === 0 ? this.b : this.f, color: rgb(0.118, 0.059, 0.239) })
        x += larguras[j]
      })
      this.y -= 16
    }
    this.y -= 4
  }
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { status: 204, headers: CORS })
  if (req.method !== 'POST') return json({ erro: 'metodo' }, 405)
  const auth = req.headers.get('Authorization') ?? ''
  const url = Deno.env.get('SUPABASE_URL')!
  // cliente com a sessão de quem pediu: o RLS decide o que entra no relatório
  const c = createClient(url, Deno.env.get('SUPABASE_ANON_KEY')!, { global: { headers: { Authorization: auth } }, auth: { persistSession: false } })
  const { data: u } = await c.auth.getUser(auth.replace(/^Bearer\s+/i, ''))
  if (!u.user) return json({ erro: 'nao_autenticado' }, 401)

  let corpo: { paciente_id?: string; dias?: number }
  try {
    corpo = await req.json()
  } catch {
    return json({ erro: 'corpo_invalido' }, 400)
  }
  const dias = [7, 30, 90, 365].includes(Number(corpo.dias)) ? Number(corpo.dias) : 30
  const pacienteId = corpo.paciente_id || u.user.id
  const proprio = pacienteId === u.user.id

  let nome = 'Paciente'
  let modulos = ['peso', 'nutricao', 'aplicacoes', 'sintomas', 'bemestar']
  let autor = ''
  let metaProt = 100
  let altura: number | null = null
  let pesoInicial: number | null = null
  if (proprio) {
    const { data: p } = await c.from('profiles').select('nome, plano, meta_proteina_g, altura_cm, peso_inicial_kg').eq('user_id', u.user.id).maybeSingle()
    if (p?.plano !== 'premium') return json({ erro: 'premium' }, 402)
    nome = p?.nome || nome
    metaProt = p?.meta_proteina_g ?? 100
    altura = p?.altura_cm ?? null
    pesoInicial = p?.peso_inicial_kg == null ? null : Number(p.peso_inicial_kg)
  } else {
    const { data: lista, error } = await c.rpc('pacientes_do_profissional')
    if (error) return json({ erro: 'sem_acesso' }, 403)
    const l = (lista ?? []).find((x: { paciente_id: string }) => x.paciente_id === pacienteId)
    if (!l) return json({ erro: 'sem_acesso' }, 403)
    nome = l.nome || nome
    modulos = l.modulos
    metaProt = l.meta_proteina_g ?? 100
    altura = l.altura_cm ?? null
    pesoInicial = l.peso_inicial_kg == null ? null : Number(l.peso_inicial_kg)
    const { data: pr } = await c.from('professionals').select('nome, profissao, registro_conselho').maybeSingle()
    autor = pr ? `${pr.nome}, ${pr.profissao} (${pr.registro_conselho})` : 'profissional autorizado'
  }

  const desde = new Date(Date.now() - dias * 86400000).toISOString()
  const ler = async (t: string, campo: string) => (await c.from(t).select('*').eq('user_id', pacienteId).gte(campo, desde).order(campo)).data ?? []

  const d = await Doc.criar()
  // cabeçalho
  d.pg.drawRectangle({ x: 0, y: 770, width: 595.28, height: 72, color: ROXO })
  d.pg.drawText('canetolino', { x: 48, y: 800, size: 24, font: d.b, color: rgb(1, 1, 1) })
  d.pg.drawText(limpar('Relatório do período'), { x: 48, y: 782, size: 10, font: d.f, color: rgb(0.85, 0.8, 0.97) })
  d.y = 745
  d.texto(nome, { tam: 18, negrito: true, cor: ROXO })
  d.texto(`Período: ${data(desde)} a ${data(new Date().toISOString())} (${dias} dias) · gerado em ${dataHora(new Date().toISOString())} ${proprio ? 'pelo próprio paciente' : `por ${autor}`}`, { tam: 9, cor: CINZA })
  d.texto(`Módulos incluídos: ${modulos.map((m) => MODULO_NOME[m]).join(' · ')}`, { tam: 9, cor: CINZA })

  if (modulos.includes('peso')) {
    const pesos = await ler('weight_records', 'registrado_em')
    const medidas = await ler('measurements', 'registrado_em')
    d.titulo('Peso e medidas')
    if (pesos.length > 1) {
      const a = Number(pesos[0].peso_kg), b = Number(pesos[pesos.length - 1].peso_kg)
      d.texto(`${n1(a)} kg em ${data(pesos[0].registrado_em)} -> ${n1(b)} kg em ${data(pesos[pesos.length - 1].registrado_em)} (${sinal(b - a)}${n1(Math.abs(b - a))} kg). ${pesos.length} pesagens registradas.`)
    } else d.texto(pesos.length ? `Uma pesagem: ${n1(Number(pesos[0].peso_kg))} kg em ${data(pesos[0].registrado_em)}.` : 'Sem pesagens no período.', { cor: CINZA })
    // IMC (peso ÷ altura²), classificação da OMS como referência
    const imc = (kg: number | null) => (kg && altura && altura >= 100 ? kg / (altura / 100) ** 2 : null)
    const faixa = (v: number) => (v < 18.5 ? 'abaixo do peso' : v < 25 ? 'peso adequado' : v < 30 ? 'sobrepeso' : v < 35 ? 'obesidade grau I' : v < 40 ? 'obesidade grau II' : 'obesidade grau III')
    const { data: ultPeso } = await c.from('weight_records').select('peso_kg').eq('user_id', pacienteId).order('registrado_em', { ascending: false }).limit(1)
    const imcAtual = imc(ultPeso?.[0] ? Number(ultPeso[0].peso_kg) : null)
    const imcInicio = imc(pesoInicial)
    if (imcAtual)
      d.texto(`IMC atual ${n1(imcAtual)} (${faixa(imcAtual)})${imcInicio ? ` · no início do tratamento ${n1(imcInicio)} (${faixa(imcInicio)})` : ''} · altura ${(altura! / 100).toFixed(2).replace('.', ',')} m. IMC é referência populacional, não diagnóstico.`, { tam: 9, cor: CINZA })
    const tipos = [...new Set(medidas.map((m) => m.tipo))]
    if (tipos.length)
      d.tabela(
        tipos.map((t) => {
          const l = medidas.filter((m) => m.tipo === t)
          const df = Number(l[l.length - 1].medida_cm) - Number(l[0].medida_cm)
          return [MEDIDA[t] ?? t, `${n1(Number(l[l.length - 1].medida_cm))} cm`, data(l[l.length - 1].registrado_em), l.length > 1 ? `${sinal(df)}${n1(Math.abs(df))} cm no período` : 'um registro']
        }),
        [110, 90, 100, 199],
      )
  }

  if (modulos.includes('nutricao')) {
    const refeicoes = await ler('meals', 'horario')
    const ids = refeicoes.map((r) => r.id)
    const itens = ids.length ? (await c.from('meal_items').select('*').in('meal_id', ids)).data ?? [] : []
    const agua = await ler('hydration_records', 'registrado_em')
    const porDia = new Map<string, number>()
    for (const r of refeicoes) {
      const dia = data(r.horario)
      porDia.set(dia, (porDia.get(dia) ?? 0) + itens.filter((i) => i.meal_id === r.id).reduce((t, i) => t + Number(i.proteina_g), 0))
    }
    const valores = [...porDia.values()]
    const media = valores.length ? Math.round(valores.reduce((a, b) => a + b, 0) / valores.length) : 0
    const aguaDia = new Map<string, number>()
    for (const a of agua) aguaDia.set(data(a.registrado_em), (aguaDia.get(data(a.registrado_em)) ?? 0) + a.ml)
    const ia = refeicoes.filter((r) => r.origem === 'ia_estimativa').length
    d.titulo('Alimentação e proteína')
    d.texto(
      valores.length
        ? `Proteína média de ${media} g por dia ${valores.length === 1 ? 'no único dia' : `nos ${valores.length} dias`} com refeição registrada; meta de ${metaProt} g atingida em ${valores.filter((v) => v >= metaProt * 0.95).length} dias. ${refeicoes.length} refeições (${ia} estimadas pela IA e conferidas pelo paciente, ${refeicoes.length - ia} registradas manualmente). Água: média de ${aguaDia.size ? n1([...aguaDia.values()].reduce((a, b) => a + b, 0) / aguaDia.size / 1000) : '0'} L nos dias com registro.`
        : 'Sem refeições registradas no período.',
    )
    if (refeicoes.length)
      d.tabela(
        [...refeicoes].reverse().slice(0, 25).map((r) => {
          const its = itens.filter((i) => i.meal_id === r.id)
          return [dataHora(r.horario), `${r.tipo ?? 'Refeição'}: ${its.map((i) => i.nome).join(', ')}`, `${Math.round(its.reduce((t, i) => t + Number(i.proteina_g), 0))} g`, r.origem === 'ia_estimativa' ? 'estimado (IA)' : 'registrado']
        }),
        [95, 270, 50, 84],
      )
  }

  if (modulos.includes('aplicacoes')) {
    const apl = await ler('applications', 'aplicado_em')
    const { data: med } = await c.from('medications').select('principio_ativo, nome_comercial').eq('user_id', pacienteId).eq('status', 'ativo').limit(1)
    const { data: presc } = await c.from('prescriptions').select('dose_texto').eq('user_id', pacienteId).limit(1)
    d.titulo('Aplicações')
    if (med?.[0]) d.texto(`${med[0].principio_ativo}${med[0].nome_comercial ? ` (${med[0].nome_comercial})` : ''}. Dose conforme a receita, como o paciente registrou: "${presc?.[0]?.dose_texto ? formatarDose(presc[0].dose_texto) : 'não informada'}". O Canetolino não calcula nem sugere doses.`)
    // numeração de todo o tratamento: conta as aplicações anteriores ao período
    const { count: anteriores } = await c.from('applications').select('id', { count: 'exact', head: true }).eq('user_id', pacienteId).lt('aplicado_em', desde)
    const total = (anteriores ?? 0) + apl.length
    d.texto(`${apl.length} ${apl.length === 1 ? 'aplicação registrada' : 'aplicações registradas'} no período · ${total} no tratamento até agora.`, { cor: CINZA })
    const retro = apl.filter((a) => a.retroativo).length
    if (retro) d.texto(`${retro} ${retro === 1 ? 'aplicação foi registrada' : 'aplicações foram registradas'} depois pelo paciente (histórico anotado antes do app).`, { tam: 9, cor: CINZA })
    if (apl.length)
      d.tabela(
        apl.map((a, i) => ({ a, n: (anteriores ?? 0) + i + 1 })).reverse().map(({ a, n }) => [`${n}ª · ${dataHora(a.aplicado_em)}`, a.dose_texto ? formatarDose(a.dose_texto) : '-', a.local ? LOCAL[a.local] ?? a.local : 'local não informado', [a.observacao, a.retroativo ? 'registrada depois' : ''].filter(Boolean).join(' · ')]),
        [118, 64, 124, 193],
      )
  }

  if (modulos.includes('sintomas')) {
    const sint = await ler('symptoms', 'registrado_em')
    d.titulo('Sintomas')
    if (!sint.length) d.texto('Nenhum sintoma registrado no período.', { cor: CINZA })
    else d.tabela([...sint].reverse().map((x) => [data(x.registrado_em), (x.sintomas as string[]).join(', '), `intensidade ${x.intensidade}/5`, x.alerta_disparado ? 'alerta mostrado ao paciente' : x.observacao ?? '']), [80, 190, 85, 144])
  }

  if (modulos.includes('bemestar')) {
    const be = await ler('wellbeing_records', 'registrado_em')
    const tr = await ler('workouts', 'registrado_em')
    const media = (k: string) => {
      const v = be.map((x) => x[k]).filter((x) => x != null).map(Number)
      return v.length ? n1(v.reduce((a, b) => a + b, 0) / v.length) : '-'
    }
    d.titulo('Bem-estar, sono e treinos')
    d.texto(`Sono médio: ${media('sono_horas')} h · qualidade do sono: ${media('sono_qualidade')}/5 · humor: ${media('humor')}/5 · energia: ${media('energia')}/5 · fome: ${media('fome')}/5 (${be.length} registros). Treinos: ${tr.length}, sendo ${tr.filter((t) => t.forca).length} de força.`)
  }

  // rodapé em todas as páginas
  d.paginas.forEach((p, i) => {
    p.drawLine({ start: { x: 48, y: 58 }, end: { x: 547, y: 58 }, thickness: 0.5, color: VIOLETA })
    const rod = [
      'Dados registrados pelo paciente no Canetolino. Não é avaliação médica e não contém recomendação de dose.',
      'Nutrientes, conforme o alimento: TACO (NEPA/UNICAMP), TBCA (USP/FoRC), IBGE POF 2008-2009, USDA FoodData Central, CoFID 2021 (OGL v3.0),',
      'Ciqual 2025 (ANSES, Licence Ouverte 2.0), CNF 2026 (Health Canada), © FSANZ AFCD R3, © Frida 5.5 DTU e Fineli THL (CC BY 4.0).',
    ].map(limpar)
    rod.forEach((t, j) => p.drawText(t, { x: 48, y: 47 - j * 9, size: 6.8, font: d.f, color: CINZA }))
    p.drawText(`${i + 1}/${d.paginas.length}`, { x: 530, y: 47, size: 7, font: d.f, color: CINZA })
  })

  if (!proprio) await c.rpc('registrar_acesso', { p_paciente: pacienteId, p_acao: `Gerou relatório em PDF (${dias} dias)` })
  const bytes = await d.pdf.save()
  return new Response(new Blob([bytes as BlobPart], { type: "application/pdf" }), { headers: { ...CORS, 'Content-Type': 'application/pdf', 'Content-Disposition': `attachment; filename="canetolino-relatorio.pdf"` } })
})
