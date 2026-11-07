import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import { DIA_MS, diasEntre, ehHoje, inicioDoDia, mesmoDia, uid } from '../lib/datas'
import { foodById, VERSAO_TABELA } from './foods'

/* ============================ Tipos (espelham o modelo de dados do descritivo) ============================ */
export type Origem = 'manual' | 'ia_estimativa' | 'integracao'
export const LOCAIS = ['Abdômen esq.', 'Abdômen dir.', 'Coxa esq.', 'Coxa dir.', 'Braço esq.', 'Braço dir.'] as const
export type Local = (typeof LOCAIS)[number]
export const LOCAL_LONGO: Record<Local, string> = {
  'Abdômen esq.': 'Abdômen esquerdo',
  'Abdômen dir.': 'Abdômen direito',
  'Coxa esq.': 'Coxa esquerda',
  'Coxa dir.': 'Coxa direita',
  'Braço esq.': 'Braço esquerdo',
  'Braço dir.': 'Braço direito',
}
export const PRINCIPIOS = ['Tirzepatida', 'Semaglutida', 'Liraglutida', 'Outro'] as const
export const MODULOS = [
  { id: 'peso', nome: 'Peso e medidas' },
  { id: 'nutricao', nome: 'Alimentação e proteína' },
  { id: 'aplicacoes', nome: 'Aplicações' },
  { id: 'sintomas', nome: 'Sintomas' },
  { id: 'bemestar', nome: 'Bem-estar e sono' },
] as const
export type Modulo = (typeof MODULOS)[number]['id']
export const SINTOMAS = ['Enjoo', 'Constipação', 'Diarreia', 'Azia', 'Cansaço', 'Dor de cabeça', 'Dor abdominal forte', 'Vômitos que não passam'] as const
/** Regra fixa, sem IA (seção 4.7). Lista a ser revisada por médico antes do lançamento. */
export const SINTOMAS_ALERTA = ['Dor abdominal forte', 'Vômitos que não passam']

export type ItemRefeicao = { foodId: string; nome: string; porcao_g: number; porcao_texto: string; proteina_g: number; energia_kcal: number; origem: Origem }
export type Refeicao = { id: string; tipo: string; em: string; itens: ItemRefeicao[]; origem: Origem; versao_tabela: string; foto?: string }
export type Aplicacao = { id: string; em: string; local: Local; obs?: string }
export type Agua = { id: string; ml: number; em: string }
export type Peso = { id: string; kg: number; em: string }
export type Sintoma = { id: string; em: string; sintomas: string[]; intensidade: number; obs?: string; alerta: boolean }
export type Treino = { id: string; em: string; tipo: string; duracao_min: number; forca: boolean }
export type Caneta = { id: string; nome: string; lote: string; validade: string; quantidade: number }
export type Compra = { id: string; em: string; valor_centavos: number; quantidade: number }
export type Compartilhamento = {
  id: string
  profissionalId: string
  nome: string
  profissao: string
  registro: string
  modulos: Modulo[]
  expira_em: string | null
  criado_em: string
  revogado_em: string | null
  finalidade: string
}
export type Consentimento = { id: string; tipo: 'termos' | 'ia' | 'compartilhamento' | 'integracao'; versao: string; em: string; detalhe?: string }
export type Auditoria = { id: string; ator: string; acao: string; em: string }

export type Estado = {
  versao: 1
  sessao: boolean
  onboardingFeito: boolean
  perfil: {
    nome: string
    nascimento: string
    altura_cm: number
    peso_inicial_kg: number
    meta_peso_kg: number
    meta_proteina_g: number
    meta_agua_ml: number
    preferencias: string[]
    plano: 'gratuito' | 'premium'
    email: string
  }
  medicamento: { principio: string; nome_comercial: string; dia_semana: number; horario: string; dose_texto: string } | null
  aplicacoes: Aplicacao[]
  agua: Agua[]
  refeicoes: Refeicao[]
  pesos: Peso[]
  sintomas: Sintoma[]
  treinos: Treino[]
  canetas: Caneta[]
  compras: Compra[]
  compartilhamentos: Compartilhamento[]
  consentimentos: Consentimento[]
  auditoria: Auditoria[]
  config: { notificacoesDiscretas: boolean; ia: boolean; fotosLocal: boolean; lembreteHora: string; lembretesAgua: boolean }
}

