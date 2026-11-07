/* Dose como na receita, sempre com unidade: "2,5" vira "2,5 mg"; "5mg" vira "5 mg".
   O app nunca calcula nem sugere dose: só padroniza como ela aparece. */
export const UNIDADES = ['mg', 'mL', 'UI', 'cliques'] as const
export type Unidade = (typeof UNIDADES)[number]

const UNIDADE_DE: Record<string, Unidade> = { mg: 'mg', ml: 'mL', ui: 'UI', u: 'UI', unidades: 'UI', unidade: 'UI', clique: 'cliques', cliques: 'cliques' }

/** Separa número e unidade. Sem unidade, assume mg (é como as canetas são prescritas). */
export function separarDose(t?: string | null): { valor: string; unidade: Unidade } | null {
  const m = String(t ?? '').trim().match(/^(\d+(?:[.,]\d+)?)\s*([a-zA-Z]+)?$/)
  if (!m) return null
  const unidade = m[2] ? UNIDADE_DE[m[2].toLowerCase()] : 'mg'
  if (!unidade) return null
  return { valor: m[1].replace('.', ','), unidade }
}

/** Texto da dose para mostrar e guardar. Textos livres ("conforme a receita") ficam como estão. */
export function formatarDose(t?: string | null): string {
  const s = String(t ?? '').trim()
  if (!s) return ''
  const p = separarDose(s)
  return p ? `${p.valor} ${p.unidade}` : s
}

export const ordinal = (n: number) => `${n}ª`
