import type { AlimentoRotulo, ItemRefeicao } from '../data/store'
import { sb } from './supabase'

/** Alimento da base unificada (TACO, TBCA, POF/IBGE, USDA, CoFID, Ciqual, CNF, AFCD, Frida, Fineli), valores por 100 g. */
export type Alimento = {
  id: string
  nome: string
  fonte: 'TACO' | 'TBCA' | 'POF' | 'USDA' | 'COFID' | 'CIQUAL' | 'CNF' | 'AFCD' | 'FRIDA' | 'FINELI' | 'rótulo'
  categoria: string | null
  proteina_100g: number
  energia_100g: number | null
  medidas: { nome: string; gramas: number }[]
  porcao_padrao_g: number
  porcao_texto: string | null
  versao_tabela: string
}

/** Como citar cada fonte nas telas (condição de uso da TACO e das demais). */
export const CITACAO: Record<string, string> = {
  TACO: 'TACO, NEPA/UNICAMP',
  TBCA: 'TBCA, USP/FoRC',
  POF: 'IBGE, POF 2008-2009',
  USDA: 'USDA FoodData Central',
  COFID: 'CoFID 2021 (Open Government Licence v3.0)',
  CIQUAL: 'Ciqual 2025, ANSES (Licence Ouverte 2.0)',
  CNF: 'Canadian Nutrient File 2026, Health Canada',
  AFCD: '© FSANZ, AFCD Release 3 (CC BY 4.0)',
  FRIDA: '© Frida 5.5, DTU Food (CC BY 4.0)',
  FINELI: 'Fineli, THL (CC BY 4.0)',
  rótulo: 'rótulo do produto',
}

export async function buscarAlimentos(q: string, limite = 20): Promise<Alimento[]> {
  const { data, error } = await sb('app').rpc('buscar_alimentos', { p_q: q, p_limite: limite })
  if (error) throw error
  return (data ?? []).map((f: Alimento) => ({ ...f, proteina_100g: Number(f.proteina_100g), energia_100g: f.energia_100g == null ? null : Number(f.energia_100g), porcao_padrao_g: Number(f.porcao_padrao_g) }))
}

/** Item de refeição a partir de um alimento da base, na porção escolhida. */
export function itemDeAlimento(f: Alimento, gramas = f.porcao_padrao_g, texto?: string): ItemRefeicao {
  return {
    foodId: f.id,
    nome: f.nome,
    porcao_g: gramas,
    porcao_texto: texto ?? (gramas === f.porcao_padrao_g && f.porcao_texto ? f.porcao_texto : `${gramas} g`),
    proteina_g: +((f.proteina_100g * gramas) / 100).toFixed(1),
    energia_kcal: Math.round(((f.energia_100g ?? 0) * gramas) / 100),
    origem: 'manual',
    fonte: f.fonte,
    medidas: f.medidas,
  }
}

/** Item a partir de um alimento do rótulo (proteína informada na embalagem). */
export function itemDeRotulo(a: AlimentoRotulo, porcoes = 1): ItemRefeicao {
  const g = +(a.porcao_g * porcoes).toFixed(1)
  return {
    foodId: `rotulo:${a.id}`,
    nome: a.nome,
    porcao_g: g,
    porcao_texto: porcoes === 1 ? a.porcao_texto || `${a.porcao_g} g` : `${porcoes} porções (${g} g)`,
    proteina_g: +(a.proteina_g * porcoes).toFixed(1),
    energia_kcal: Math.round((a.energia_kcal ?? 0) * porcoes),
    origem: 'manual',
    fonte: 'rótulo',
  }
}

/** Muda a porção mantendo a proporção dos nutrientes do item. */
export function mudarPorcao(i: ItemRefeicao, gramas: number, texto?: string): ItemRefeicao {
  const g = Math.max(5, Math.round(gramas))
  const k = i.porcao_g ? g / i.porcao_g : 1
  return { ...i, porcao_g: g, porcao_texto: texto ?? `${g} g`, proteina_g: +(i.proteina_g * k).toFixed(1), energia_kcal: Math.round(i.energia_kcal * k) }
}
