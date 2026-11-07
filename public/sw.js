// Canetolino · service worker: notificações e funcionamento básico sem internet.
const CACHE = 'canetolino-v2'

self.addEventListener('install', (e) => {
  e.waitUntil(caches.open(CACHE).then((c) => c.addAll(['./', './index.html', './manifest.webmanifest', './icon-192.png', './icon-512.png', './favicon.svg'])))
  self.skipWaiting()
})

self.addEventListener('activate', (e) => {
  e.waitUntil(caches.keys().then((ks) => Promise.all(ks.filter((k) => k !== CACHE).map((k) => caches.delete(k)))).then(() => self.clients.claim()))
})

// Páginas e arquivos do app: rede primeiro, cópia guardada se estiver sem internet.
// Chamadas ao Supabase nunca passam pelo cache (dados de saúde).
self.addEventListener('fetch', (e) => {
  const url = new URL(e.request.url)
  if (e.request.method !== 'GET' || url.origin !== self.location.origin) return
  e.respondWith(
    fetch(e.request)
      .then((r) => {
        if (r.ok) caches.open(CACHE).then((c) => c.put(e.request, r.clone()))
        return r
      })
      .catch(() => caches.match(e.request).then((r) => r || caches.match('./index.html'))),
  )
})

self.addEventListener('push', (e) => {
  let d = { titulo: 'Canetolino', texto: 'Hora do seu momento Canetolino 💜', url: './#/app/home' }
  try {
    d = { ...d, ...e.data.json() }
  } catch {}
  e.waitUntil(self.registration.showNotification(d.titulo, { body: d.texto, icon: './icon-192.png', badge: './icon-192.png', data: { url: d.url }, tag: d.url }))
})

self.addEventListener('notificationclick', (e) => {
  e.notification.close()
  const destino = new URL(e.notification.data?.url || './#/app/home', self.location.origin + self.registration.scope.replace(self.location.origin, '')).href
  e.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((ws) => {
      const w = ws.find((c) => c.url.startsWith(self.registration.scope))
      if (w) return w.focus().then(() => w.navigate(destino))
      return self.clients.openWindow(destino)
    }),
  )
})
