/** Planos do paciente. Não há plano gratuito: o Básico é o mais barato. Valores em reais por mês. */
export const PLANOS = {
  basico: {
    nome: 'Básico',
    preco: 9.9,
    anual: 99,
    itens: ['Aplicações, água, peso, sintomas e treinos', 'Radar da semana com resumo do Dose', 'Relatório e ficha em PDF para o seu médico', '30 registros de refeição por IA por mês', 'Compartilhar com 1 profissional'],
  },
  premium: {
    nome: 'Premium',
    preco: 19.9,
    anual: 199,
    itens: ['Tudo do Básico', 'Registros por IA ilimitados', 'Profissionais ilimitados e integração com Apple Saúde e Health Connect', 'Módulos Manutenção, Fitness e Wellness'],
  },
} as const

export type Plano = keyof typeof PLANOS
export const precoBR = (v: number) => v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
