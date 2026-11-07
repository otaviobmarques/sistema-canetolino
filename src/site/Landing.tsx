import BotaoInstalar from '../components/Instalar'
import { AnimatePresence, motion, useMotionValue, useScroll, useSpring, useTransform } from 'framer-motion'
import { useEffect, useRef, useState, type ReactNode } from 'react'
import { Link } from 'react-router-dom'
import Icon, { type IconName } from '../components/Icon'
import Mascot, { type Expressao } from '../components/Mascot'
import { Contador, Logo, soltarConfete } from '../components/ui'
import { MiniCompartilhar, MiniFoto, MiniInicio, MiniJornada, MiniRadar } from './MiniTelas'
import { PLANOS, precoBR } from '../data/planos'
import logoRedbox from '../assets/redbox-branco.png'
import '../styles/landing.css'

const EASE = [0.22, 1, 0.36, 1] as const

function Revelar({ children, atraso = 0, y = 30, className }: { children: ReactNode; atraso?: number; y?: number; className?: string }) {
  return (
    <motion.div className={className} initial={{ opacity: 0, y }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true, margin: '-80px' }} transition={{ duration: 0.8, delay: atraso, ease: EASE }}>
      {children}
    </motion.div>
  )
}

export default function Landing() {
  return (
    <div className="lp">
      <BarraProgresso />
      <Nav />
      <Hero />
      <Faixa />
      <ComoFunciona />
      <Recursos />
      <ConhecaDose />
      <Profissionais />
      <Privacidade />
      <Faq />
      <CtaFinal />
      <Rodape />
    </div>
  )
}

function BarraProgresso() {
  const { scrollYProgress } = useScroll()
  const x = useSpring(scrollYProgress, { stiffness: 120, damping: 25 })
  return <motion.div className="lp-progresso" style={{ scaleX: x }} />
}

/* ============================== Nav ============================== */
function Nav() {
  const [rolou, setRolou] = useState(false)
  const [menu, setMenu] = useState(false)
  useEffect(() => {
    const on = () => setRolou(window.scrollY > 30)
    on()
    window.addEventListener('scroll', on, { passive: true })
    return () => window.removeEventListener('scroll', on)
  }, [])
  const ir = (id: string) => (e: React.MouseEvent) => {
    e.preventDefault()
    setMenu(false)
    document.getElementById(id)?.scrollIntoView({ behavior: 'smooth' })
  }
  const links = [
    ['como', 'Como funciona'],
    ['recursos', 'Recursos'],
    ['dose', 'Conheça o Dose'],
    ['profissionais', 'Profissionais'],
    ['privacidade', 'Privacidade'],
  ]
  return (
    <header className={`lp-nav ${rolou ? 'is-rolou' : ''} ${menu ? 'is-menu' : ''}`}>
      <div className="lp-nav__in">
        <a href="#" onClick={(e) => { e.preventDefault(); window.scrollTo({ top: 0, behavior: 'smooth' }) }} className="lp-nav__logo" aria-label="Canetolino, início">
          <Mascot expressao="feliz" size={26} flutuar={false} />
          <Logo claro tamanho={24} />
        </a>
        <nav className="lp-nav__links">
          {links.map(([id, nome]) => (
            <a key={id} href={`#${id}`} onClick={ir(id)}>{nome}</a>
          ))}
        </nav>
        <div className="lp-nav__acoes">
          <Link to="/pro" className="lp-nav__pro">Sou profissional</Link>
          <Link to="/app" className="btn btn--turquesa btn--pequeno">Abrir o app</Link>
          <button className="lp-nav__burger" onClick={() => setMenu((m) => !m)} aria-label="Menu" aria-expanded={menu}>
            <Icon name={menu ? 'close' : 'menu'} />
          </button>
        </div>
      </div>
      <AnimatePresence>
        {menu && (
          <motion.nav className="lp-nav__mobile" initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -10 }}>
            {links.map(([id, nome]) => (
              <a key={id} href={`#${id}`} onClick={ir(id)}>{nome}</a>
            ))}
            <Link to="/pro">Canetolino Pro</Link>
            <Link to="/clinic">Canetolino Clinic</Link>
          </motion.nav>
        )}
      </AnimatePresence>
    </header>
  )
}

/* ============================== Hero ============================== */
const FRASES = ['Oi! Eu sou o Dose 💜', 'Já bebeu água hoje?', 'Domingo é dia de aplicação!', 'Faltam 32 g de proteína.', 'Bora registrar o almoço?']

