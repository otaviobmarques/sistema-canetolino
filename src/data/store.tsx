import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import { DIA_MS, diasEntre, ehHoje, inicioDoDia, mesmoDia } from '../lib/datas'
import { erroPt, sb, urlRetorno } from '../lib/supabase'
import { carregar, mapearShares, sincronizar } from './nuvem'
import { foodById } from './foods'

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
  /** id do usuário no Supabase; sem ele, ninguém está logado */
  userId?: string
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
    plano: 'basico' | 'premium'
    email: string
  }
  medicamento: { id: string; principio: string; nome_comercial: string; dia_semana: number; horario: string; dose_texto: string } | null
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

/* ============================ Estados iniciais ============================ */
export const vazio = (): Estado => ({
  versao: 1,
  sessao: false,
  onboardingFeito: false,
  perfil: { nome: '', nascimento: '', altura_cm: 0, peso_inicial_kg: 0, meta_peso_kg: 0, meta_proteina_g: 100, meta_agua_ml: 2000, preferencias: [], plano: 'basico', email: '' },
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
const CHAVE = 'canetolino:v2'
const CHAVE_SALVO = 'canetolino:v2:salvo'

function ler<T>(k: string): T | null {
  try {
    const raw = localStorage.getItem(k)
    return raw ? (JSON.parse(raw) as T) : null
  } catch {
    return null
  }
}
function gravar(k: string, v: unknown) {
  try {
    if (v === null) localStorage.removeItem(k)
    else localStorage.setItem(k, JSON.stringify(v))
  } catch {
    /* sem storage */
  }
}
const carregarLocal = (): Estado => ({ ...vazio(), ...(ler<Partial<Estado>>(CHAVE) ?? {}) })

export type ProfissionalCodigo = { tipo: 'profissional' | 'clinica'; id: string; nome: string; profissao: string; registro: string; verificado: boolean; iniciais: string; pronome: 'ela' | 'ele' | 'ele(a)' }

type Ctx = {
  s: Estado
  set: (fn: (s: Estado) => Estado) => void
  /** sincronização com a nuvem */
  sync: { pendente: boolean; erro: string | null }
  sair: () => Promise<void>
  entrar: (email: string, senha: string) => Promise<void>
  criarConta: (email: string, senha: string, nome: string) => Promise<'ok' | 'confirmar'>
  recuperarSenha: (email: string) => Promise<void>
  novaSenha: (senha: string) => Promise<void>
  buscarCodigo: (codigo: string) => Promise<ProfissionalCodigo | null>
  autorizar: (codigo: string, modulos: Modulo[], dias: number) => Promise<void>
  revogar: (id: string) => Promise<void>
  excluirConta: () => Promise<void>
}
const StoreCtx = createContext<Ctx | null>(null)

const iniciaisDe = (nome: string) =>
  nome.replace(/^(dra?\.?|cl[ií]nica)\s+/i, '').split(/\s+/).filter(Boolean).slice(0, 2).map((x) => x[0]!.toUpperCase()).join('')

export function StoreProvider({ children }: { children: ReactNode }) {
  const [s, setS] = useState<Estado>(carregarLocal)
  const [sync, setSync] = useState<{ pendente: boolean; erro: string | null }>({ pendente: false, erro: null })
  const salvo = useRef<Estado | null>(ler<Estado>(CHAVE_SALVO))
  const atual = useRef(s)
  const rodando = useRef(false)
  const timer = useRef<number>(0)
  const ignorarStorage = useRef(false)
  atual.current = s
  const c = sb('app')

  /* ---------- cache local + abas ---------- */
  useEffect(() => {
    if (ignorarStorage.current) {
      ignorarStorage.current = false
      return
    }
    gravar(CHAVE, s)
  }, [s])

  useEffect(() => {
    const on = (e: StorageEvent) => {
      if (e.key === CHAVE && e.newValue) {
        ignorarStorage.current = true
        setS({ ...vazio(), ...JSON.parse(e.newValue) })
      }
    }
    window.addEventListener('storage', on)
    return () => window.removeEventListener('storage', on)
  }, [])

  /* ---------- envio para a nuvem (por diferença, com nova tentativa) ---------- */
  const enviar = useCallback(async () => {
    const agora = atual.current
    if (!agora.userId || !salvo.current) return
    if (rodando.current) return
    rodando.current = true
    setSync({ pendente: true, erro: null })
    try {
      salvo.current = await sincronizar(c, agora.userId, salvo.current, agora)
      gravar(CHAVE_SALVO, salvo.current)
      setSync({ pendente: false, erro: null })
    } catch (e) {
      setSync({ pendente: true, erro: erroPt(e) })
    } finally {
      rodando.current = false
    }
    if (atual.current !== agora && atual.current.userId) timer.current = window.setTimeout(enviar, 300)
  }, [c])

  useEffect(() => {
    if (!s.userId) return
    clearTimeout(timer.current)
    timer.current = window.setTimeout(enviar, 500)
  }, [s, enviar])

  useEffect(() => {
    const on = () => enviar()
    window.addEventListener('online', on)
    const iv = window.setInterval(() => sync.erro && enviar(), 30000)
    return () => {
      window.removeEventListener('online', on)
      clearInterval(iv)
    }
  }, [enviar, sync.erro])

  /* ---------- sessão ---------- */
  const aoEntrar = useCallback(
    async (userId: string, email: string) => {
      const local = atual.current
      // mesma conta, com registros feitos sem internet ainda não enviados: envia antes de recarregar
      if (local.userId === userId && salvo.current && salvo.current.userId === userId && JSON.stringify(local) !== JSON.stringify(salvo.current)) {
        try {
          salvo.current = await sincronizar(c, userId, salvo.current, local)
        } catch {
          return // continua offline com o cache; nova tentativa automática
        }
      }
      const base: Estado = { ...vazio(), sessao: true, userId, perfil: { ...vazio().perfil, email } }
      const remoto = await carregar(c, userId, base)
      const pronto = { ...remoto, sessao: true, userId }
      salvo.current = pronto
      gravar(CHAVE_SALVO, pronto)
      setS(pronto)
    },
    [c],
  )

  useEffect(() => {
    const { data } = c.auth.onAuthStateChange((evento, sessao) => {
      // não chamar o Supabase de dentro do callback (evita travar o cliente)
      setTimeout(() => {
        if (sessao?.user && (evento === 'SIGNED_IN' || evento === 'INITIAL_SESSION')) {
          const ja = atual.current.userId === sessao.user.id
          if (!ja || evento === 'INITIAL_SESSION') aoEntrar(sessao.user.id, sessao.user.email ?? '').catch((e) => setSync({ pendente: false, erro: erroPt(e) }))
        }
        if (evento === 'SIGNED_OUT' || (evento === 'INITIAL_SESSION' && !sessao && atual.current.userId)) {
          salvo.current = null
          gravar(CHAVE_SALVO, null)
          setS(vazio())
        }
      }, 0)
    })
    return () => data.subscription.unsubscribe()
  }, [c, aoEntrar])

  /** Relê compartilhamentos, consentimentos e auditoria (geridos pelo servidor). */
  const recarregarShares = useCallback(async () => {
    const uid = atual.current.userId
    if (!uid) return
    const [sh, co, au] = await Promise.all([
      c.rpc('meus_compartilhamentos'),
      c.from('consent_records').select('*').eq('user_id', uid).order('aceito_em'),
      c.from('audit_logs').select('*').eq('paciente_id', uid).order('em', { ascending: false }).limit(50),
    ])
    if (sh.error) throw sh.error
    const comp = mapearShares(sh.data ?? [])
    const consentimentos = (co.data ?? []).map((r) => ({ id: r.id, tipo: r.tipo, versao: r.versao_texto, em: r.aceito_em, detalhe: r.detalhe ?? undefined }))
    const auditoria = (au.data ?? []).reverse().map((r) => ({ id: String(r.id), ator: r.ator_nome, acao: r.acao, em: r.em }))
    if (salvo.current) salvo.current = { ...salvo.current, compartilhamentos: comp, consentimentos, auditoria }
    setS((p) => ({ ...p, compartilhamentos: comp, consentimentos, auditoria }))
  }, [c])

  // ao voltar para a aba, atualiza o histórico de acessos
  useEffect(() => {
    const on = () => document.visibilityState === 'visible' && atual.current.userId && recarregarShares().catch(() => {})
    document.addEventListener('visibilitychange', on)
    return () => document.removeEventListener('visibilitychange', on)
  }, [recarregarShares])

  /* ---------- ações ---------- */
  const set = useCallback((fn: (s: Estado) => Estado) => setS((prev) => fn(prev)), [])
  const zerar = useCallback(() => {
    salvo.current = null
    gravar(CHAVE_SALVO, null)
    setS(vazio())
  }, [])
  const sair = useCallback(async () => {
    await enviar()
    await c.auth.signOut()
    zerar()
  }, [c, enviar, zerar])

  const entrar = useCallback(
    async (email: string, senha: string) => {
      const { data, error } = await c.auth.signInWithPassword({ email: email.trim(), password: senha })
      if (error) throw error
      await aoEntrar(data.user.id, data.user.email ?? email)
    },
    [c, aoEntrar],
  )

  const criarConta = useCallback(
    async (email: string, senha: string, nome: string) => {
      const { data, error } = await c.auth.signUp({ email: email.trim(), password: senha, options: { data: { nome, tipo: 'paciente' }, emailRedirectTo: urlRetorno('app') } })
      if (error) throw error
      if (data.session && data.user) {
        await aoEntrar(data.user.id, data.user.email ?? email)
        return 'ok' as const
      }
      return 'confirmar' as const
    },
    [c, aoEntrar],
  )

  const recuperarSenha = useCallback(async (email: string) => {
    const { error } = await c.auth.resetPasswordForEmail(email.trim(), { redirectTo: urlRetorno('app', 'recuperar') })
    if (error) throw error
  }, [c])

  const novaSenha = useCallback(async (senha: string) => {
    const { error } = await c.auth.updateUser({ password: senha })
    if (error) throw error
  }, [c])

  const buscarCodigo = useCallback(
    async (codigo: string): Promise<ProfissionalCodigo | null> => {
      const cod = codigo.trim().toUpperCase()
      const { data, error } = await c.rpc('buscar_codigo', { p_codigo: cod })
      if (error) throw error
      const r = (data ?? [])[0]
      if (!r) return null
      const pronome = /^dra\b/i.test(r.nome) ? 'ela' : /^dr\b/i.test(r.nome) ? 'ele' : 'ele(a)'
      return { tipo: r.tipo, id: r.alvo_id, nome: r.nome, profissao: r.profissao, registro: r.registro, verificado: r.verificado, iniciais: iniciaisDe(r.nome), pronome }
    },
    [c],
  )

  const autorizar = useCallback(
    async (codigo: string, modulos: Modulo[], dias: number) => {
      const { error } = await c.rpc('autorizar_compartilhamento', { p_codigo: codigo.trim().toUpperCase(), p_modulos: modulos, p_dias: dias || null })
      if (error) throw error
      await recarregarShares()
    },
    [c, recarregarShares],
  )

  const revogar = useCallback(
    async (id: string) => {
      const { error } = await c.rpc('revogar_compartilhamento', { p_id: id })
      if (error) throw error
      await recarregarShares()
    },
    [c, recarregarShares],
  )

  const excluirConta = useCallback(async () => {
    const { error } = await c.rpc('excluir_minha_conta')
    if (error) throw error
    await c.auth.signOut({ scope: 'local' })
    zerar()
  }, [c, zerar])

  const v = useMemo(
    () => ({ s, set, sync, sair, entrar, criarConta, recuperarSenha, novaSenha, buscarCodigo, autorizar, revogar, excluirConta }),
    [s, set, sync, sair, entrar, criarConta, recuperarSenha, novaSenha, buscarCodigo, autorizar, revogar, excluirConta],
  )
  return <StoreCtx.Provider value={v}>{children}</StoreCtx.Provider>
}

export function useStore() {
  const c = useContext(StoreCtx)
  if (!c) throw new Error('StoreProvider ausente')
  return c
}

export { ehHoje, item as criarItem }
