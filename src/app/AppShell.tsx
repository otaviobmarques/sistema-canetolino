import { AnimatePresence, motion } from 'framer-motion'
import { Link, NavLink, Navigate, Route, Routes, useLocation, useNavigate } from 'react-router-dom'
import Icon from '../components/Icon'
import Mascot from '../components/Mascot'
import { Logo, useToast } from '../components/ui'
import { useStore } from '../data/store'
import { Boasvindas, Login, Onboarding } from './Entrada'
import { Home, Jornada, Perfil, Radar } from './Principal'
import { Peso, Refeicao, Registrar, SintomaTela, Treino } from './Registros'
import Compartilhar from './Compartilhar'
import '../styles/app.css'

const COM_NAV = ['/app/home', '/app/jornada', '/app/radar', '/app/perfil']

export default function AppShell() {
  const loc = useLocation()
  const { s, entrarDemo, zerar } = useStore()
  const nav = useNavigate()
  const toast = useToast()
  const mostrarNav = COM_NAV.includes(loc.pathname)

  const destinoInicial = !s.sessao ? '/app/boas-vindas' : !s.onboardingFeito ? '/app/onboarding/1' : '/app/home'

  return (
    <div className="app-palco">
      <aside className="app-lateral">
        <Link to="/" className="app-lateral__voltar">
          <Icon name="back" size={18} /> Voltar ao site
        </Link>
        <Logo tamanho={30} />
        <p className="app-lateral__txt">
          Este é o <b>app do paciente</b> funcionando no navegador. Tudo que você registrar aqui fica salvo neste aparelho e aparece no painel do profissional.
        </p>
        <div className="app-lateral__acoes">
          <button
            className="btn btn--primario btn--bloco"
            onClick={() => {
              entrarDemo()
              nav('/app/home')
              toast('Conta de demonstração carregada')
            }}
          >
            Carregar demo (Jessica)
          </button>
          <button
            className="btn btn--contorno btn--bloco"
            onClick={() => {
              zerar()
              nav('/app/boas-vindas')
            }}
          >
            Começar do zero
          </button>
        </div>
        <div className="app-lateral__links">
          <Link to="/pro">
            <Icon name="users" size={18} /> Abrir Canetolino Pro
          </Link>
          <Link to="/clinic">
            <Icon name="grid" size={18} /> Abrir Canetolino Clinic
          </Link>
        </div>
        <div className="app-lateral__dose">
          <Mascot expressao="piscando" size={70} />
          <p>Dica: abra o Pro em outra aba e revogue o acesso no Perfil. A paciente some da lista na hora.</p>
        </div>
      </aside>

      <div className="celular">
        <div className="celular__tela">
          <div className="celular__notch" aria-hidden />
          <AnimatePresence mode="popLayout" initial={false}>
            <motion.div
              key={loc.pathname.startsWith('/app/onboarding') ? 'onboarding' : loc.pathname}
              className="tela-wrap"
              initial={{ opacity: 0, x: 24 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -24 }}
              transition={{ duration: 0.32, ease: [0.22, 1, 0.36, 1] }}
            >
              <Routes location={loc}>
                <Route index element={<Navigate to={destinoInicial} replace />} />
                <Route path="boas-vindas" element={<Boasvindas />} />
                <Route path="login" element={<Login />} />
                <Route path="onboarding/:passo" element={<Onboarding />} />
                <Route path="home" element={<Protegida><Home /></Protegida>} />
                <Route path="jornada" element={<Protegida><Jornada /></Protegida>} />
                <Route path="radar" element={<Protegida><Radar /></Protegida>} />
                <Route path="perfil" element={<Protegida><Perfil /></Protegida>} />
                <Route path="perfil/compartilhar" element={<Protegida><Compartilhar /></Protegida>} />
                <Route path="registrar" element={<Protegida><Registrar /></Protegida>} />
                <Route path="registrar/refeicao" element={<Protegida><Refeicao /></Protegida>} />
                <Route path="registrar/sintoma" element={<Protegida><SintomaTela /></Protegida>} />
                <Route path="registrar/peso" element={<Protegida><Peso /></Protegida>} />
                <Route path="registrar/treino" element={<Protegida><Treino /></Protegida>} />
                <Route path="*" element={<Navigate to={destinoInicial} replace />} />
              </Routes>
            </motion.div>
          </AnimatePresence>
          <AnimatePresence>{mostrarNav && <BarraInferior />}</AnimatePresence>
        </div>
      </div>
    </div>
  )
}

function Protegida({ children }: { children: React.ReactNode }) {
  const { s } = useStore()
  if (!s.sessao) return <Navigate to="/app/boas-vindas" replace />
  if (!s.onboardingFeito) return <Navigate to="/app/onboarding/1" replace />
  return <>{children}</>
}

function BarraInferior() {
  const itens = [
    { to: '/app/home', icone: 'home', nome: 'Início' },
    { to: '/app/jornada', icone: 'calendar', nome: 'Jornada' },
    null,
    { to: '/app/radar', icone: 'chart', nome: 'Radar' },
    { to: '/app/perfil', icone: 'user', nome: 'Perfil' },
  ] as const
  return (
    <motion.nav
      className="barra"
      aria-label="Navegação principal"
      initial={{ y: 90 }}
      animate={{ y: 0 }}
      exit={{ y: 90 }}
      transition={{ type: 'spring', stiffness: 300, damping: 30 }}
    >
      {itens.map((i, idx) =>
        i ? (
          <NavLink key={i.to} to={i.to} className={({ isActive }) => `barra__item ${isActive ? 'is-on' : ''}`}>
            {({ isActive }) => (
              <>
                {isActive && <motion.span layoutId="barra-ind" className="barra__ind" transition={{ type: 'spring', stiffness: 500, damping: 35 }} />}
                <Icon name={i.icone} size={24} />
                <span>{i.nome}</span>
              </>
            )}
          </NavLink>
        ) : (
          <Link key={idx} to="/app/registrar" className="barra__mais" aria-label="Registrar">
            <Icon name="plus" size={30} strokeWidth={2.6} />
          </Link>
        ),
      )}
    </motion.nav>
  )
}