function Hero() {
  const ref = useRef<HTMLElement>(null)
  const { scrollYProgress } = useScroll({ target: ref, offset: ['start start', 'end start'] })
  const yMascote = useTransform(scrollYProgress, [0, 1], [0, 160])
  const yTexto = useTransform(scrollYProgress, [0, 1], [0, 80])
  const opac = useTransform(scrollYProgress, [0, 0.8], [1, 0])
  const mx = useMotionValue(0)
  const my = useMotionValue(0)
  const sx = useSpring(mx, { stiffness: 60, damping: 18 })
  const sy = useSpring(my, { stiffness: 60, damping: 18 })
  const [exp, setExp] = useState<Expressao>('acenando')
  const [frase, setFrase] = useState(0)
  const [digitado, setDigitado] = useState('')

  useEffect(() => {
    const alvo = FRASES[frase]
    let i = 0
    setDigitado('')
    const t = setInterval(() => {
      i++
      setDigitado(alvo.slice(0, i))
      if (i >= alvo.length) clearInterval(t)
    }, 45)
    const prox = setTimeout(() => setFrase((f) => (f + 1) % FRASES.length), 3400)
    return () => {
      clearInterval(t)
      clearTimeout(prox)
    }
  }, [frase])

  useEffect(() => {
    if (exp === 'acenando') {
      const t = setTimeout(() => setExp('neutro'), 4200)
      return () => clearTimeout(t)
    }
    if (exp === 'comemorando') {
      const t = setTimeout(() => setExp('neutro'), 2600)
      return () => clearTimeout(t)
    }
  }, [exp])

  const onMove = (e: React.PointerEvent) => {
    const r = e.currentTarget.getBoundingClientRect()
    mx.set((e.clientX - r.left) / r.width - 0.5)
    my.set((e.clientY - r.top) / r.height - 0.5)
  }

  const palavras = ['Sua', 'dose', 'de']
  return (
    <section ref={ref} className="hero" onPointerMove={onMove}>
      <div className="hero__fundo" aria-hidden>
        <span className="hero__blob hero__blob--1" />
        <span className="hero__blob hero__blob--2" />
        <span className="hero__blob hero__blob--3" />
        <div className="hero__grade" />
      </div>
      <Particulas sx={sx} sy={sy} />

      <div className="hero__in">
        <motion.div className="hero__texto" style={{ y: yTexto, opacity: opac }}>
          <motion.span className="hero__selo" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }}>
            <span className="hero__selo-ponto" /> Novo · iOS, Android e web
          </motion.span>
          <h1 className="hero__titulo">
            {palavras.map((p, i) => (
              <motion.span key={p} className="hero__palavra" initial={{ opacity: 0, y: 40, rotate: 4 }} animate={{ opacity: 1, y: 0, rotate: 0 }} transition={{ delay: 0.2 + i * 0.08, duration: 0.8, ease: EASE }}>
                {p}
              </motion.span>
            ))}
            <motion.span className="hero__palavra hero__destaque" initial={{ opacity: 0, y: 40, rotate: 4 }} animate={{ opacity: 1, y: 0, rotate: 0 }} transition={{ delay: 0.45, duration: 0.8, ease: EASE }}>
              felicidade,
              <svg viewBox="0 0 300 20" preserveAspectRatio="none" aria-hidden>
                <motion.path d="M4 14 C 80 2, 200 2, 296 12" stroke="#2EC4B6" strokeWidth="6" fill="none" strokeLinecap="round" initial={{ pathLength: 0 }} animate={{ pathLength: 1 }} transition={{ delay: 1.1, duration: 0.9, ease: EASE }} />
              </svg>
            </motion.span>
            <motion.span className="hero__palavra" initial={{ opacity: 0, y: 40, rotate: 4 }} animate={{ opacity: 1, y: 0, rotate: 0 }} transition={{ delay: 0.55, duration: 0.8, ease: EASE }}>
              toda semana.
            </motion.span>
          </h1>
          <motion.p className="hero__sub" initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.75, duration: 0.8, ease: EASE }}>
            O Canetolino é o diário do seu tratamento com canetas. Aplicações, proteína, água e evolução num só lugar, com o Dose te lembrando de tudo, sem complicação e sem culpa.
          </motion.p>
          <motion.div className="hero__ctas" initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.9, duration: 0.8, ease: EASE }}>
            <Link to="/app" className="btn btn--turquesa hero__cta">
              Experimentar o app <Icon name="arrow" size={20} />
            </Link>
            <a href="#como" className="btn btn--fantasma" onClick={(e) => { e.preventDefault(); document.getElementById('como')?.scrollIntoView({ behavior: 'smooth' }) }}>
              Ver como funciona
            </a>
            <BotaoInstalar />
          </motion.div>
          <motion.ul className="hero__garantias" initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 1.1 }}>
            <li><Icon name="shield" size={18} /> Dados protegidos pela LGPD</li>
            <li><Icon name="heart" size={18} /> Nunca indica dose</li>
          </motion.ul>
        </motion.div>

        <motion.div className="hero__palco" style={{ y: yMascote }}>
          <motion.div className="hero__halo" style={{ x: useTransform(sx, (v) => v * -30), y: useTransform(sy, (v) => v * -30) }} />
          <motion.div className="hero__balao" key={frase} initial={{ opacity: 0, scale: 0.8, y: 10 }} animate={{ opacity: 1, scale: 1, y: 0 }} transition={{ type: 'spring', stiffness: 300, damping: 20 }}>
            {digitado}
            <span className="hero__cursor">|</span>
          </motion.div>
          <motion.button
            className="hero__mascote"
            initial={{ opacity: 0, scale: 0.6, y: 60 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            transition={{ delay: 0.3, type: 'spring', stiffness: 120, damping: 14 }}
            onClick={(e) => {
              setExp('comemorando')
              soltarConfete({ x: e.clientX, y: e.clientY - 60 })
            }}
            onHoverStart={() => exp === 'neutro' && setExp('piscando')}
            onHoverEnd={() => exp === 'piscando' && setExp('neutro')}
            aria-label="Clique no Dose"
          >
            <Mascot expressao={exp} size={250} seguirCursor title="Dose acenando" />
          </motion.button>
          <CartaoFlutuante className="hf hf--1" icone="drop" titulo="+1 copo" sub="1,2 L de 2 L" atraso={1} />
          <CartaoFlutuante className="hf hf--2" icone="pen" titulo="Domingo · 8h" sub="Próxima aplicação" atraso={1.2} />
          <CartaoFlutuante className="hf hf--3" icone="meal" titulo="45 g de proteína" sub="Almoço por foto" atraso={1.4} />
        </motion.div>
      </div>
      <motion.div className="hero__rolar" animate={{ y: [0, 8, 0] }} transition={{ duration: 1.8, repeat: Infinity }} aria-hidden>
        <span />
      </motion.div>
    </section>
  )
}

