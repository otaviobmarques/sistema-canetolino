import { useEffect, useRef, useState } from 'react'

export type Expressao =
  | 'feliz'
  | 'acenando'
  | 'pensativo'
  | 'alerta'
  | 'comemorando'
  | 'piscando'
  | 'dormindo'
  | 'neutro'

type Props = {
  expressao?: Expressao
  size?: number
  /** Olhos seguem o cursor */
  seguirCursor?: boolean
  /** Flutua suavemente */
  flutuar?: boolean
  className?: string
  title?: string
}

/**
 * Dose — o mascote do Canetolino. Uma caneta simpática, desenhada em SVG,
 * com 8 expressões e animações em CSS (ver mascot.css).
 */
export default function Mascot({
  expressao = 'feliz',
  size = 160,
  seguirCursor = false,
  flutuar = true,
  className = '',
  title = 'Dose, o mascote do Canetolino',
}: Props) {
  const ref = useRef<SVGSVGElement>(null)
  const [olhar, setOlhar] = useState({ x: 0, y: 0 })

  useEffect(() => {
    if (!seguirCursor) return
    const onMove = (e: PointerEvent) => {
      const el = ref.current
      if (!el) return
      const r = el.getBoundingClientRect()
      const cx = r.left + r.width / 2
      const cy = r.top + r.height * 0.3
      const dx = e.clientX - cx
      const dy = e.clientY - cy
      const d = Math.max(1, Math.hypot(dx, dy))
      const k = Math.min(1, d / 400)
      setOlhar({ x: (dx / d) * 6 * k, y: (dy / d) * 4 * k })
    }
    window.addEventListener('pointermove', onMove)
    return () => window.removeEventListener('pointermove', onMove)
  }, [seguirCursor])

  const e = expressao
  const bracoDireitoAcenando = e === 'acenando'
  const bracosParaCima = e === 'comemorando'

  return (
    <svg
      ref={ref}
      viewBox="0 0 200 290"
      width={size}
      height={(size * 290) / 200}
      className={`mascot mascot--${e} ${flutuar ? 'mascot--float' : ''} ${className}`}
      role="img"
      aria-label={title}
    >
      <defs>
        <linearGradient id="corpoSup" x1="0" y1="0" x2="1" y2="0">
          <stop offset="0" stopColor="#8a64da" />
          <stop offset=".55" stopColor="#9d7ce6" />
          <stop offset="1" stopColor="#8460d6" />
        </linearGradient>
        <linearGradient id="corpoInf" x1="0" y1="0" x2="1" y2="0">
          <stop offset="0" stopColor="#5f35b4" />
          <stop offset=".55" stopColor="#7449cc" />
          <stop offset="1" stopColor="#5c33ae" />
        </linearGradient>
      </defs>

      <g className="mascot__all">
        {/* sombra */}
        <ellipse className="mascot__sombra" cx="100" cy="276" rx="46" ry="6" fill="#000" opacity=".18" />

        {/* pés */}
        <ellipse cx="84" cy="262" rx="15" ry="8" fill="#1d0e3d" />
        <ellipse cx="116" cy="262" rx="15" ry="8" fill="#1d0e3d" />

        {/* braço esquerdo */}
        <g className={`mascot__braco-esq ${bracosParaCima ? 'is-up' : ''}`}>
          <rect x="46" y="126" width="18" height="46" rx="9" fill="#7c58d0" />
        </g>

        {/* braço direito */}
        <g
          className={`mascot__braco-dir ${bracoDireitoAcenando ? 'is-waving' : ''} ${bracosParaCima ? 'is-up' : ''}`}
        >
          <rect x="136" y="126" width="18" height="46" rx="9" fill="#7c58d0" />
        </g>

        {/* corpo */}
        <rect x="60" y="34" width="80" height="170" rx="34" fill="url(#corpoSup)" />
        <path d="M60 176 h80 v34 a40 40 0 0 1 -40 46 a40 40 0 0 1 -40 -46 z" fill="url(#corpoInf)" />
        <rect x="60" y="170" width="80" height="9" fill="#F3EEFF" />
        <rect x="70" y="46" width="8" height="110" rx="4" fill="#fff" opacity=".16" />

        {/* coração */}
        <path
          className="mascot__coracao"
          d="M100 232 c-12 -8 -16 -14 -16 -19 a7 7 0 0 1 16 -3 a7 7 0 0 1 16 3 c0 5 -4 11 -16 19z"
          fill="#2EC4B6"
        />

        {/* tampa */}
        <rect x="56" y="22" width="88" height="18" rx="9" fill="#1d0e3d" />
        <rect className="mascot__botao" x="86" y="6" width="28" height="18" rx="6" fill="#2EC4B6" />

        {/* tela do rosto */}
        <rect x="72" y="62" width="56" height="64" rx="16" fill="#1d0e3d" />
        <g transform={`translate(${olhar.x} ${olhar.y})`} style={{ transition: 'transform .15s ease-out' }}>
          <Rosto e={e} />
        </g>
      </g>

      {e === 'pensativo' && (
        <g className="mascot__pensando" fill="#c9b8f5">
          <circle cx="152" cy="64" r="5" />
          <circle cx="166" cy="46" r="7" />
          <circle cx="182" cy="24" r="9" />
        </g>
      )}
      {e === 'comemorando' && (
        <g className="mascot__estrelas">
          <path d="M28 60 l4 9 9 4 -9 4 -4 9 -4 -9 -9 -4 9 -4z" fill="#2EC4B6" />
          <path d="M172 90 l3 7 7 3 -7 3 -3 7 -3 -7 -7 -3 7 -3z" fill="#F3EEFF" />
          <path d="M160 30 l2.5 5.5 5.5 2.5 -5.5 2.5 -2.5 5.5 -2.5 -5.5 -5.5 -2.5 5.5 -2.5z" fill="#ffd37a" />
        </g>
      )}
      {e === 'dormindo' && (
        <g className="mascot__zzz" fill="#c9b8f5" fontFamily="Nunito, sans-serif" fontWeight="900">
          <text x="140" y="56" fontSize="18">z</text>
          <text x="154" y="38" fontSize="24">z</text>
          <text x="170" y="18" fontSize="30">Z</text>
        </g>
      )}
      {e === 'alerta' && (
        <g className="mascot__exclamacao">
          <rect x="164" y="30" width="10" height="30" rx="5" fill="#ff8a73" />
          <circle cx="169" cy="70" r="5.5" fill="#ff8a73" />
        </g>
      )}
    </svg>
  )
}

