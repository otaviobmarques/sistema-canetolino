import { useEffect } from 'react'
import { Route, Routes, useLocation } from 'react-router-dom'
import AppShell from './app/AppShell'
import { ToastProvider } from './components/ui'
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

export default function App() {
  return (
    <StoreProvider>
      <ToastProvider>
        <TituloPorRota />
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