function CartaoFlutuante({ className, icone, titulo, sub, atraso }: { className: string; icone: IconName; titulo: string; sub: string; atraso: number }) {
  return (
    <motion.div className={className} initial={{ opacity: 0, scale: 0.7 }} animate={{ opacity: 1, scale: 1 }} transition={{ delay: atraso, type: 'spring', stiffness: 200, damping: 16 }}>
      <span className="hf__ic"><Icon name={icone} size={18} /></span>
      <div>
        <b>{titulo}</b>
        <small>{sub}</small>
      </div>
    </motion.div>
  )
}

function Particulas({ sx, sy }: { sx: ReturnType<typeof useSpring>; sy: ReturnType<typeof useSpring> }) {
  const itens = [
    { t: 'cap', x: 8, y: 22, s: 1, p: 40 },
    { t: 'gota', x: 18, y: 72, s: 0.8, p: 60 },
    { t: 'cor', x: 46, y: 12, s: 0.7, p: 25 },
    { t: 'cap', x: 92, y: 18, s: 0.7, p: 50 },
    { t: 'gota', x: 86, y: 78, s: 1.1, p: 35 },
    { t: 'est', x: 56, y: 86, s: 0.9, p: 70 },
    { t: 'est', x: 30, y: 44, s: 0.6, p: 30 },
    { t: 'cor', x: 70, y: 40, s: 0.6, p: 80 },
  ]
  return (
    <div className="particulas" aria-hidden>
      {itens.map((it, i) => (
        <Particula key={i} {...it} sx={sx} sy={sy} i={i} />
      ))}
    </div>
  )
}
function Particula({ t, x, y, s, p, sx, sy, i }: { t: string; x: number; y: number; s: number; p: number; sx: ReturnType<typeof useSpring>; sy: ReturnType<typeof useSpring>; i: number }) {
  const tx = useTransform(sx, (v) => v * p)
  const ty = useTransform(sy, (v) => v * p)
  return (
    <motion.div className="particula" style={{ left: `${x}%`, top: `${y}%`, x: tx, y: ty, scale: s }}>
      <div className="particula__in" style={{ animationDelay: `${-i * 1.3}s` }}>
        {t === 'cap' && <svg width="44" height="22" viewBox="0 0 44 22"><rect width="44" height="22" rx="11" fill="#9370E0" /><rect width="22" height="22" rx="11" fill="#2EC4B6" /><rect x="11" width="11" height="22" fill="#2EC4B6" /></svg>}
        {t === 'gota' && <svg width="26" height="34" viewBox="0 0 24 32"><path d="M12 0c6 8 12 14 12 20a12 12 0 0 1-24 0C0 14 6 8 12 0z" fill="#2EC4B6" opacity=".85" /></svg>}
        {t === 'cor' && <svg width="30" height="28" viewBox="0 0 24 22"><path d="M12 22S0 14.5 0 6.5A6.5 6.5 0 0 1 12 3a6.5 6.5 0 0 1 12 3.5C24 14.5 12 22 12 22z" fill="#e0709c" opacity=".8" /></svg>}
        {t === 'est' && <svg width="26" height="26" viewBox="0 0 24 24"><path d="M12 0l3 9 9 3-9 3-3 9-3-9-9-3 9-3z" fill="#F3EEFF" opacity=".8" /></svg>}
      </div>
    </motion.div>
  )
}

