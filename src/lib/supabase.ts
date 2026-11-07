import { createClient, type SupabaseClient } from '@supabase/supabase-js'

/**
 * Projeto Supabase "canetolino" (região sa-east-1, São Paulo).
 * A chave publicável é pública por natureza: quem protege os dados são as regras de RLS do banco.
 * Pode ser trocada pelas variáveis VITE_SUPABASE_URL e VITE_SUPABASE_KEY.
 */
export const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL ?? 'https://mmxoenkeuyvjvahkofik.supabase.co'
const SUPABASE_KEY = import.meta.env.VITE_SUPABASE_KEY ?? 'sb_publishable_LMeWDQPrdxWGNwbdMzN0pg_BYiJbZIl'

export type Area = 'app' | 'pro' | 'clinic' | 'admin'

const cache: Partial<Record<Area, SupabaseClient>> = {}

/** Um cliente por área, cada um com a sua sessão: o paciente e o profissional podem estar logados no mesmo navegador. */
export function sb(area: Area): SupabaseClient {
  if (!cache[area]) {
    cache[area] = createClient(SUPABASE_URL, SUPABASE_KEY, {
      auth: {
        storageKey: `canetolino-auth-${area}`,
        flowType: 'pkce',
        detectSessionInUrl: false, // tratamos o ?code manualmente (o app usa rotas com #)
        persistSession: true,
        autoRefreshToken: true,
      },
    })
  }
  return cache[area]!
}

/** Endereço para onde os e-mails de confirmação e de nova senha voltam. */
export const urlRetorno = (area: Area, tipo: 'confirmar' | 'recuperar' = 'confirmar') =>
  `${window.location.origin}${window.location.pathname}?area=${area}&tipo=${tipo}`

/** Mensagens de erro do Supabase em português. */
export function erroPt(e: unknown): string {
  const m = (e as { message?: string })?.message ?? String(e)
  if (/Invalid login credentials/i.test(m)) return 'E-mail ou senha incorretos.'
  if (/Email not confirmed/i.test(m)) return 'Confirme seu e-mail antes de entrar. Procure a mensagem na sua caixa de entrada.'
  if (/User already registered/i.test(m)) return 'Já existe uma conta com este e-mail. Tente entrar.'
  if (/Password should be at least/i.test(m)) return 'A senha precisa ter pelo menos 6 caracteres.'
  if (/rate limit/i.test(m)) return 'Muitas tentativas em pouco tempo. Aguarde alguns minutos.'
  if (/Invalid TOTP|invalid.*code/i.test(m)) return 'Código inválido. Confira o app autenticador e tente de novo.'
  if (/Failed to fetch|NetworkError/i.test(m)) return 'Sem conexão. Seus registros ficam guardados e sincronizam depois.'
  if (/código não encontrado/i.test(m)) return 'Código não encontrado ou expirado.'
  return m
}
