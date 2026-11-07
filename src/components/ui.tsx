import { AnimatePresence, motion, animate, useInView } from 'framer-motion'
import { createContext, useCallback, useContext, useEffect, useRef, useState, type ReactNode } from 'react'
import { createPortal } from 'react-dom'
import Icon from './Icon'

/* ============ Toasts ============ */
export type AcaoToast = { rotulo: string; fn: () => void }
type Toast = { id: number; texto: string; tipo?: 'ok' | 'info'; acao?: AcaoToast }
const ToastCtx = createContext<(texto: string, tipo?: Toast['tipo'], acao?: AcaoToast) => void>(() => {})
export const useToast = () => useContext(ToastCtx)

export function ToastProvider({ children }: { children: ReactNode }) {
  const [lista, setLista] = useState<Toast[]>([])
  const fechar = useCallback((id: number) => setLista((l) => l.filter((t) => t.id !== id)), [])
  // com ação (ex.: Desfazer) o aviso fica mais tempo na tela
  const push = useCallback((texto: string, tipo: Toast['tipo'] = 'ok', acao?: AcaoToast) => {
    const id = Date.now() + Math.random()
    // só a última ação pode ser desfeita: um aviso com "Desfazer" substitui o anterior
    setLista((l) => [...(acao ? l.filter((t) => !t.acao) : l), { id, texto, tipo, acao }])
    setTimeout(() => fechar(id), acao ? 7000 : 2800)
  }, [fechar])
  return (
    <ToastCtx.Provider value={push}>
      {children}
      <div className="toast-wrap" role="status" aria-live="polite">
        <AnimatePresence>
          {lista.map((t) => (
            <motion.div
              key={t.id}
              className="toast"
              initial={{ opacity: 0, y: 20, scale: 0.95 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: 10, scale: 0.95 }}
              transition={{ type: 'spring', stiffness: 400, damping: 30 }}
            >
              <span style={{ color: 'var(--turquesa)' }}>
                <Icon name={t.tipo === 'info' ? 'info' : 'check'} size={20} strokeWidth={2.6} />
              </span>
              <span style={{ flex: 1 }}>{t.texto}</span>
              {t.acao && (
                <button
                  type="button"
                  className="toast__acao"
                  onClick={() => {
                    t.acao!.fn()
                    fechar(t.id)
                  }}
                >
                  {t.acao.rotulo}
                </button>
              )}
            </motion.div>
          ))}
        </AnimatePresence>
      </div>
    </ToastCtx.Provider>
  )
}

