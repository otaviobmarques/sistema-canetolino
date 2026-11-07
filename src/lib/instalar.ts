import { useEffect, useState } from 'react'

/* Instalação do app (PWA). O Chrome/Edge/Android avisam com `beforeinstallprompt`, que precisa ser guardado
   logo no carregamento; o iPhone não tem esse aviso e a instalação é por Compartilhar → Adicionar à Tela de Início. */

type AvisoInstalacao = Event & { prompt: () => Promise<void>; userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }> }
let aviso: AvisoInstalacao | null = null
const ouvintes = new Set<() => void>()
const avisar = () => ouvintes.forEach((f) => f())

if (typeof window !== 'undefined') {
  window.addEventListener('beforeinstallprompt', (e) => {
    e.preventDefault()
    aviso = e as AvisoInstalacao
    avisar()
  })
  window.addEventListener('appinstalled', () => {
    aviso = null
    avisar()
  })
}

export const ehIOS = () => /iphone|ipad|ipod/i.test(navigator.userAgent) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1)
export const estaInstalado = () => window.matchMedia('(display-mode: standalone)').matches || (navigator as unknown as { standalone?: boolean }).standalone === true

export function useInstalar() {
  const [, forcar] = useState(0)
  useEffect(() => {
    const f = () => forcar((n) => n + 1)
    ouvintes.add(f)
    return () => void ouvintes.delete(f)
  }, [])
  const instalado = estaInstalado()
  return {
    instalado,
    /** o navegador oferece instalação direta (Android, Chrome, Edge) */
    direto: !instalado && !!aviso,
    /** iPhone/iPad: só pelo menu Compartilhar */
    ios: !instalado && ehIOS(),
    instalar: async () => {
      if (!aviso) return false
      await aviso.prompt()
      const { outcome } = await aviso.userChoice
      aviso = null
      avisar()
      return outcome === 'accepted'
    },
  }
}