/* ============================== Faixa ============================== */
function Faixa() {
  const itens = ['Aplicações', 'Proteína', 'Água', 'Peso', 'Sintomas', 'Radar semanal', 'Registro por foto', 'Compartilhar com profissional', 'Lembretes discretos']
  const linha = [...itens, ...itens]
  return (
    <div className="faixa" aria-hidden>
      <div className="faixa__trilho">
        {linha.map((t, i) => (
          <span key={i}>
            {t} <i>✦</i>
          </span>
        ))}
      </div>
    </div>
  )
}

/* ============================== Como funciona (celular fixo) ============================== */
const PASSOS = [
  { titulo: 'Tudo do dia num relance', txt: 'Próxima aplicação, proteína, água e peso na tela inicial. O Dose dá uma dica gentil baseada no que você registrou.', tela: <MiniInicio />, cor: '#9370E0', exp: 'feliz' as Expressao },
  { titulo: 'Fotografe o prato. O Dose organiza.', txt: 'Foto, voz ou texto. A IA identifica os alimentos e os nutrientes vêm da tabela TACO. Nada é salvo sem você confirmar.', tela: <MiniFoto />, cor: '#2EC4B6', exp: 'pensativo' as Expressao },
  { titulo: 'Aplicações com rodízio inteligente', txt: 'Registre em 1 toque. O Dose sugere o local menos usado nas últimas 4 aplicações e cuida da validade das canetas.', tela: <MiniJornada />, cor: '#6C3FC4', exp: 'piscando' as Expressao },
  { titulo: 'Um Radar da sua semana', txt: 'Gráfico de peso, proteína média, água, treinos e sintomas, com um resumo escrito pelo Dose, só com o que você registrou.', tela: <MiniRadar />, cor: '#e0709c', exp: 'comemorando' as Expressao },
  { titulo: 'Compartilhe só o que quiser', txt: 'Escolha o profissional, os módulos e o prazo. Revogue com um toque, e cada acesso fica no seu histórico.', tela: <MiniCompartilhar />, cor: '#2EC4B6', exp: 'feliz' as Expressao },
]

