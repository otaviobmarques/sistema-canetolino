/**
 * Base nutricional de exemplo, inspirada na TACO (valores por 100 g, alimento preparado).
 * No produto final esta tabela vem da tabela `foods` (TACO/TBCA versionada) no backend.
 * Os números são aproximações para o protótipo.
 */
export type Food = {
  id: string
  nome: string
  preparo: string
  fonte: 'TACO' | 'TBCA' | 'rótulo'
  proteina_100g: number
  energia_100g: number
  porcaoPadrao: { g: number; texto: string }
  sinonimos: string[]
}

export const VERSAO_TABELA = 'TACO 4ª ed. (exemplo)'

export const FOODS: Food[] = [
  { id: 'frango', nome: 'Peito de frango grelhado', preparo: 'grelhado', fonte: 'TACO', proteina_100g: 32, energia_100g: 159, porcaoPadrao: { g: 120, texto: '120 g' }, sinonimos: ['frango', 'filé de frango', 'file de frango', 'peito de frango'] },
  { id: 'feijao', nome: 'Feijão carioca', preparo: 'cozido', fonte: 'TACO', proteina_100g: 4.8, energia_100g: 76, porcaoPadrao: { g: 86, texto: '1 concha (86 g)' }, sinonimos: ['feijão', 'feijao'] },
  { id: 'arroz', nome: 'Arroz branco', preparo: 'cozido', fonte: 'TACO', proteina_100g: 2.5, energia_100g: 128, porcaoPadrao: { g: 75, texto: '3 colheres (75 g)' }, sinonimos: ['arroz'] },
  { id: 'salada', nome: 'Salada de folhas e tomate', preparo: 'cru', fonte: 'TACO', proteina_100g: 1.2, energia_100g: 15, porcaoPadrao: { g: 60, texto: '1 pires' }, sinonimos: ['salada', 'alface', 'tomate'] },
  { id: 'ovo', nome: 'Ovo de galinha', preparo: 'cozido', fonte: 'TACO', proteina_100g: 13.3, energia_100g: 146, porcaoPadrao: { g: 100, texto: '2 unidades (100 g)' }, sinonimos: ['ovo', 'ovos', 'omelete'] },
  { id: 'patinho', nome: 'Carne bovina (patinho)', preparo: 'grelhado', fonte: 'TACO', proteina_100g: 35.9, energia_100g: 219, porcaoPadrao: { g: 100, texto: '1 bife (100 g)' }, sinonimos: ['carne', 'bife', 'patinho'] },
  { id: 'iogurte', nome: 'Iogurte natural', preparo: 'pronto', fonte: 'TACO', proteina_100g: 4.1, energia_100g: 51, porcaoPadrao: { g: 170, texto: '1 pote (170 g)' }, sinonimos: ['iogurte'] },
  { id: 'banana', nome: 'Banana prata', preparo: 'crua', fonte: 'TACO', proteina_100g: 1.3, energia_100g: 98, porcaoPadrao: { g: 55, texto: '1 unidade (55 g)' }, sinonimos: ['banana'] },
  { id: 'pao', nome: 'Pão francês', preparo: 'pronto', fonte: 'TACO', proteina_100g: 8, energia_100g: 300, porcaoPadrao: { g: 50, texto: '1 unidade (50 g)' }, sinonimos: ['pão', 'pao', 'pãozinho'] },
  { id: 'queijo', nome: 'Queijo minas frescal', preparo: 'pronto', fonte: 'TACO', proteina_100g: 17.4, energia_100g: 264, porcaoPadrao: { g: 30, texto: '1 fatia (30 g)' }, sinonimos: ['queijo'] },
  { id: 'peixe', nome: 'Tilápia grelhada', preparo: 'grelhado', fonte: 'TBCA', proteina_100g: 26, energia_100g: 128, porcaoPadrao: { g: 120, texto: '1 filé (120 g)' }, sinonimos: ['peixe', 'tilápia', 'tilapia'] },
  { id: 'batata', nome: 'Batata inglesa', preparo: 'cozida', fonte: 'TACO', proteina_100g: 1.2, energia_100g: 52, porcaoPadrao: { g: 100, texto: '1 unidade média' }, sinonimos: ['batata', 'purê', 'pure'] },
  { id: 'macarrao', nome: 'Macarrão', preparo: 'cozido', fonte: 'TACO', proteina_100g: 3.4, energia_100g: 102, porcaoPadrao: { g: 110, texto: '1 escumadeira (110 g)' }, sinonimos: ['macarrão', 'macarrao', 'massa'] },
  { id: 'whey', nome: 'Whey protein', preparo: 'pó', fonte: 'rótulo', proteina_100g: 80, energia_100g: 400, porcaoPadrao: { g: 30, texto: '1 scoop (30 g)' }, sinonimos: ['whey', 'shake'] },
  { id: 'leite', nome: 'Leite integral', preparo: 'pronto', fonte: 'TACO', proteina_100g: 3.2, energia_100g: 61, porcaoPadrao: { g: 200, texto: '1 copo (200 ml)' }, sinonimos: ['leite', 'café com leite'] },
]

export const foodById = (id: string) => FOODS.find((f) => f.id === id)!