/* ============================ Profissionais conhecidos (códigos de convite) ============================ */
export const PROFISSIONAIS: Record<string, { id: string; nome: string; profissao: string; registro: string; iniciais: string; pronome: 'ela' | 'ele' }> = {
  'ANA-4821': { id: 'ana', nome: 'Dra. Ana Souza', profissao: 'Nutricionista', registro: 'CRN-3 48213', iniciais: 'AS', pronome: 'ela' },
  'RAF-1020': { id: 'rafael', nome: 'Dr. Rafael Lima', profissao: 'Endocrinologista', registro: 'CRM-SP 102030', iniciais: 'RL', pronome: 'ele' },
}

/* ============================ Estados iniciais ============================ */
const vazio = (): Estado => ({
  versao: 1,
  sessao: false,
  onboardingFeito: false,
  perfil: { nome: '', nascimento: '', altura_cm: 0, peso_inicial_kg: 0, meta_peso_kg: 0, meta_proteina_g: 100, meta_agua_ml: 2000, preferencias: [], plano: 'gratuito', email: '' },
  medicamento: null,
  aplicacoes: [],
  agua: [],
  refeicoes: [],
  pesos: [],
  sintomas: [],
  treinos: [],
  canetas: [],
  compras: [],
  compartilhamentos: [],
  consentimentos: [],
  auditoria: [],
  config: { notificacoesDiscretas: true, ia: true, fotosLocal: true, lembreteHora: '08:00', lembretesAgua: true },
})

const item = (foodId: string, g?: number, origem: Origem = 'manual'): ItemRefeicao => {
  const f = foodById(foodId)
  const porcao = g ?? f.porcaoPadrao.g
  return {
    foodId,
    nome: f.nome,
    porcao_g: porcao,
    porcao_texto: g && g !== f.porcaoPadrao.g ? `${g} g` : f.porcaoPadrao.texto,
    proteina_g: +((f.proteina_100g * porcao) / 100).toFixed(1),
    energia_kcal: Math.round((f.energia_100g * porcao) / 100),
    origem,
  }
}

