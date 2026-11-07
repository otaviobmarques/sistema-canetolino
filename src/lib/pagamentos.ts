import { FunctionsHttpError, type SupabaseClient } from '@supabase/supabase-js'
import type { Plano } from '../data/planos'

export type Periodo = 'mensal' | 'anual'
export type MinhaAssinatura = { id: string; plano: Plano; periodo: Periodo; valor: number; status: 'pendente' | 'ativa' | 'atrasada' | 'cancelada'; proximo_vencimento: string | null; criado_em: string }

const MENSAGENS: Record<string, string> = {
  gateway_nao_configurado: 'As assinaturas ainda não foram liberadas. Tente de novo em breve.',
  gateway_credencial: 'O pagamento está temporariamente indisponível. Tente de novo em alguns minutos.',
  ja_assinante: 'Você já tem esse plano ativo.',
  sessao: 'Sua sessão expirou. Entre de novo.',
}

async function chamar(c: SupabaseClient, rota: string, body: object) {
  const { data, error } = await c.functions.invoke(`pagamentos/${rota}`, { body })
  if (error) {
    let codigo = ''
    if (error instanceof FunctionsHttpError) {
      try {
        codigo = (await error.context.json()).erro
      } catch {
        /* sem JSON */
      }
    }
    const e = new Error(MENSAGENS[codigo] ?? 'Não consegui falar com o pagamento. Tente de novo.') as Error & { codigo?: string }
    e.codigo = codigo
    throw e
  }
  return data
}

/** Cria a assinatura no gateway escolhido pelo Admin e devolve o link da página de pagamento. */
export async function assinar(c: SupabaseClient, plano: Plano, periodo: Periodo, cpf?: string): Promise<string> {
  const data = await chamar(c, 'checkout', { plano, periodo, cpf, origem: window.location.origin })
  return data.url as string
}

export const cancelarAssinatura = (c: SupabaseClient) => chamar(c, 'cancelar', {})

export async function minhaAssinatura(c: SupabaseClient) {
  const [{ data: lista }, { data: perfil }] = await Promise.all([
    c.from('assinaturas').select('id, plano, periodo, valor, status, proximo_vencimento, criado_em').neq('status', 'cancelada').order('criado_em', { ascending: false }).limit(5),
    c.from('profiles').select('plano').maybeSingle(),
  ])
  const todas = (lista ?? []) as MinhaAssinatura[]
  return {
    ativa: todas.find((a) => a.status === 'ativa' || a.status === 'atrasada') ?? null,
    pendente: todas.find((a) => a.status === 'pendente') ?? null,
    plano: ((perfil?.plano as Plano) ?? 'basico') as Plano,
  }
}

export const cpfValido = (v: string) => {
  const d = v.replace(/\D/g, '')
  if (d.length === 14) return true // CNPJ: o gateway confere
  if (d.length !== 11 || /^(\d)\1+$/.test(d)) return false
  const dv = (n: number) => {
    let s = 0
    for (let i = 0; i < n; i++) s += Number(d[i]) * (n + 1 - i)
    const r = (s * 10) % 11
    return r === 10 ? 0 : r
  }
  return dv(9) === Number(d[9]) && dv(10) === Number(d[10])
}
