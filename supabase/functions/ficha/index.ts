// Canetolino · ficha completa do paciente em PDF (A4), com a cara do Canetolino e o Dose.
// Gerada no servidor para funcionar em qualquer aparelho (o iPhone não imprime direto de apps da tela de início).
// Lê com a sessão de quem pediu: o RLS decide o que entra.
//  - o próprio paciente: tudo, em qualquer plano;
//  - administrador: tudo (o acesso fica no histórico do paciente);
//  - profissional: só os módulos autorizados (o acesso fica no histórico do paciente).
// Linhas de tabela nunca quebram entre páginas; o cabeçalho da tabela se repete na página seguinte.
import { PDFDocument, StandardFonts, rgb, type PDFFont, type PDFImage, type PDFPage, type RGB } from 'npm:pdf-lib@1.17.1'
import { createClient } from 'npm:@supabase/supabase-js@2.119.0'

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}
const json = (corpo: unknown, status = 200) => new Response(JSON.stringify(corpo), { status, headers: { ...CORS, 'Content-Type': 'application/json' } })

const SITE = 'https://canetolino.com.br'
const ROXO = rgb(0.231, 0.102, 0.431)
const VIOLETA = rgb(0.424, 0.247, 0.769)
const VIOLETA_CLARO = rgb(0.576, 0.439, 0.878)
const TURQUESA = rgb(0.18, 0.769, 0.714)
const TEXTO = rgb(0.118, 0.059, 0.239)
const CINZA = rgb(0.369, 0.345, 0.451)
const LILAS = rgb(0.953, 0.933, 1)
const ZEBRA = rgb(0.98, 0.973, 1)
const BORDA = rgb(0.894, 0.859, 0.969)
const VERDE = rgb(0.118, 0.478, 0.373)
const VERDE_BG = rgb(0.886, 0.965, 0.937)
const BRANCO = rgb(1, 1, 1)
const W = 595.28, H = 841.89, M = 40, BASE = 54

const LOCAL: Record<string, string> = { 'Abdômen esq.': 'Abdômen esquerdo', 'Abdômen dir.': 'Abdômen direito', 'Coxa esq.': 'Coxa esquerda', 'Coxa dir.': 'Coxa direita', 'Braço esq.': 'Braço esquerdo', 'Braço dir.': 'Braço direito' }
const MEDIDA: Record<string, string> = { cintura: 'Cintura', abdomen: 'Abdômen', quadril: 'Quadril', peito: 'Peito', braco: 'Braço', coxa: 'Coxa', pescoco: 'Pescoço' }
const DIAS = ['domingo', 'segunda', 'terça', 'quarta', 'quinta', 'sexta', 'sábado']

const limpar = (t: unknown) =>
  String(t ?? '').replace(/−/g, '-').replace(/→/g, '->').replace(/[\u{1F000}-\u{1FFFF}\u{2600}-\u{27BF}\u{FE0F}]/gu, '').replace(/[^\x00-\xFF–—‘’“”•…€]/g, '')