function Rosto({ e }: { e: Expressao }) {
  const teal = '#2EC4B6'
  const bochechas = (
    <>
      <circle cx="80" cy="106" r="5" fill="#e0709c" opacity=".75" />
      <circle cx="120" cy="106" r="5" fill="#e0709c" opacity=".75" />
    </>
  )
  const sorriso = <path d="M88 104 q12 11 24 0" stroke={teal} strokeWidth="4.5" fill="none" strokeLinecap="round" />

  switch (e) {
    case 'feliz':
    case 'acenando':
      return (
        <>
          <path d="M82 90 q6 -8 12 0" stroke={teal} strokeWidth="4.5" fill="none" strokeLinecap="round" />
          <path d="M106 90 q6 -8 12 0" stroke={teal} strokeWidth="4.5" fill="none" strokeLinecap="round" />
          {sorriso}
          {bochechas}
        </>
      )
    case 'comemorando':
      return (
        <>
          <path d="M82 84 l8 6 -8 6" stroke={teal} strokeWidth="4.5" fill="none" strokeLinecap="round" strokeLinejoin="round" />
          <path d="M118 84 l-8 6 8 6" stroke={teal} strokeWidth="4.5" fill="none" strokeLinecap="round" strokeLinejoin="round" />
          <path d="M86 102 q14 16 28 0 z" fill={teal} />
          {bochechas}
        </>
      )
    case 'piscando':
      return (
        <>
          <ellipse cx="88" cy="88" rx="5" ry="6.5" fill={teal} />
          <path d="M106 90 q6 -6 12 0" stroke={teal} strokeWidth="4.5" fill="none" strokeLinecap="round" />
          {sorriso}
          {bochechas}
        </>
      )
    case 'pensativo':
      return (
        <>
          <ellipse cx="90" cy="84" rx="4.5" ry="5.5" fill={teal} />
          <ellipse cx="114" cy="84" rx="4.5" ry="5.5" fill={teal} />
          <path d="M92 108 q6 -3 14 0" stroke={teal} strokeWidth="4" fill="none" strokeLinecap="round" />
        </>
      )
    case 'alerta':
      return (
        <>
          <circle cx="88" cy="88" r="7" fill="none" stroke={teal} strokeWidth="4" />
          <circle cx="112" cy="88" r="7" fill="none" stroke={teal} strokeWidth="4" />
          <ellipse cx="100" cy="108" rx="5" ry="6" fill={teal} />
        </>
      )
    case 'dormindo':
      return (
        <>
          <path d="M82 90 q6 6 12 0" stroke={teal} strokeWidth="4" fill="none" strokeLinecap="round" />
          <path d="M106 90 q6 6 12 0" stroke={teal} strokeWidth="4" fill="none" strokeLinecap="round" />
          <circle cx="100" cy="107" r="3.5" fill={teal} />
        </>
      )
    case 'neutro':
    default:
      return (
        <>
          <g className="mascot__olhos">
            <ellipse cx="88" cy="88" rx="5.5" ry="7" fill={teal} />
            <ellipse cx="112" cy="88" rx="5.5" ry="7" fill={teal} />
          </g>
          {sorriso}
          {bochechas}
        </>
      )
  }
}
