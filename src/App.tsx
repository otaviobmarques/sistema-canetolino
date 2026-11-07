import { useEffect } from 'react'
import { Route, Routes, useLocation, useNavigate } from 'react-router-dom'
import AppShell from './app/AppShell'
import { ToastProvider, useToast } from './components/ui'
import { erroPt, sb, type Area } from './lib/supabase'
import { StoreProvider } from './data/store'
import Landing from './site/Landing'
import ProPainel from './painel/Pro'
import ClinicPainel from './painel/Clinic'

function TituloPorRota() {
  const { pathname } = useLocation()
  useEffect(() => {
    const t = pathname.startsWith('/app') ? 'App' : pathname.startsWith('/pro') ? 'Pro' : pathname.startsWith('/clinic') ? 'Clinic' : ''
    document.title = t ? `Canetolino ${t}` : 'Canetolino'
    if (!pathname.startsWith('/app')) window.scrollTo(0, 0)
  }, [pathname])
  return null
}

/** Volta dos links de e-mail (confirmação de conta e nova senha): troca o ?code pela sessão da área certa. */
function RetornoEmail() {
  const nav = useNavigate()
  const toast = useToast()
  useEffect(() => {
    const q = new URLSearchParams(window.location.search)
    const area = (q.get('area') as Area) || 'app'
    const code = q.get('code')
    const erro = q.get('error_description')
    if (!code && !erro) return
    window.history.replaceState(null, '', window.location.pathname + window.location.hash)
    const destino = area === 'app' ? (q.get('tipo') === 'recuperar' ? '/app/nova-senha' : '/app') : `/${area}`
    if (erro) {
      toast(erro.includes('expired') ? 'O link expirou. Peça um novo.' : erro, 'info')
      nav(area === 'app' ? '/app/login' : `/${area}`)
      return
    }
    sb(area)
      .auth.exchangeCodeForSession(code!)
      .then(({ error }) => {
        if (error) throw error
        toast(q.get('tipo') === 'recuperar' ? 'Crie sua nova senha' : 'E-mail confirmado!')
        nav(destino)
      })
      .catch((e) => {
        toast(erroPt(e), 'info')
        nav(area === 'app' ? '/app/login' : `/${area}`)
      })
  }, [nav, toast])
  return null
}

export default function App() {
  return (
    <StoreProvider>
      <ToastProvider>
        <TituloPorRota />
        <RetornoEmail />
        <Routes>
          <Route path="/" element={<Landing />} />
          <Route path="/app/*" element={<AppShell />} />
          <Route path="/pro/*" element={<ProPainel />} />
          <Route path="/clinic/*" element={<ClinicPainel />} />
          <Route path="*" element={<Landing />} />
        </Routes>
      </ToastProvider>
    </StoreProvider>
  )
}