/** Dados de demonstração: Jessica, 12ª semana de tratamento. Números são exemplos. */
export function demo(): Estado {
  const hoje = inicioDoDia()
  const em = (diasAtras: number, h: number, m = 0) => {
    const d = new Date(hoje.getTime() - diasAtras * DIA_MS)
    d.setHours(h, m, 0, 0)
    return d.toISOString()
  }
  // último domingo (ou hoje, se domingo e já passou das 8h — mantemos simples: domingo anterior)
  const diasAteUltimoDomingo = hoje.getDay() === 0 ? 7 : hoje.getDay()
  const ultDom = diasAteUltimoDomingo
  const locais: Local[] = ['Abdômen dir.', 'Abdômen esq.', 'Coxa dir.', 'Braço dir.', 'Braço esq.', 'Coxa esq.']
  const aplicacoes: Aplicacao[] = locais.map((local, i) => ({ id: uid(), em: em(ultDom + i * 7, 8, 5), local }))

  const pesosKg = [88.5, 87.6, 86.9, 86.0, 85.2, 84.5, 83.6, 82.4]
  const pesos: Peso[] = pesosKg.map((kg, i) => ({ id: uid(), kg, em: em((7 - i) * 7, 7, 30) }))

  const refeicoes: Refeicao[] = [
    { id: uid(), tipo: 'Café da manhã', em: em(0, 8, 10), origem: 'manual', versao_tabela: VERSAO_TABELA, itens: [item('ovo'), item('pao'), item('queijo')] },
    { id: uid(), tipo: 'Almoço', em: em(0, 12, 40), origem: 'ia_estimativa', versao_tabela: VERSAO_TABELA, itens: [item('frango', undefined, 'ia_estimativa'), item('feijao', undefined, 'ia_estimativa'), item('arroz', undefined, 'ia_estimativa'), item('salada', undefined, 'ia_estimativa')] },
  ]
  // dias anteriores: proteína ~ 85-110 g
  const diasAnteriores: [string, number][][] = [
    [['whey', 30], ['frango', 170], ['iogurte', 170], ['ovo', 100]],
    [['patinho', 150], ['ovo', 100], ['leite', 200], ['whey', 30]],
    [['peixe', 150], ['iogurte', 170], ['whey', 30], ['frango', 100]],
    [['frango', 120], ['ovo', 50], ['feijao', 86], ['arroz', 75]],
    [['patinho', 145], ['whey', 30], ['iogurte', 170], ['ovo', 100]],
    [['frango', 175], ['queijo', 60], ['leite', 200], ['whey', 30]],
  ]
  diasAnteriores.forEach((itens, i) => {
    refeicoes.push({ id: uid(), tipo: 'Dia (resumo)', em: em(i + 1, 13), origem: 'manual', versao_tabela: VERSAO_TABELA, itens: itens.map(([f, g]) => item(f, g)) })
  })

  const agua: Agua[] = [
    { id: uid(), ml: 500, em: em(0, 9) },
    { id: uid(), ml: 450, em: em(0, 11) },
    { id: uid(), ml: 250, em: em(0, 14) },
  ]
  ;[2100, 1500, 2000, 2250, 1700, 2000].forEach((ml, i) => agua.push({ id: uid(), ml, em: em(i + 1, 18) }))

  return {
    ...vazio(),
    sessao: true,
    onboardingFeito: true,
    perfil: { nome: 'Jessica', nascimento: '1990-04-12', altura_cm: 166, peso_inicial_kg: 88.5, meta_peso_kg: 72, meta_proteina_g: 100, meta_agua_ml: 2000, preferencias: ['Sem lactose (às vezes)', 'Gosto de comida caseira'], plano: 'gratuito', email: 'jessica@exemplo.com' },
    medicamento: { principio: 'Tirzepatida', nome_comercial: 'Conforme a caixa', dia_semana: 0, horario: '08:00', dose_texto: 'conforme sua prescrição' },
    aplicacoes,
    pesos,
    refeicoes,
    agua,
    sintomas: [{ id: uid(), em: em(ultDom - 1, 10), sintomas: ['Enjoo'], intensidade: 2, obs: 'Passou depois do almoço', alerta: false }],
    treinos: [
      { id: uid(), em: em(2, 19), tipo: 'Musculação', duracao_min: 45, forca: true },
      { id: uid(), em: em(4, 19), tipo: 'Musculação', duracao_min: 40, forca: true },
      { id: uid(), em: em(5, 7), tipo: 'Caminhada', duracao_min: 30, forca: false },
    ],
    canetas: [{ id: uid(), nome: 'Caneta (caixa atual)', lote: 'L2026-118', validade: '2027-03', quantidade: 2 }],
    compras: [{ id: uid(), em: em(12, 15), valor_centavos: 0, quantidade: 2 }],
    compartilhamentos: [
      { id: uid(), profissionalId: 'ana', nome: 'Dra. Ana Souza', profissao: 'Nutricionista', registro: 'CRN-3 48213', modulos: ['peso', 'nutricao'], expira_em: '2026-12-31T23:59:59.000Z', criado_em: em(40, 10), revogado_em: null, finalidade: 'Acompanhamento nutricional' },
    ],
    consentimentos: [
      { id: uid(), tipo: 'termos', versao: 'termos-v1.0', em: em(84, 9) },
      { id: uid(), tipo: 'ia', versao: 'ia-v1.0', em: em(84, 9) },
      { id: uid(), tipo: 'compartilhamento', versao: 'share-v1.0', em: em(40, 10), detalhe: 'Dra. Ana Souza · peso, nutrição' },
    ],
    auditoria: [{ id: uid(), ator: 'Dra. Ana Souza', acao: 'Abriu o resumo semanal', em: em(1, 16, 20) }],
  }
}

