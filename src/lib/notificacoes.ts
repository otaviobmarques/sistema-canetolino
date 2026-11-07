import { sb } from './supabase'

/** Chave pública VAPID (a privada fica só no servidor, na tabela `segredos`). */
const VAPID_PUBLICA = 'BIoiiKXmBNTXzmSpRH94utQr39AvhRqv-C9Emg9t6mWTzgap-t7FBm13lQveelYpkTFeTlnicgox7iQuyy2m5FM'

export type SituacaoLembretes = 'sem-suporte' | 'precisa-instalar' | 'bloqueado' | 'desligado' | 'ligado'

const ehIOS = () => /iphone|ipad|ipod/i.test(navigator.userAgent)
const instalado = () => window.matchMedia('(display-mode: standalone)').matches || (navigator as unknown as { standalone?: boolean }).standalone === true

export async function situacao(): Promise<SituacaoLembretes> {
  if (!('serviceWorker' in navigator) || !('PushManager' in window) || !('Notification' in window)) return ehIOS() && !instalado() ? 'precisa-instalar' : 'sem-suporte'
  if (Notification.permission === 'denied') return 'bloqueado'
  const reg = await navigator.serviceWorker.getRegistration()
  const sub = await reg?.pushManager.getSubscription()
  return sub ? 'ligado' : 'desligado'
}

function chaveBinaria(base64: string) {
  const pad = '='.repeat((4 - (base64.length % 4)) % 4)
  const bin = atob((base64 + pad).replace(/-/g, '+').replace(/_/g, '/'))
  return Uint8Array.from(bin, (c) => c.charCodeAt(0))
}

export async function ativar(userId: string) {
  const perm = await Notification.requestPermission()
  if (perm !== 'granted') throw new Error('Permissão de notificação negada. Libere nas configurações do navegador.')
  const reg = (await navigator.serviceWorker.getRegistration()) ?? (await navigator.serviceWorker.register('./sw.js'))
  await navigator.serviceWorker.ready
  const sub = (await reg.pushManager.getSubscription()) ?? (await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: chaveBinaria(VAPID_PUBLICA) }))
  const j = sub.toJSON() as { endpoint: string; keys: { p256dh: string; auth: string } }
  const c = sb('app')
  const { error } = await c.from('push_subscriptions').upsert({ user_id: userId, endpoint: j.endpoint, p256dh: j.keys.p256dh, auth: j.keys.auth, aparelho: navigator.userAgent.slice(0, 120), ultimo_erro: null }, { onConflict: 'endpoint' })
  if (error) throw error
  // fuso do aparelho, para o lembrete chegar na hora local
  await c.from('profiles').update({ fuso: Intl.DateTimeFormat().resolvedOptions().timeZone || 'America/Sao_Paulo' }).eq('user_id', userId)
}

export async function desativar() {
  const reg = await navigator.serviceWorker.getRegistration()
  const sub = await reg?.pushManager.getSubscription()
  if (!sub) return
  await sb('app').from('push_subscriptions').delete().eq('endpoint', sub.endpoint)
  await sub.unsubscribe()
}

export async function testar(): Promise<number> {
  const { data, error } = await sb('app').functions.invoke('lembretes', { body: {} })
  if (error) throw error
  return (data as { enviados: number }).enviados
}
