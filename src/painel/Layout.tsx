import { AnimatePresence, motion } from 'framer-motion'
import { useState, type ReactNode } from 'react'
import { Link, NavLink, useLocation } from 'react-router-dom'
import Icon, { type IconName } from '../components/Icon'
import Mascot from '../components/Mascot'
import { Logo } from '../components/ui'
import '../styles/panel.css'

export type ItemMenu = { to: string; nome: string; icone: IconName; end?: boolean; bloqueado?: boolean }

export function PainelLayout({ sufixo, itens, usuario, children, onSair, extraLateral }: { sufixo: string; itens: ItemMenu[]; usuario: { nome: string; papel: string }; children: ReactNode; onSair: () => void; extraLateral?: ReactNode }) {
  const [aberto, setAberto] = useState(false)
  const loc = useLocation()
  return (
    <div className="painel">
      <aside className={`painel__lateral ${aberto ? 'is-aberto' : ''}`}>
        <div className="painel__logo">
          <Logo claro sufixo={sufixo} tamanho={24} />
          <button className="painel__fechar" onClick={() => setAberto(false)} aria-label="Fechar menu"><Icon name="close" /></button>
        </div>
        <nav className="painel__menu">
          {itens.map((i) => (
            <NavLink key={i.to} to={i.to} end={i.end} onClick={() => setAberto(false)} className={({ isActive }) => `painel__item ${isActive ? 'is-on' : ''}`}>
              {({ isActive }) => (
                <>
                  {isActive && <motion.span layoutId={`ind-${sufixo}`} className="painel__ind" transition={{ type: 'spring', stiffness: 450, damping: 36 }} />}
                  <Icon name={i.icone} size={20} />
                  <span>{i.nome}</span>
                  {i.bloqueado && <Icon name="lock" size={15} className="painel__cadeado" />}
                </>
              )}
            </NavLink>
          ))}
        </nav>
        {extraLateral}
        <div className="painel__usuario">
          <Mascot expressao="feliz" size={34} flutuar={false} />
          <div>
            <b>{usuario.nome}</b>
            <small>{usuario.papel}</small>
          </div>
          <button onClick={onSair} aria-label="Sair" title="Sair"><Icon name="logout" size={19} /></button>
        </div>
        <Link to="/" className="painel__site">← Voltar ao site</Link>
      </aside>
      {aberto && <div className="painel__veu" onClick={() => setAberto(false)} />}
      <main className="painel__main">
        <button className="painel__burger" onClick={() => setAberto(true)} aria-label="Abrir menu"><Icon name="menu" /></button>
        <AnimatePresence mode="wait">
          <motion.div key={loc.pathname} initial={{ opacity: 0, y: 14 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -8 }} transition={{ duration: 0.35, ease: [0.22, 1, 0.36, 1] }}>
            {children}
          </motion.div>
        </AnimatePresence>
      </main>
    </div>
  )
}

export function Cabecalho({ titulo, sub, children }: { titulo: string; sub?: string; children?: ReactNode }) {
  return (
    <header className="p-cab">
      <div>
        <h1>{titulo}</h1>
        {sub && <p>{sub}</p>}
      </div>
      {children && <div className="p-cab__acoes">{children}</div>}
    </header>
  )
}

export function Bloqueado({ texto }: { texto: string }) {
  return (
    <div className="p-bloqueado">
      <Mascot expressao="alerta" size={120} />
      <h2>Acesso restrito</h2>
      <p>{texto}</p>
    </div>
  )
}