/* ============================ Regras de negócio ============================ */
export function proximaAplicacao(s: Estado): Date | null {
  if (!s.medicamento) return null
  const [h, m] = s.medicamento.horario.split(':').map(Number)
  const hoje = inicioDoDia()
  const delta = (s.medicamento.dia_semana - hoje.getDay() + 7) % 7
  const d = new Date(hoje.getTime() + delta * DIA_MS)
  // se já houve aplicação nesse dia (ou nos últimos 3 dias, aplicação adiantada), vai para a semana seguinte
  const jaAplicou = s.aplicacoes.some((a) => Math.abs(diasEntre(a.em, d)) <= 3 && diasEntre(a.em, d) >= 0)
  const alvo = jaAplicou ? new Date(d.getTime() + 7 * DIA_MS) : d
  alvo.setHours(h, m, 0, 0)
  return alvo
}

/** Sugestão de local: o menos usado nas últimas 4 aplicações (regra fixa, sem IA). */
export function sugerirLocal(aplicacoes: Aplicacao[]): Local {
  const ult = [...aplicacoes].sort((a, b) => +new Date(b.em) - +new Date(a.em)).slice(0, 4)
  let melhor: Local = LOCAIS[0]
  let menor = Infinity
  for (const l of LOCAIS) {
    const usos = ult.filter((a) => a.local === l).length
    if (usos < menor) {
      menor = usos
      melhor = l
    }
  }
  return melhor
}

export const proteinaDoDia = (s: Estado, dia: Date | string = new Date()) =>
  s.refeicoes.filter((r) => mesmoDia(r.em, dia)).reduce((t, r) => t + r.itens.reduce((a, i) => a + i.proteina_g, 0), 0)
export const aguaDoDia = (s: Estado, dia: Date | string = new Date()) =>
  s.agua.filter((r) => mesmoDia(r.em, dia)).reduce((t, r) => t + r.ml, 0)
export const ultimoPeso = (s: Estado) => [...s.pesos].sort((a, b) => +new Date(b.em) - +new Date(a.em))[0]
export const compartilhamentoAtivo = (c: Compartilhamento) =>
  !c.revogado_em && (!c.expira_em || new Date(c.expira_em).getTime() > Date.now())

export function semana(s: Estado) {
  const hoje = inicioDoDia()
  const dias = Array.from({ length: 7 }, (_, i) => new Date(hoje.getTime() - (6 - i) * DIA_MS))
  const proteinas = dias.map((d) => proteinaDoDia(s, d))
  const comRefeicao = proteinas.filter((p) => p > 0)
  const aguas = dias.map((d) => aguaDoDia(s, d))
  const diasComRegistro = dias.filter(
    (d) =>
      proteinaDoDia(s, d) > 0 ||
      aguaDoDia(s, d) > 0 ||
      s.pesos.some((p) => mesmoDia(p.em, d)) ||
      s.sintomas.some((x) => mesmoDia(x.em, d)) ||
      s.aplicacoes.some((x) => mesmoDia(x.em, d)),
  ).length
  const inicio = dias[0].getTime()
  const sintomasSemana = s.sintomas.filter((x) => new Date(x.em).getTime() >= inicio)
  const treinosForca = s.treinos.filter((t) => t.forca && new Date(t.em).getTime() >= inicio).length
  return {
    inicio: dias[0],
    fim: hoje,
    diasComRegistro,
    proteinaMedia: comRefeicao.length ? Math.round(comRefeicao.reduce((a, b) => a + b, 0) / comRefeicao.length) : 0,
    diasProteinaMeta: proteinas.filter((p) => p >= s.perfil.meta_proteina_g * 0.95).length,
    diasAguaMeta: aguas.filter((a) => a >= s.perfil.meta_agua_ml).length,
    treinosForca,
    sintomasSemana,
  }
}

