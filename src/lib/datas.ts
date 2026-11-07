export const DIAS_CURTOS = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb']
export const DIAS_LONGOS = ['domingo', 'segunda', 'terça', 'quarta', 'quinta', 'sexta', 'sábado']
const MESES = ['jan', 'fev', 'mar', 'abr', 'mai', 'jun', 'jul', 'ago', 'set', 'out', 'nov', 'dez']
const MESES_LONGOS = ['janeiro', 'fevereiro', 'março', 'abril', 'maio', 'junho', 'julho', 'agosto', 'setembro', 'outubro', 'novembro', 'dezembro']

export const DIA_MS = 86400000

export function inicioDoDia(d: Date | string | number = new Date()) {
  const x = new Date(d)
  x.setHours(0, 0, 0, 0)
  return x
}
export const mesmoDia = (a: Date | string, b: Date | string) => inicioDoDia(a).getTime() === inicioDoDia(b).getTime()
export const ehHoje = (d: Date | string) => mesmoDia(d, new Date())
export const diasEntre = (a: Date | string, b: Date | string) =>
  Math.round((inicioDoDia(b).getTime() - inicioDoDia(a).getTime()) / DIA_MS)

export function saudacaoData(d = new Date()) {
  const dia = ['Domingo', 'Segunda', 'Terça', 'Quarta', 'Quinta', 'Sexta', 'Sábado'][d.getDay()]
  return `${dia}, ${d.getDate()} de ${MESES_LONGOS[d.getMonth()]}`
}
export const dataCurta = (d: Date | string) => {
  const x = new Date(d)
  return `${DIAS_CURTOS[x.getDay()]}, ${x.getDate()} de ${MESES[x.getMonth()]}`
}
export const dataDiaMes = (d: Date | string) => {
  const x = new Date(d)
  return `${x.getDate()} de ${MESES[x.getMonth()]}`
}
export const dataBR = (d: Date | string) => new Date(d).toLocaleDateString('pt-BR')
export const horaBR = (d: Date | string) =>
  new Date(d).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })
export const dataHoraBR = (d: Date | string) => `${dataBR(d)} às ${horaBR(d)}`

export function relativo(d: Date | string) {
  const n = diasEntre(d, new Date())
  if (n <= 0) return 'hoje'
  if (n === 1) return 'ontem'
  return `há ${n} dias`
}

export function mesAno(iso: string) {
  const [a, m] = iso.split('-').map(Number)
  return `${MESES[m - 1]}/${a}`
}

export const num = (n: number, casas = 1) =>
  n.toLocaleString('pt-BR', { minimumFractionDigits: casas, maximumFractionDigits: casas })

/** Identificador único (UUID v4), também usado como chave primária no banco. */
export const uid = (): string =>
  typeof crypto !== 'undefined' && 'randomUUID' in crypto
    ? crypto.randomUUID()
    : 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
        const r = (Math.random() * 16) | 0
        return (c === 'x' ? r : (r & 0x3) | 0x8).toString(16)
      })