function ComoFunciona() {
  const [ativo, setAtivo] = useState(0)
  const refs = useRef<(HTMLDivElement | null)[]>([])
  useEffect(() => {
    const io = new IntersectionObserver(
      (ents) => ents.forEach((e) => e.isIntersecting && setAtivo(Number((e.target as HTMLElement).dataset.i))),
      { rootMargin: '-45% 0px -45% 0px' },
    )
    refs.current.forEach((r) => r && io.observe(r))
    return () => io.disconnect()
  }, [])
  return (
    <section id="como" className="como">
      <div className="lp-container">
        <Revelar className="sec-cabeca">
          <span className="sec-etiqueta">Como funciona</span>
          <h2>Um app que cuida da rotina para você cuidar de você.</h2>
        </Revelar>
        <div className="como__grid">
          <div className="como__passos">
            {PASSOS.map((p, i) => (
              <div key={i} data-i={i} ref={(el) => { refs.current[i] = el }} className={`como__passo ${ativo === i ? 'is-on' : ''}`}>
                <span className="como__num" style={{ background: p.cor }}>{String(i + 1).padStart(2, '0')}</span>
                <h3>{p.titulo}</h3>
                <p>{p.txt}</p>
                <div className="como__tela-mobile">{p.tela}</div>
              </div>
            ))}
          </div>
          <div className="como__sticky">
            <div className="como__celular-wrap">
              <motion.div className="como__brilho" animate={{ background: `radial-gradient(circle, ${PASSOS[ativo].cor}55, transparent 65%)` }} transition={{ duration: 0.6 }} />
              <div className="lp-celular">
                <div className="lp-celular__notch" />
                <AnimatePresence mode="wait">
                  <motion.div key={ativo} className="lp-celular__tela" initial={{ opacity: 0, y: 30, scale: 0.97 }} animate={{ opacity: 1, y: 0, scale: 1 }} exit={{ opacity: 0, y: -30, scale: 0.97 }} transition={{ duration: 0.45, ease: EASE }}>
                    {PASSOS[ativo].tela}
                  </motion.div>
                </AnimatePresence>
              </div>
              <motion.div className="como__dose" key={'d' + ativo} initial={{ scale: 0, rotate: -20 }} animate={{ scale: 1, rotate: 0 }} transition={{ type: 'spring', stiffness: 260, damping: 15 }}>
                <Mascot expressao={PASSOS[ativo].exp} size={92} />
              </motion.div>
              <div className="como__pontos">
                {PASSOS.map((_, i) => (
                  <span key={i} className={i === ativo ? 'is-on' : ''} />
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  )
}

/* ============================== Recursos (bento com tilt) ============================== */
function Tilt({ children, className }: { children: ReactNode; className?: string }) {
  const rx = useMotionValue(0)
  const ry = useMotionValue(0)
  const srx = useSpring(rx, { stiffness: 200, damping: 20 })
  const sry = useSpring(ry, { stiffness: 200, damping: 20 })
  const [luz, setLuz] = useState({ x: 50, y: 50 })
  return (
    <motion.div
      className={`tilt ${className ?? ''}`}
      style={{ rotateX: srx, rotateY: sry, ['--lx' as string]: `${luz.x}%`, ['--ly' as string]: `${luz.y}%` }}
      onPointerMove={(e) => {
        if (e.pointerType !== 'mouse') return
        const r = e.currentTarget.getBoundingClientRect()
        const px = (e.clientX - r.left) / r.width
        const py = (e.clientY - r.top) / r.height
        ry.set((px - 0.5) * 10)
        rx.set((0.5 - py) * 10)
        setLuz({ x: px * 100, y: py * 100 })
      }}
      onPointerLeave={() => {
        rx.set(0)
        ry.set(0)
      }}
    >
      {children}
    </motion.div>
  )
}

function Recursos() {
  return (
    <section id="recursos" className="recursos">
      <div className="lp-container">
        <Revelar className="sec-cabeca">
          <span className="sec-etiqueta">Recursos</span>
          <h2>Pensado para quem usa tirzepatida, semaglutida ou liraglutida.</h2>
          <p>Tudo que importa no tratamento, sem planilha e sem complicação.</p>
        </Revelar>
        <div className="bento">
          <Revelar className="bento__a">
            <Tilt className="bento-card bento-card--roxo">
              <div className="bento-card__ic"><Icon name="camera" /></div>
              <h3>Registro de refeição por foto, voz ou texto</h3>
              <p>“Almocei arroz, feijão e um filé de frango.” Pronto. O Dose separa os itens, você confere as porções.</p>
              <div className="bento-prato">
                {['Frango grelhado · 38 g', 'Feijão carioca · 4 g', 'Arroz branco · 2 g'].map((t, i) => (
                  <motion.span key={t} initial={{ opacity: 0, x: -20 }} whileInView={{ opacity: 1, x: 0 }} viewport={{ once: true }} transition={{ delay: 0.3 + i * 0.15 }}>{t}</motion.span>
                ))}
              </div>
            </Tilt>
          </Revelar>
          <Revelar className="bento__b" atraso={0.1}>
            <Tilt className="bento-card">
              <div className="bento-card__ic bento-card__ic--t"><Icon name="drop" /></div>
              <h3>Água e proteína</h3>
              <p>Anel de proteína, “+1 copo” e metas combinadas com seu profissional.</p>
              <div className="bento-agua"><motion.i initial={{ height: '10%' }} whileInView={{ height: '64%' }} viewport={{ once: true }} transition={{ duration: 1.6, ease: EASE }} /></div>
            </Tilt>
          </Revelar>
          <Revelar className="bento__c" atraso={0.15}>
            <Tilt className="bento-card">
              <div className="bento-card__ic"><Icon name="calendar" /></div>
              <h3>Lembretes discretos</h3>
              <p>Sem nome de remédio, peso ou sintoma na tela bloqueada.</p>
              <div className="bento-notif">
                <span className="bento-notif__app"><Mascot expressao="feliz" size={18} flutuar={false} /></span>
                <div><b>Canetolino</b><small>Hora do seu momento 💜</small></div>
              </div>
            </Tilt>
          </Revelar>
          <Revelar className="bento__d" atraso={0.1}>
            <Tilt className="bento-card bento-card--alerta">
              <div className="bento-card__ic bento-card__ic--a"><Icon name="alert" /></div>
              <h3>Sintomas com alerta de segurança</h3>
              <p>Sinais como dor abdominal forte mostram na hora um cartão para procurar atendimento e ligar 192. Funciona até sem internet.</p>
            </Tilt>
          </Revelar>
          <Revelar className="bento__e" atraso={0.15}>
            <Tilt className="bento-card">
              <div className="bento-card__ic bento-card__ic--t"><Icon name="box" /></div>
              <h3>Canetas e custos</h3>
              <p>Quantas canetas tem em casa, a validade e quanto gastou no mês.</p>
            </Tilt>
          </Revelar>
          <Revelar className="bento__f" atraso={0.2}>
            <Tilt className="bento-card bento-card--turquesa">
              <div className="bento-card__ic bento-card__ic--b"><Icon name="chart" /></div>
              <h3>Relatório para o seu médico</h3>
              <p>PDF do período com o que foi registrado, importado e estimado, separado direitinho.</p>
            </Tilt>
          </Revelar>
        </div>
      </div>
    </section>
  )
}

/* ============================== Conheça o Dose ============================== */
const EXPRESSOES: { e: Expressao; nome: string; quando: string }[] = [
  { e: 'acenando', nome: 'Acenando', quando: 'Te recebe na primeira vez que você abre o app.' },
  { e: 'feliz', nome: 'Feliz', quando: 'No dia a dia, quando está tudo em ordem.' },
  { e: 'pensativo', nome: 'Pensativo', quando: 'Enquanto a IA analisa sua refeição.' },
  { e: 'comemorando', nome: 'Comemorando', quando: 'Quando você bate a meta de água ou proteína.' },
  { e: 'alerta', nome: 'Alerta', quando: 'Quando algo precisa da sua atenção.' },
  { e: 'dormindo', nome: 'Dormindo', quando: 'Na semana com poucos registros. Ele espera por você!' },
]

function ConhecaDose() {
  const [sel, setSel] = useState(0)
  const atual = EXPRESSOES[sel]
  return (
    <section id="dose" className="dose-sec">
      <div className="lp-container dose-sec__grid">
        <div className="dose-sec__palco">
          <div className="dose-sec__circulo" />
          <AnimatePresence mode="wait">
            <motion.div key={atual.e} initial={{ opacity: 0, scale: 0.7, rotate: -8 }} animate={{ opacity: 1, scale: 1, rotate: 0 }} exit={{ opacity: 0, scale: 0.8, rotate: 8 }} transition={{ type: 'spring', stiffness: 220, damping: 16 }}>
              <Mascot expressao={atual.e} size={230} seguirCursor />
            </motion.div>
          </AnimatePresence>
        </div>
        <div>
          <Revelar>
            <span className="sec-etiqueta">Conheça o Dose</span>
            <h2>Seu parceiro de tratamento. Acolhedor, de frases curtas, sem culpa e sem pressão.</h2>
            <p className="dose-sec__txt">O Dose é uma caneta simpática que mora no app. Ele lembra, organiza e comemora com você, mas nunca fala de dose, nunca diagnostica e nunca afirma que algo causou algo.</p>
          </Revelar>
          <div className="dose-sec__exps" role="tablist">
            {EXPRESSOES.map((x, i) => (
              <motion.button key={x.e} role="tab" aria-selected={sel === i} className={`exp ${sel === i ? 'is-on' : ''}`} onClick={() => setSel(i)} onMouseEnter={() => setSel(i)} whileHover={{ y: -4 }} whileTap={{ scale: 0.95 }}>
                <Mascot expressao={x.e} size={46} flutuar={false} />
                <span>{x.nome}</span>
              </motion.button>
            ))}
          </div>
          <AnimatePresence mode="wait">
            <motion.p key={atual.e} className="dose-sec__quando" initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -8 }}>
              <b>{atual.nome}:</b> {atual.quando}
            </motion.p>
          </AnimatePresence>
        </div>
      </div>
    </section>
  )
}

/* ============================== Profissionais ============================== */
function Profissionais() {
  return (
    <section id="profissionais" className="profs">
      <div className="lp-container">
        <Revelar className="sec-cabeca">
          <span className="sec-etiqueta">Para profissionais e clínicas</span>
          <h2>Acompanhe seus pacientes entre as consultas.</h2>
          <p>Você vê apenas o que cada paciente autorizou, pelo prazo que ele escolheu. Todo acesso fica registrado.</p>
        </Revelar>
        <div className="profs__grid">
          <Revelar>
            <Link to="/pro" className="prof-card">
              <div className="prof-card__topo">
                <Logo claro sufixo="Pro" tamanho={24} />
                <span className="prof-card__seta"><Icon name="arrow" /></span>
              </div>
              <p>Para nutricionistas e médicos. Lista de pacientes vinculados, variação de peso, proteína média, aplicações em dia e alertas.</p>
              <div className="prof-mini">
                {[['Jessica B.', '−6,1 kg', '94 g/dia', ''], ['Marcos L.', '−3,2 kg', '71 g/dia', 'sintoma forte'], ['Paulo R.', '−8,4 kg', '102 g/dia', '']].map(([n, p, pr, a], i) => (
                  <motion.div key={n} className="prof-mini__linha" initial={{ opacity: 0, x: -20 }} whileInView={{ opacity: 1, x: 0 }} viewport={{ once: true }} transition={{ delay: 0.2 + i * 0.12 }}>
                    <b>{n}</b><span>{p}</span><span>{pr}</span>{a ? <em>{a}</em> : <span className="prof-mini__ok">em dia</span>}
                  </motion.div>
                ))}
              </div>
              <span className="prof-card__cta">Abrir o painel Pro</span>
            </Link>
          </Revelar>
          <Revelar atraso={0.12}>
            <Link to="/clinic" className="prof-card prof-card--clinic">
              <div className="prof-card__topo">
                <Logo claro sufixo="Clinic" tamanho={24} />
                <span className="prof-card__seta"><Icon name="arrow" /></span>
              </div>
              <p>Para clínicas. Equipe com papéis (administrador, profissional, recepção), convites e indicadores agregados, sem dados individuais.</p>
              <div className="prof-kpis">
                {[[128, 'pacientes ativos', ''], [91, 'aplicações registradas', '%'], [7, 'convites pendentes', '']].map(([v, r, s]) => (
                  <div key={r as string}>
                    <b><Contador valor={v as number} sufixo={s as string} /></b>
                    <small>{r}</small>
                  </div>
                ))}
              </div>
              <span className="prof-card__cta">Abrir o painel Clinic</span>
            </Link>
          </Revelar>
        </div>
      </div>
    </section>
  )
}

/* ============================== Privacidade ============================== */
function Privacidade() {
  const itens: [IconName, string, string][] = [
    ['lock', 'Criptografia em tudo', 'HTTPS, dados e arquivos criptografados em repouso, fotos em área privada.'],
    ['shield', 'Segurança por linha', 'Cada pessoa só lê os próprios dados. Profissional só vê o que foi autorizado.'],
    ['eye', 'Histórico de acessos', 'Todo acesso de profissional ou clínica aparece para você no app.'],
    ['download', 'Seus direitos, no app', 'Exporte ou exclua seus dados quando quiser, sem precisar pedir.'],
  ]
  return (
    <section id="privacidade" className="priv">
      <div className="lp-container">
        <div className="priv__grid">
          <Revelar>
            <span className="sec-etiqueta sec-etiqueta--claro">Privacidade e LGPD</span>
            <h2>Dado de saúde é seu. A gente só guarda.</h2>
            <p className="priv__txt">Seus dados de saúde são dados sensíveis pela LGPD. O Canetolino usa consentimento específico por finalidade e a IA recebe o mínimo necessário, sem nome, e-mail ou documento, com contrato que proíbe treino com seus dados.</p>
            <div className="priv__nums">
              <div><b><Contador valor={0} /></b><small>doses sugeridas, nunca</small></div>
              <div><b><Contador valor={5} /></b><small>módulos de permissão</small></div>
              <div><b><Contador valor={1} /></b><small>toque para revogar</small></div>
            </div>
          </Revelar>
          <div className="priv__cards">
            {itens.map(([ic, t, d], i) => (
              <Revelar key={t} atraso={i * 0.08}>
                <div className="priv-card">
                  <span><Icon name={ic} /></span>
                  <div>
                    <b>{t}</b>
                    <p>{d}</p>
                  </div>
                </div>
              </Revelar>
            ))}
          </div>
        </div>
      </div>
    </section>
  )
}

/* ============================== FAQ ============================== */
function Faq() {
  const perguntas = [
    ['O Canetolino indica ou ajusta a minha dose?', 'Não. O app registra a dose que está na sua receita, como texto, e nunca calcula, sugere ou muda doses. Isso é sempre com o seu médico.'],
    ['Quais medicamentos são suportados?', 'Tratamentos com tirzepatida, semaglutida, liraglutida e outros de aplicação semanal ou diária. Você informa o nome comercial como está na caixa.'],
    ['Como a IA calcula a proteína da foto?', 'A IA só identifica os alimentos e estima as porções. Os nutrientes vêm sempre da tabela TACO/TBCA, e nada é salvo antes de você conferir e confirmar.'],
    ['Meu nutricionista vê tudo?', 'Só o que você escolher: peso, alimentação, aplicações, sintomas ou bem-estar, por 30 dias, 90 dias ou até você revogar. Revogar corta o acesso na hora.'],
    ['Funciona sem internet?', 'Sim. Água, peso, aplicação e sintomas funcionam offline e sincronizam depois. O alerta de sintoma grave aparece mesmo sem conexão.'],
    ['Quanto custa?', `O Básico custa ${precoBR(PLANOS.basico.preco)} por mês e cobre o essencial, com ${PLANOS.basico.itens[2].split(' ')[0]} registros de refeição por IA. O Premium, ${precoBR(PLANOS.premium.preco)} por mês, libera IA ilimitada, relatórios em PDF, mais profissionais e módulos extras. No plano anual você paga menos.`],
  ]
  const [aberta, setAberta] = useState<number | null>(0)
  return (
    <section className="faq">
      <div className="lp-container faq__grid">
        <Revelar>
          <span className="sec-etiqueta">Dúvidas</span>
          <h2>Perguntas frequentes</h2>
          <div className="faq__dose"><Mascot expressao="pensativo" size={120} /></div>
        </Revelar>
        <div className="faq__lista">
          {perguntas.map(([q, r], i) => (
            <div key={q} className={`faq__item ${aberta === i ? 'is-on' : ''}`}>
              <button onClick={() => setAberta(aberta === i ? null : i)} aria-expanded={aberta === i}>
                {q}
                <motion.span animate={{ rotate: aberta === i ? 45 : 0 }}><Icon name="plus" /></motion.span>
              </button>
              <AnimatePresence initial={false}>
                {aberta === i && (
                  <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} exit={{ height: 0, opacity: 0 }} transition={{ duration: 0.35, ease: EASE }} style={{ overflow: 'hidden' }}>
                    <p>{r}</p>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          ))}
        </div>
      </div>
    </section>
  )
}

/* ============================== CTA ============================== */
function CtaFinal() {
  const [exp, setExp] = useState<Expressao>('feliz')
  return (
    <section className="cta">
      <div className="lp-container">
        <Revelar className="cta__caixa">
          <div className="cta__bolhas" aria-hidden><span /><span /></div>
          <div className="cta__dose" onMouseEnter={() => setExp('comemorando')} onMouseLeave={() => setExp('feliz')}>
            <Mascot expressao={exp} size={170} />
          </div>
          <div className="cta__txt">
            <h2>Pronto pra começar sua jornada?</h2>
            <p>Crie sua conta em 2 minutos. O Dose te acompanha a partir de hoje.</p>
            <div className="hero__ctas">
              <Link to="/app" className="btn btn--turquesa hero__cta" onClick={(e) => soltarConfete({ x: e.clientX, y: e.clientY })}>
                Começar agora <Icon name="arrow" size={20} />
              </Link>
              <Link to="/pro" className="btn btn--fantasma">Sou profissional</Link>
            </div>
          </div>
        </Revelar>
      </div>
    </section>
  )
}

function Rodape() {
  return (
    <footer className="rodape">
      <div className="lp-container rodape__grid">
        <div>
          <Logo claro tamanho={28} />
          <p>O Canetolino é um diário e organizador do seu tratamento. Não substitui seu médico ou nutricionista e nunca indica dose. Em caso de emergência, ligue 192.</p>
        </div>
        <div>
          <b>Produto</b>
          <Link to="/app">App do paciente</Link>
          <Link to="/pro">Canetolino Pro</Link>
          <Link to="/clinic">Canetolino Clinic</Link>
        </div>
        <div>
          <b>Empresa</b>
          <a href="#privacidade">Privacidade e LGPD</a>
          <a href="#">Termos de uso</a>
          <a href="mailto:contato@canetolino.com.br">contato@canetolino.com.br</a>
          <Link to="/admin">Área da equipe</Link>
        </div>
      </div>
      <div className="lp-container rodape__base">
        <span>© {new Date().getFullYear()} Canetolino. Feito com 💜 no Brasil.</span>
        <span className="rodape__agencia">
          Site desenvolvido pela Agência
          <img src={logoRedbox} alt="RedBox" width={96} height={27} loading="lazy" />
        </span>
      </div>
    </footer>
  )
}