/* ============ Modal ============ */
export function Modal({ aberto, onFechar, children, largura }: { aberto: boolean; onFechar: () => void; children: ReactNode; largura?: number }) {
  useEffect(() => {
    if (!aberto) return
    const k = (e: KeyboardEvent) => e.key === 'Escape' && onFechar()
    window.addEventListener('keydown', k)
    return () => window.removeEventListener('keydown', k)
  }, [aberto, onFechar])
  // vai direto para o <body>: assim nenhuma animação ou transformação da tela por trás "prende" a janela
  return createPortal(
    <AnimatePresence>
      {aberto && (
        <motion.div className="modal-fundo" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={onFechar}>
          <motion.div
            className="modal"
            role="dialog"
            aria-modal="true"
            style={largura ? { width: `min(100%, ${largura}px)` } : undefined}
            initial={{ opacity: 0, y: 30, scale: 0.96 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 20, scale: 0.97 }}
            transition={{ type: 'spring', stiffness: 380, damping: 32 }}
            onClick={(e) => e.stopPropagation()}
          >
            {children}
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>,
    document.body,
  )
}

/* ============ Contador animado ============ */
export function Contador({ valor, casas = 0, sufixo = '', prefixo = '', duracao = 1.4 }: { valor: number; casas?: number; sufixo?: string; prefixo?: string; duracao?: number }) {
  const ref = useRef<HTMLSpanElement>(null)
  const visto = useInView(ref, { once: true, margin: '-40px' })
  useEffect(() => {
    if (!visto || !ref.current) return
    const el = ref.current
    const c = animate(0, valor, {
      duration: duracao,
      ease: [0.22, 1, 0.36, 1],
      onUpdate: (v) => {
        el.textContent = prefixo + v.toLocaleString('pt-BR', { minimumFractionDigits: casas, maximumFractionDigits: casas }) + sufixo
      },
    })
    return () => c.stop()
  }, [visto, valor, casas, sufixo, prefixo, duracao])
  return <span ref={ref}>{prefixo}0{sufixo}</span>
}

/* ============ Confete ============ */
export function soltarConfete(origem?: { x: number; y: number }, qtd = 70) {
  if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return
  const cores = ['#2EC4B6', '#9370E0', '#6C3FC4', '#F3EEFF', '#ffd37a', '#ff8fb1']
  const c = document.createElement('canvas')
  c.style.cssText = 'position:fixed;inset:0;pointer-events:none;z-index:2000'
  c.width = innerWidth * devicePixelRatio
  c.height = innerHeight * devicePixelRatio
  document.body.appendChild(c)
  const ctx = c.getContext('2d')!
  ctx.scale(devicePixelRatio, devicePixelRatio)
  const ox = origem?.x ?? innerWidth / 2
  const oy = origem?.y ?? innerHeight / 2
  const ps = Array.from({ length: qtd }, () => {
    const a = Math.random() * Math.PI * 2
    const v = 4 + Math.random() * 9
    return { x: ox, y: oy, vx: Math.cos(a) * v, vy: Math.sin(a) * v - 6, r: 4 + Math.random() * 5, cor: cores[(Math.random() * cores.length) | 0], rot: Math.random() * 6, vr: (Math.random() - 0.5) * 0.4, forma: Math.random() > 0.5 }
  })
  let t = 0
  const tick = () => {
    t++
    ctx.clearRect(0, 0, innerWidth, innerHeight)
    for (const p of ps) {
      p.vy += 0.32
      p.vx *= 0.985
      p.x += p.vx
      p.y += p.vy
      p.rot += p.vr
      ctx.save()
      ctx.translate(p.x, p.y)
      ctx.rotate(p.rot)
      ctx.globalAlpha = Math.max(0, 1 - t / 110)
      ctx.fillStyle = p.cor
      if (p.forma) ctx.fillRect(-p.r / 2, -p.r, p.r, p.r * 2)
      else {
        ctx.beginPath()
        ctx.arc(0, 0, p.r / 1.6, 0, Math.PI * 2)
        ctx.fill()
      }
      ctx.restore()
    }
    if (t < 110) requestAnimationFrame(tick)
    else c.remove()
  }
  tick()
}

/* ============ Anel de progresso ============ */
export function Anel({ valor, max, tamanho = 110, espessura = 12, children }: { valor: number; max: number; tamanho?: number; espessura?: number; children?: ReactNode }) {
  const r = (tamanho - espessura) / 2
  const c = 2 * Math.PI * r
  const pct = Math.min(1, max ? valor / max : 0)
  return (
    <div style={{ position: 'relative', width: tamanho, height: tamanho }}>
      <svg width={tamanho} height={tamanho} style={{ transform: 'rotate(-90deg)' }} aria-hidden>
        <circle cx={tamanho / 2} cy={tamanho / 2} r={r} stroke="#ece6fa" strokeWidth={espessura} fill="none" />
        <motion.circle
          cx={tamanho / 2}
          cy={tamanho / 2}
          r={r}
          stroke="url(#anelGrad)"
          strokeWidth={espessura}
          fill="none"
          strokeLinecap="round"
          strokeDasharray={c}
          initial={{ strokeDashoffset: c }}
          animate={{ strokeDashoffset: c * (1 - pct) }}
          transition={{ duration: 1.2, ease: [0.22, 1, 0.36, 1] }}
        />
        <defs>
          <linearGradient id="anelGrad" x1="0" y1="0" x2="1" y2="1">
            <stop offset="0" stopColor="#9370E0" />
            <stop offset="1" stopColor="#6C3FC4" />
          </linearGradient>
        </defs>
      </svg>
      <div style={{ position: 'absolute', inset: 0, display: 'grid', placeItems: 'center', textAlign: 'center' }}>{children}</div>
    </div>
  )
}

export function Interruptor({ ligado, onChange, rotulo }: { ligado: boolean; onChange: (v: boolean) => void; rotulo: string }) {
  return (
    <label className="switch">
      <input type="checkbox" role="switch" checked={ligado} onChange={(e) => onChange(e.target.checked)} aria-label={rotulo} />
      <span />
    </label>
  )
}

export const Logo = ({ claro = false, sufixo, tamanho = 22 }: { claro?: boolean; sufixo?: string; tamanho?: number }) => (
  <span className="logo" style={{ fontSize: tamanho, color: claro ? '#fff' : 'var(--roxo)' }}>
    canetolino{sufixo && <em>{sufixo}</em>}
  </span>
)
