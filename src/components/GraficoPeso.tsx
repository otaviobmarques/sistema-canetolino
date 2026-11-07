import { motion } from 'framer-motion'
import { num } from '../lib/datas'

/** Gráfico de linha do peso (últimas N medições). SVG puro, animado ao aparecer. */
/** `estatico`: sem animação (impressão e PDF, onde a animação não roda). */
export default function GraficoPeso({ pontos, altura = 150, ultimaSemana, estatico = false }: { pontos: number[]; altura?: number; ultimaSemana?: number; estatico?: boolean }) {
  if (pontos.length < 2)
    return (
      <div className="grafico-vazio">
        Registre seu peso por pelo menos 2 semanas para ver a curva.
      </div>
    )
  const W = 320
  const H = altura
  const px = 14
  const pyTop = 26
  const pyBot = 26
  const min = Math.min(...pontos)
  const max = Math.max(...pontos)
  const faixa = Math.max(0.5, max - min)
  const xy = pontos.map((v, i) => [px + (i * (W - px * 2)) / (pontos.length - 1), pyTop + ((max - v) / faixa) * (H - pyTop - pyBot)] as const)
  const d = xy.map(([x, y], i) => (i ? 'L' : 'M') + x.toFixed(1) + ' ' + y.toFixed(1)).join(' ')
  const area = d + ` L ${xy[xy.length - 1][0]} ${H - pyBot} L ${xy[0][0]} ${H - pyBot} Z`
  const [x0, y0] = xy[0]
  const [x1, y1] = xy[xy.length - 1]
  return (
    <svg viewBox={`0 0 ${W} ${H}`} width="100%" role="img" aria-label={`Peso de ${num(pontos[0])} kg para ${num(pontos[pontos.length - 1])} kg`}>
      <defs>
        <linearGradient id="areaPeso" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#9370E0" stopOpacity=".28" />
          <stop offset="1" stopColor="#9370E0" stopOpacity="0" />
        </linearGradient>
      </defs>
      <line x1={px} x2={W - px} y1={H - pyBot} y2={H - pyBot} stroke="#ece6fa" strokeWidth="1.5" />
      <motion.path d={area} fill="url(#areaPeso)" initial={estatico ? false : { opacity: 0 }} whileInView={{ opacity: 1 }} viewport={{ once: true }} transition={{ delay: 0.6, duration: 0.8 }} />
      <motion.path
        d={d}
        fill="none"
        stroke="#6C3FC4"
        strokeWidth="3.5"
        strokeLinecap="round"
        strokeLinejoin="round"
        initial={estatico ? false : { pathLength: 0 }}
        whileInView={{ pathLength: 1 }}
        viewport={{ once: true }}
        transition={{ duration: 1.4, ease: [0.22, 1, 0.36, 1] }}
      />
      {xy.map(([x, y], i) => (
        <motion.circle key={i} cx={x} cy={y} r={i === xy.length - 1 ? 6 : 3.2} fill={i === xy.length - 1 ? '#3B1A6E' : '#9370E0'} stroke="#fff" strokeWidth="2"
          initial={estatico ? false : { scale: 0 }} whileInView={{ scale: 1 }} viewport={{ once: true }} transition={{ delay: 0.2 + i * 0.12, type: 'spring', stiffness: 400 }} style={{ transformOrigin: `${x}px ${y}px` }} />
      ))}
      <text x={x0} y={y0 - 10} fontSize="12" fontWeight="700" fill="#5E5873" textAnchor="start">{num(pontos[0])}</text>
      <text x={x1} y={y1 - 12} fontSize="12.5" fontWeight="800" fill="#3B1A6E" textAnchor="end">{num(pontos[pontos.length - 1])}</text>
      <text x={px} y={H - 8} fontSize="11" fill="#5E5873">sem 1</text>
      <text x={W - px} y={H - 8} fontSize="11" fill="#5E5873" textAnchor="end">sem {ultimaSemana ?? pontos.length}</text>
    </svg>
  )
}