const n1 = (v: number) => v.toLocaleString('pt-BR', { minimumFractionDigits: 1, maximumFractionDigits: 1 })
const FUSO = 'America/Sao_Paulo'
const data = (iso: string) => new Date(iso).toLocaleDateString('pt-BR', { timeZone: FUSO })
const dataHora = (iso: string) => new Date(iso).toLocaleString('pt-BR', { timeZone: FUSO, day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' }).replace(',', ' às')
const UNIDADE: Record<string, string> = { mg: 'mg', ml: 'mL', ui: 'UI', u: 'UI', unidades: 'UI', clique: 'cliques', cliques: 'cliques' }
function dose(t?: string | null) {
  const s = String(t ?? '').trim()
  const m = s.match(/^(\d+(?:[.,]\d+)?)\s*([a-zA-Z]+)?$/)
  const u = m ? (m[2] ? UNIDADE[m[2].toLowerCase()] : 'mg') : null
  return m && u ? `${m[1].replace('.', ',')} ${u}` : s || '-'
}
function imc(kg: number | null | undefined, alt: number | null | undefined) {
  if (!kg || !alt || alt < 100) return null
  const v = kg / (alt / 100) ** 2
  return { v, faixa: v < 18.5 ? 'abaixo do peso' : v < 25 ? 'peso adequado' : v < 30 ? 'sobrepeso' : v < 35 ? 'obesidade grau I' : v < 40 ? 'obesidade grau II' : 'obesidade grau III' }
}
const total = (v: number) => `${v < 0 ? '-' : v > 0 ? '+' : ''}${n1(Math.abs(v))} kg`

/* ---------------- desenho ---------------- */
type Col = { t: string; w: number; negrito?: boolean }
class Doc {
  pdf!: PDFDocument
  pg!: PDFPage
  f!: PDFFont
  b!: PDFFont
  y = 0
  static async criar() {
    const d = new Doc()
    d.pdf = await PDFDocument.create()
    d.f = await d.pdf.embedFont(StandardFonts.Helvetica)
    d.b = await d.pdf.embedFont(StandardFonts.HelveticaBold)
    d.nova()
    return d
  }
  nova() {
    this.pg = this.pdf.addPage([W, H])
    this.y = H - M
  }
  cabe(h: number) {
    if (this.y - h < BASE) {
      this.nova()
      return false
    }
    return true
  }
  /** Caixa de cantos arredondados; `topo` é a coordenada de cima. */
  caixa(x: number, topo: number, w: number, h: number, r: number, cor: RGB, borda?: RGB) {
    const p = `M ${r} 0 H ${w - r} Q ${w} 0 ${w} ${r} V ${h - r} Q ${w} ${h} ${w - r} ${h} H ${r} Q 0 ${h} 0 ${h - r} V ${r} Q 0 0 ${r} 0 Z`
    this.pg.drawSvgPath(p, { x, y: topo, color: cor, borderColor: borda, borderWidth: borda ? 0.8 : 0 })
  }
  txt(t: string, x: number, y: number, tam: number, o: { b?: boolean; cor?: RGB } = {}) {
    this.pg.drawText(limpar(t), { x, y, size: tam, font: o.b ? this.b : this.f, color: o.cor ?? TEXTO })
  }
  /** Quebra o texto na largura dada. */
  linhas(t: string, larg: number, tam: number, fonte = this.f) {
    const out: string[] = []
    for (const par of limpar(t).split('\n')) {
      let atual = ''
      for (const p of par.split(' ')) {
        const tenta = atual ? `${atual} ${p}` : p
        if (fonte.widthOfTextAtSize(tenta, tam) > larg && atual) {
          out.push(atual)
          atual = p
        } else atual = tenta
      }
      out.push(atual)
    }
    return out
  }
  paragrafo(t: string, tam = 9.5, cor = CINZA) {
    for (const l of this.linhas(t, W - 2 * M, tam)) {
      this.cabe(tam + 4)
      this.txt(l, M, this.y - tam, tam, { cor })
      this.y -= tam + 4
    }
    this.y -= 2
  }
  secao(t: string) {
    this.cabe(60)
    this.y -= 14
    this.pg.drawRectangle({ x: M, y: this.y - 16, width: 3.5, height: 17, color: TURQUESA })
    this.txt(t, M + 11, this.y - 13, 13.5, { b: true, cor: ROXO })
    this.y -= 26
  }
  vazio(t: string) {
    this.cabe(16)
    this.txt(t, M, this.y - 10, 9.5, { cor: CINZA })
    this.y -= 18
  }
  /** Tabela: cada linha inteira numa página; cabeçalho repetido na página seguinte. */
  tabela(cols: Col[], dados: string[][]) {
    const tam = 8.6, lh = 10.6, pad = 5
    const cab = () => {
      this.cabe(18 + 22)
      let x = M
      for (const c of cols) {
        this.txt(c.t.toUpperCase(), x + pad, this.y - 11, 7, { b: true, cor: CINZA })
        x += c.w
      }
      this.pg.drawLine({ start: { x: M, y: this.y - 16 }, end: { x: M + cols.reduce((a, c) => a + c.w, 0), y: this.y - 16 }, thickness: 1.1, color: BORDA })
      this.y -= 18
    }
    cab()
    const largura = cols.reduce((a, c) => a + c.w, 0)
    dados.forEach((linha, i) => {
      const quebras = linha.map((cel, j) => this.linhas(cel, cols[j].w - 2 * pad, tam, cols[j].negrito ? this.b : this.f).slice(0, 4))
      const h = Math.max(...quebras.map((q) => q.length)) * lh + 7
      if (this.y - h < BASE) {
        this.nova()
        cab()
      }
      if (i % 2) this.pg.drawRectangle({ x: M, y: this.y - h, width: largura, height: h, color: ZEBRA })
      let x = M
      quebras.forEach((q, j) => {
        q.forEach((l, k) => this.txt(l, x + pad, this.y - 10 - k * lh, tam, { b: cols[j].negrito }))
        x += cols[j].w
      })
      this.pg.drawLine({ start: { x: M, y: this.y - h }, end: { x: M + largura, y: this.y - h }, thickness: 0.5, color: BORDA })
      this.y -= h
    })
    this.y -= 6
  }
  /** Curva do peso semana a semana. */
  grafico(pontos: number[], semanaFinal: number) {
    if (pontos.length < 2) return
    const gw = 300, gh = 110
    this.cabe(gh + 20)
    const x0 = M, topo = this.y, px = 12, pyT = 20, pyB = 20
    const min = Math.min(...pontos), max = Math.max(...pontos), faixa = Math.max(0.5, max - min)
    const xy = pontos.map((v, i) => [x0 + px + (i * (gw - 2 * px)) / (pontos.length - 1), topo - pyT - ((max - v) / faixa) * (gh - pyT - pyB)] as const)
    this.pg.drawLine({ start: { x: x0 + px, y: topo - gh + pyB }, end: { x: x0 + gw - px, y: topo - gh + pyB }, thickness: 1, color: BORDA })
    for (let i = 1; i < xy.length; i++) this.pg.drawLine({ start: { x: xy[i - 1][0], y: xy[i - 1][1] }, end: { x: xy[i][0], y: xy[i][1] }, thickness: 2.4, color: VIOLETA })
    xy.forEach(([x, y], i) => this.pg.drawCircle({ x, y, size: i === xy.length - 1 ? 4 : 2.2, color: i === xy.length - 1 ? ROXO : VIOLETA_CLARO, borderColor: BRANCO, borderWidth: 1 }))
    this.txt(n1(pontos[0]), xy[0][0], xy[0][1] + 7, 8.5, { b: true, cor: CINZA })
    const ult = n1(pontos[pontos.length - 1])
    this.txt(ult, xy[xy.length - 1][0] - this.b.widthOfTextAtSize(ult, 9), xy[xy.length - 1][1] + 8, 9, { b: true, cor: ROXO })
    this.txt('sem 1', x0 + px, topo - gh + 6, 7.5, { cor: CINZA })
    this.txt(`sem ${semanaFinal}`, x0 + gw - px - this.f.widthOfTextAtSize(`sem ${semanaFinal}`, 7.5), topo - gh + 6, 7.5, { cor: CINZA })
    this.y -= gh + 6
  }
}

async function imagem(pdf: PDFDocument, url: string): Promise<PDFImage | null> {
  try {
    const r = await fetch(url)
    if (!r.ok) return null
    const bytes = new Uint8Array(await r.arrayBuffer())
    return bytes[0] === 0x89 ? await pdf.embedPng(bytes) : await pdf.embedJpg(bytes)
  } catch {
    return null
  }
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { status: 204, headers: CORS })
  if (req.method !== 'POST') return json({ erro: 'metodo' }, 405)
  const auth = req.headers.get('Authorization') ?? ''
  const c = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_ANON_KEY')!, { global: { headers: { Authorization: auth } }, auth: { persistSession: false } })
  const { data: u } = await c.auth.getUser(auth.replace(/^Bearer\s+/i, ''))
  if (!u.user) return json({ erro: 'nao_autenticado' }, 401)
  const corpo = await req.json().catch(() => ({}))
  const pacienteId: string = corpo.paciente_id || u.user.id
  const proprio = pacienteId === u.user.id

  // quem pode: o próprio, o administrador ou o profissional autorizado
  let modulos = ['peso', 'nutricao', 'aplicacoes', 'sintomas', 'bemestar']
  let perfil: Record<string, unknown> = {}
  let origem = 'pelo próprio paciente'
  if (proprio) {
    perfil = (await c.from('profiles').select('*').eq('user_id', pacienteId).maybeSingle()).data ?? {}
  } else {
    const { data: admin } = await c.rpc('eh_admin')
    if (admin === true) {
      perfil = (await c.from('profiles').select('*').eq('user_id', pacienteId).maybeSingle()).data ?? {}
      origem = 'pela equipe Canetolino'
      await c.rpc('admin_registrar_acesso', { p_paciente: pacienteId, p_acao: 'Gerou a ficha em PDF (painel administrativo)' })
    } else {
      const { data: lista } = await c.rpc('pacientes_do_profissional')
      const l = (lista ?? []).find((x: { paciente_id: string }) => x.paciente_id === pacienteId)
      if (!l) return json({ erro: 'sem_acesso' }, 403)
      modulos = l.modulos
      perfil = { nome: l.nome, peso_inicial_kg: l.peso_inicial_kg, altura_cm: l.altura_cm, meta_proteina_g: l.meta_proteina_g, meta_agua_ml: l.meta_agua_ml }
      const { data: pr } = await c.from('professionals').select('nome').maybeSingle()
      origem = `por ${pr?.nome ?? 'profissional autorizado'}`
      await c.rpc('registrar_acesso', { p_paciente: pacienteId, p_acao: 'Gerou a ficha completa em PDF' })
    }
  }
  const tem = (m: string) => modulos.includes(m)
  const ler = async (t: string, campo: string, sel = '*') => ((await c.from(t).select(sel).eq('user_id', pacienteId).order(campo)).data ?? []) as Record<string, any>[]

  const [apl, pesos, medidas, refeicoes, agua, sintomas, bem, treinos, med, presc, sched, canetas, compras, fotosDb] = await Promise.all([
    tem('aplicacoes') ? ler('applications', 'aplicado_em') : [],
    tem('peso') ? ler('weight_records', 'registrado_em') : [],
    tem('peso') ? ler('measurements', 'registrado_em') : [],
    tem('nutricao') ? ler('meals', 'horario') : [],
    tem('nutricao') ? ler('hydration_records', 'registrado_em') : [],
    tem('sintomas') ? ler('symptoms', 'registrado_em') : [],
    tem('bemestar') ? ler('wellbeing_records', 'registrado_em') : [],
    tem('bemestar') ? ler('workouts', 'registrado_em') : [],
    tem('aplicacoes') ? ler('medications', 'created_at') : [],
    tem('aplicacoes') ? ler('prescriptions', 'id') : [],
    tem('aplicacoes') ? ler('application_schedules', 'id') : [],
    proprio || origem.startsWith('pela equipe') ? ler('pen_inventory', 'id') : [],
    proprio || origem.startsWith('pela equipe') ? ler('pen_purchases', 'data') : [],
    proprio || origem.startsWith('pela equipe') ? ler('progress_photos', 'registrado_em') : [],
  ])
  const itens = refeicoes.length ? (((await c.from('meal_items').select('*').in('meal_id', refeicoes.map((r) => r.id))).data ?? []) as Record<string, any>[]) : []

  const d = await Doc.criar()
  const dose1 = await imagem(d.pdf, `${SITE}/dose-feliz.png`)
  const dose2 = await imagem(d.pdf, `${SITE}/dose-piscando.png`)

  /* ----- cabeçalho ----- */
  const topo = H - M
  d.caixa(M, topo, W - 2 * M, 104, 16, ROXO)
  d.pg.drawCircle({ x: W - M - 62, y: topo - 52, size: 42, color: VIOLETA, opacity: 0.55 })
  if (dose1) d.pg.drawImage(dose1, { x: W - M - 88, y: topo - 92, width: 52, height: 75 })
  d.txt('canetolino', M + 20, topo - 28, 12.5, { b: true, cor: TURQUESA })
  d.txt('Ficha do paciente', M + 20, topo - 56, 22, { b: true, cor: BRANCO })
  d.txt(`${perfil.nome || 'Paciente'}${perfil.email ? ` · ${perfil.email}` : ''}`, M + 20, topo - 74, 10, { cor: rgb(0.86, 0.81, 0.97) })
  d.txt(`Gerada em ${dataHora(new Date().toISOString())} ${origem} · dados de saúde, uso restrito (LGPD)`, M + 20, topo - 90, 7.8, { cor: rgb(0.78, 0.72, 0.95) })
  d.y = topo - 104 - 12

  /* ----- cadastro ----- */
  const alt = Number(perfil.altura_cm ?? 0) || null
  const nasc = perfil.data_nascimento ? new Date(`${perfil.data_nascimento}T12:00:00Z`) : null
  const idade = nasc ? Math.floor((Date.now() - +nasc) / (365.25 * 86400000)) : null
  // peso inicial: o do cadastro (na data de início) ou a pesagem mais antiga, o que vier antes
  let inicial = pesos[0] ? { kg: Number(pesos[0].peso_kg), em: pesos[0].registrado_em as string } : null
  const pIni = Number(perfil.peso_inicial_kg ?? 0)
  if (pIni > 0) {
    const dc = perfil.inicio_tratamento ? `${perfil.inicio_tratamento}T12:00:00Z` : null
    if (!inicial) inicial = { kg: pIni, em: dc ?? new Date().toISOString() }
    else if (dc && +new Date(dc) < +new Date(inicial.em) - 12 * 3600000) inicial = { kg: pIni, em: dc }
  }
  const atual = pesos.length ? { kg: Number(pesos[pesos.length - 1].peso_kg), em: pesos[pesos.length - 1].registrado_em as string } : null
  const variacao = inicial && atual && +new Date(atual.em) > +new Date(inicial.em) ? atual.kg - inicial.kg : null
  const campos: [string, string][] = [
    ['Idade', idade !== null ? `${idade} anos` : '-'],
    ['Altura', alt ? `${(alt / 100).toFixed(2).replace('.', ',')} m` : '-'],
    ['Jornada', perfil.jornada === 'em_tratamento' ? 'Já em tratamento' : perfil.jornada === 'comecando' ? 'Começando' : '-'],
    ['Início do tratamento', inicial ? data(inicial.em) : '-'],
    ['Plano', perfil.plano === 'premium' ? 'Premium' : perfil.plano ? 'Básico' : '-'],
    ['Meta de peso', perfil.meta_peso_kg ? `${n1(Number(perfil.meta_peso_kg))} kg` : '-'],
    ['Proteína por dia', perfil.meta_proteina_g ? `${perfil.meta_proteina_g} g` : '-'],
    ['Água por dia', perfil.meta_agua_ml ? `${n1(Number(perfil.meta_agua_ml) / 1000)} L` : '-'],
  ]
  d.caixa(M, d.y, W - 2 * M, 66, 12, BRANCO, BORDA)
  const cw = (W - 2 * M) / 4
  campos.forEach(([r, v], i) => {
    const x = M + 14 + (i % 4) * cw, y = d.y - 18 - Math.floor(i / 4) * 28
    d.txt(r, x, y, 7.5, { cor: CINZA })
    d.txt(v, x, y - 11, 10, { b: true })
  })
  d.y -= 66 + 10

  /* ----- destaques ----- */
  const i1 = imc(atual?.kg, alt), i0 = imc(inicial?.kg, alt)
  const kpis: { r: string; v: string; s: string; bom?: boolean }[] = [
    { r: 'Peso atual', v: atual ? `${n1(atual.kg)} kg` : '-', s: atual ? data(atual.em) : 'sem pesagem' },
    { r: 'Desde o início', v: variacao !== null ? total(variacao) : '-', s: inicial ? `${n1(inicial.kg)} kg em ${data(inicial.em)}` : '', bom: variacao !== null && variacao < 0 },
    { r: 'IMC', v: i1 ? n1(i1.v) : '-', s: i1 ? `${i1.faixa}${i0 ? ` · início ${n1(i0.v)}` : ''}` : 'sem altura ou peso' },
    { r: 'Aplicações', v: String(apl.length), s: apl.length ? `última em ${data(apl[apl.length - 1].aplicado_em)}` : tem('aplicacoes') ? 'nenhuma' : 'não autorizado' },
  ]
  const kw = (W - 2 * M - 3 * 8) / 4
  kpis.forEach((k, i) => {
    const x = M + i * (kw + 8)
    d.caixa(x, d.y, kw, 58, 12, k.bom ? VERDE_BG : LILAS)
    d.txt(k.r, x + 10, d.y - 14, 7.5, { cor: CINZA })
    d.txt(k.v, x + 10, d.y - 33, 16, { b: true, cor: k.bom ? VERDE : ROXO })
    d.linhas(k.s, kw - 20, 7).slice(0, 2).forEach((l, j) => d.txt(l, x + 10, d.y - 45 - j * 8.5, 7, { cor: CINZA }))
  })
  d.y -= 58 + 4

  /* ----- aplicações ----- */
  if (tem('aplicacoes')) {
    d.secao('Medicamento e aplicações')
    const m = med.find((x) => x.status === 'ativo') ?? med[0]
    if (m) {
      const p = presc.find((x) => x.medication_id === m.id), h = sched.find((x) => x.medication_id === m.id)
      d.paragrafo(`${m.principio_ativo}${m.nome_comercial ? ` (${m.nome_comercial})` : ''} · dose da receita: ${dose(p?.dose_texto)}${h ? ` · aplicação ${DIAS[h.dia_semana]}, às ${String(h.horario).slice(0, 5)}` : ''}. O Canetolino não calcula nem sugere doses.`)
    }
    if (apl.length)
      d.tabela(
        [{ t: 'Nº', w: 34, negrito: true }, { t: 'Data', w: 118 }, { t: 'Dose', w: 62 }, { t: 'Local', w: 118 }, { t: 'Observação', w: W - 2 * M - 332 }],
        apl.map((a, i) => [`${i + 1}ª`, dataHora(a.aplicado_em), a.dose_texto ? dose(a.dose_texto) : '-', a.local ? LOCAL[a.local] ?? a.local : 'não informado', [a.observacao, a.retroativo ? 'registrada depois' : ''].filter(Boolean).join(' · ')]),
      )
    else d.vazio('Nenhuma aplicação registrada.')
  }

  /* ----- peso e medidas ----- */
  if (tem('peso')) {
    d.secao('Peso e medidas')
    if (inicial && pesos.length) {
      const porSemana = new Map<number, number>([[1, inicial.kg]])
      for (const p of pesos) {
        const n = Math.floor((+new Date(p.registrado_em) - +new Date(inicial.em)) / (7 * 86400000)) + 1
        if (n > 1) porSemana.set(n, Number(p.peso_kg))
      }
      const sem = [...porSemana.keys()].sort((a, b) => a - b)
      d.grafico(sem.map((n) => porSemana.get(n)!), sem[sem.length - 1])
    }
    if (pesos.length)
      d.tabela([{ t: 'Data', w: 110 }, { t: 'Peso', w: 80, negrito: true }, { t: 'IMC', w: 60 }, { t: '', w: 130 }], pesos.map((p) => { const i = imc(Number(p.peso_kg), alt); return [data(p.registrado_em), `${n1(Number(p.peso_kg))} kg`, i ? n1(i.v) : '-', p.retroativo ? 'registrado depois' : ''] }))
    else d.vazio('Nenhuma pesagem registrada.')
    if (medidas.length) d.tabela([{ t: 'Data', w: 110 }, { t: 'Medida', w: 110 }, { t: 'cm', w: 60, negrito: true }], medidas.map((m) => [data(m.registrado_em), MEDIDA[m.tipo] ?? m.tipo, n1(Number(m.medida_cm))]))
  }

  /* ----- alimentação ----- */
  if (tem('nutricao')) {
    d.secao('Alimentação e água')
    if (refeicoes.length)
      d.tabela(
        [{ t: 'Quando', w: 104 }, { t: 'Refeição', w: W - 2 * M - 104 - 60 - 66 }, { t: 'Proteína', w: 60 }, { t: 'Origem', w: 66 }],
        [...refeicoes].reverse().map((r) => {
          const its = itens.filter((i) => i.meal_id === r.id)
          return [dataHora(r.horario), `${r.tipo ?? 'Refeição'}: ${its.map((i) => `${i.nome} (${i.porcao_texto ?? `${i.porcao_g} g`})`).join(', ')}`, `${Math.round(its.reduce((a, i) => a + Number(i.proteina_g), 0))} g`, r.origem === 'ia_estimativa' ? 'IA, conferido' : 'manual']
        }),
      )
    else d.vazio('Nenhuma refeição registrada.')
    if (agua.length) {
      const dia = new Map<string, number>()
      for (const a of agua) dia.set(data(a.registrado_em), (dia.get(data(a.registrado_em)) ?? 0) + a.ml)
      d.paragrafo(`Água por dia: ${[...dia].map(([k, v]) => `${k} ${n1(v / 1000)} L`).join(' · ')}`, 8.5)
    }
  }

  /* ----- sintomas ----- */
  if (tem('sintomas')) {
    d.secao('Sintomas')
    if (sintomas.length) d.tabela([{ t: 'Quando', w: 110 }, { t: 'Sintomas', w: 170 }, { t: 'Intensidade', w: 70 }, { t: 'Observação', w: W - 2 * M - 350 }], [...sintomas].reverse().map((x) => [dataHora(x.registrado_em), (x.sintomas as string[]).join(', '), `${x.intensidade}/5`, [x.alerta_disparado ? 'alerta mostrado ao paciente' : '', x.observacao].filter(Boolean).join(' · ')]))
    else d.vazio('Nenhum sintoma registrado.')
  }

  /* ----- bem-estar e treinos ----- */
  if (tem('bemestar') && (bem.length || treinos.length)) {
    d.secao('Bem-estar, sono e treinos')
    d.tabela(
      [{ t: 'Data', w: 90 }, { t: 'Registro', w: W - 2 * M - 90 - 130 }, { t: 'Observação', w: 130 }],
      [
        ...[...bem].reverse().map((b) => [data(b.registrado_em), `Sono ${b.sono_horas ?? '-'} h · qualidade ${b.sono_qualidade ?? '-'}/5 · humor ${b.humor ?? '-'}/5 · energia ${b.energia ?? '-'}/5 · fome ${b.fome ?? '-'}/5`, b.observacao ?? '']),
        ...[...treinos].reverse().map((t) => [data(t.registrado_em), `Treino: ${t.tipo} · ${t.duracao_min} min${t.forca ? ' · força' : ''}`, '']),
      ],
    )
  }

  /* ----- canetas ----- */
  if (canetas.length || compras.length) {
    d.secao('Canetas e gastos')
    d.tabela([{ t: '', w: 110 }, { t: '', w: 260 }], [
      ...canetas.map((k) => ['Estoque', `${k.quantidade} caneta(s) · validade ${k.validade || '-'}`]),
      ...compras.map((k) => [data(k.data), `Compra de ${k.quantidade} · ${(k.valor_centavos / 100).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}`]),
    ])
  }

  /* ----- fotos ----- */
  if (fotosDb.length) {
    d.secao('Fotos de evolução')
    const fotos = fotosDb.slice(-15)
    const { data: urls } = await c.storage.from('evolucao').createSignedUrls(fotos.map((f) => f.caminho), 300)
    const fw = 92, fh = 122, gap = 10
    let col = 0
    for (const [i, f] of fotos.entries()) {
      const img = urls?.[i]?.signedUrl ? await imagem(d.pdf, urls[i].signedUrl) : null
      if (!img) continue
      if (col === 0 && !d.cabe(fh + 18)) col = 0
      const x = M + col * (fw + gap)
      const esc = Math.min(fw / img.width, fh / img.height) // inteira dentro do quadro
      d.pg.drawRectangle({ x, y: d.y - fh, width: fw, height: fh, color: LILAS })
      d.pg.drawImage(img, { x: x + (fw - img.width * esc) / 2, y: d.y - fh + (fh - img.height * esc) / 2, width: img.width * esc, height: img.height * esc })
      d.txt(`${String(f.angulo).replace(/^./, (s: string) => s.toUpperCase())} · ${data(f.registrado_em)}`, x, d.y - fh - 10, 7.2, { cor: CINZA })
      col++
      if (col === 5) {
        col = 0
        d.y -= fh + 18
      }
    }
    if (col) d.y -= fh + 18
  }

  /* ----- encerramento ----- */
  d.cabe(50)
  d.y -= 10
  d.caixa(M, d.y, W - 2 * M, 40, 12, LILAS)
  if (dose2) d.pg.drawImage(dose2, { x: M + 10, y: d.y - 36, width: 22, height: 32 })
  d.linhas('Dados registrados pelo próprio paciente no Canetolino. Não é avaliação médica e não contém recomendação de dose. IMC é referência populacional, não diagnóstico.', W - 2 * M - 60, 8).forEach((l, j) => d.txt(l, M + 42, d.y - 16 - j * 10, 8, { cor: CINZA }))

  /* ----- rodapé em todas as páginas ----- */
  const paginas = d.pdf.getPages()
  paginas.forEach((p, i) => {
    p.drawLine({ start: { x: M, y: 40 }, end: { x: W - M, y: 40 }, thickness: 0.5, color: BORDA })
    p.drawText('canetolino · canetolino.com.br · ficha do paciente', { x: M, y: 28, size: 7.5, font: d.f, color: CINZA })
    const t = `página ${i + 1} de ${paginas.length}`
    p.drawText(t, { x: W - M - d.f.widthOfTextAtSize(t, 7.5), y: 28, size: 7.5, font: d.f, color: CINZA })
  })

  const bytes = await d.pdf.save()
  return new Response(new Blob([bytes as BlobPart], { type: 'application/pdf' }), { headers: { ...CORS, 'Content-Type': 'application/pdf', 'Content-Disposition': 'attachment; filename="canetolino-ficha.pdf"' } })
})
