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

/** Login dos painéis web: e-mail, senha e segundo fator (obrigatório nos painéis). */
export function LoginPainel({ sufixo, emailPadrao, onEntrar, descricao }: { sufixo: string; emailPadrao: string; onEntrar: () => void; descricao: string }) {
  const [etapa, setEtapa] = useState<1 | 2>(1)
  const [codigo, setCodigo] = useState('')
  const [carregando, setCarregando] = useState(false)
  return (
    <div className="p-login">
      <div className="p-login__arte">
        <div className="p-login__bolha" />
        <Mascot expressao={etapa === 1 ? 'acenando' : 'piscando'} size={200} seguirCursor />
        <Logo claro sufixo={sufixo} tamanho={34} />
        <p>{descricao}</p>
      </div>
      <div className="p-login__form">
        <AnimatePresence mode="wait">
          {etapa === 1 ? (
            <motion.form key="1" initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }} onSubmit={(e) => { e.preventDefault(); setEtapa(2) }}>
              <h2>Entrar</h2>
              <p className="legenda">Acesso para profissionais verificados.</p>
              <label className="rotulo" htmlFor="pe">E-mail</label>
              <input id="pe" className="campo" defaultValue={emailPadrao} type="email" />
              <label className="rotulo" htmlFor="ps">Senha</label>
              <input id="ps" className="campo" defaultValue="demo1234" type="password" />
              <button className="btn btn--primario btn--bloco" style={{ marginTop: 22 }}>Continuar</button>
            </motion.form>
          ) : (
            <motion.form
              key="2"
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0 }}
              onSubmit={(e) => {
                e.preventDefault()
                setCarregando(true)
                setTimeout(onEntrar, 600)
              }}
            >
              <h2>Verificação em duas etapas</h2>
              <p className="legenda">Digite o código de 6 dígitos do seu app autenticador. (Protótipo: qualquer código.)</p>
              <div className="p-otp">
                {Array.from({ length: 6 }, (_, i) => (
                  <span key={i} className={codigo.length === i ? 'is-ativo' : ''}>{codigo[i] ?? ''}</span>
                ))}
                <input className="p-otp__input" inputMode="numeric" autoFocus maxLength={6} value={codigo} onChange={(e) => setCodigo(e.target.value.replace(/\D/g, ''))} aria-label="Código de verificação" />
              </div>
              <button className="btn btn--primario btn--bloco" style={{ marginTop: 22 }} disabled={codigo.length < 6 || carregando}>{carregando ? 'Entrando…' : 'Entrar no painel'}</button>
              <button type="button" className="btn btn--contorno btn--bloco" style={{ marginTop: 10 }} onClick={() => setCodigo('482913')}>Preencher código de teste</button>
            </motion.form>
          )}
        </AnimatePresence>
      </div>
    </div>
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

export function usarSessao(chave: string) {
  const [ok, setOk] = useState(() => {
    try {
      return sessionStorage.getItem(chave) === '1'
    } catch {
      return false
    }
  })
  const entrar = () => {
    try { sessionStorage.setItem(chave, '1') } catch { /* */ }
    setOk(true)
  }
  const sair = () => {
    try { sessionStorage.removeItem(chave) } catch { /* */ }
    setOk(false)
  }
  return { ok, entrar, sair }
}