/** Resumo do Dose: só cita dados registrados, nunca dose, diagnóstico ou causa (seção 7). */
export function resumoDoDose(s: Estado) {
  const w = semana(s)
  if (w.diasComRegistro < 3) return null
  const partes: string[] = []
  if (w.diasProteinaMeta >= 4) partes.push(`Semana boa! Você bateu a meta de proteína em ${w.diasProteinaMeta} dias`)
  else if (w.proteinaMedia) partes.push(`Sua proteína média ficou em ${w.proteinaMedia} g por dia`)
  else partes.push('Faltaram registros de alimentação nesta semana')
  if (w.treinosForca) partes[0] += ` e treinou força ${w.treinosForca} ${w.treinosForca === 1 ? 'vez' : 'vezes'}.`
  else partes[0] += '. Não há treino de força registrado.'
  if (w.sintomasSemana.length) {
    const nomes = [...new Set(w.sintomasSemana.flatMap((x) => x.sintomas))].map((x) => x.toLowerCase())
    const ultApl = [...s.aplicacoes].sort((a, b) => +new Date(b.em) - +new Date(a.em))[0]
    const rel = ultApl && w.sintomasSemana.length === 1 ? diasEntre(ultApl.em, w.sintomasSemana[0].em) : null
    if (rel === 1) partes.push(`O ${nomes[0]} apareceu só no dia seguinte à aplicação.`)
    else partes.push(`Você registrou: ${nomes.join(', ')}.`)
  } else partes.push('Nenhum sintoma registrado.')
  if (w.diasAguaMeta >= 5) partes.push('A água esteve em dia!')
  return partes.join(' ')
}

export function dicaDoDose(s: Estado) {
  const p = proteinaDoDia(s)
  const falta = Math.round(s.perfil.meta_proteina_g - p)
  const agua = aguaDoDia(s)
  if (p === 0 && agua === 0) return 'Que tal começar registrando o café da manhã? É só tocar no + e tirar uma foto.'
  if (falta > 25) return `Faltam ${falta} g de proteína pra sua meta. Que tal um iogurte ou ovos no lanche?`
  if (falta > 0) return `Quase lá! Faltam só ${falta} g de proteína hoje.`
  if (agua < s.perfil.meta_agua_ml) return 'Proteína batida! Agora é só lembrar da água ao longo do dia.'
  return 'Metas do dia batidas. Que orgulho! 💜'
}

/* ============================ Contexto ============================ */
const CHAVE = 'canetolino:v1'

function carregar(): Estado {
  try {
    const raw = localStorage.getItem(CHAVE)
    if (raw) return { ...vazio(), ...JSON.parse(raw) }
  } catch {
    /* sem storage */
  }
  return vazio()
}

type Ctx = {
  s: Estado
  set: (fn: (s: Estado) => Estado) => void
  entrarDemo: () => void
  sair: () => void
  zerar: () => void
}
const StoreCtx = createContext<Ctx | null>(null)

export function StoreProvider({ children }: { children: ReactNode }) {
  const [s, setS] = useState<Estado>(carregar)
  const ignorar = useRef(false)

  useEffect(() => {
    if (ignorar.current) {
      ignorar.current = false
      return
    }
    try {
      localStorage.setItem(CHAVE, JSON.stringify(s))
    } catch {
      /* ignore */
    }
  }, [s])

  // sincroniza app ↔ painéis abertos em outras abas
  useEffect(() => {
    const on = (e: StorageEvent) => {
      if (e.key === CHAVE && e.newValue) {
        ignorar.current = true
        setS({ ...vazio(), ...JSON.parse(e.newValue) })
      }
    }
    window.addEventListener('storage', on)
    return () => window.removeEventListener('storage', on)
  }, [])

  const set = useCallback((fn: (s: Estado) => Estado) => setS((prev) => fn(prev)), [])
  const entrarDemo = useCallback(() => setS(demo()), [])
  const sair = useCallback(() => setS((p) => ({ ...p, sessao: false })), [])
  const zerar = useCallback(() => setS(vazio()), [])
  const v = useMemo(() => ({ s, set, entrarDemo, sair, zerar }), [s, set, entrarDemo, sair, zerar])
  return <StoreCtx.Provider value={v}>{children}</StoreCtx.Provider>
}

export function useStore() {
  const c = useContext(StoreCtx)
  if (!c) throw new Error('StoreProvider ausente')
  return c
}

export { ehHoje, item as criarItem }
