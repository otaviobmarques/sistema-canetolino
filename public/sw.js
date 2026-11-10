// Canetolino · service worker: notificações e funcionamento básico sem internet.
const CACHE = 'canetolino-v3'
const API = 'https://mmxoenkeuyvjvahkofik.supabase.co/functions/v1/lembretes'
// Safari exige uma notificação visível para cada push; os demais aceitam o aviso só dentro do app aberto
const EXIGE_NOTIFICACAO = /iphone|ipad|ipod|^((?!chrome|android).)*safari/i.test(self.navigator.userAgent)

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

const icone = './icon-192.png'
const badge = './badge-96.png'
const abrirUrl = (url) => new URL(url || './#/app/home', self.registration.scope).href
const avisar = (acao, token) =>
  token
    ? fetch(API, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ acao, token }) }).then((r) => r.json()).catch(() => null)
    : Promise.resolve(null)
const janelas = () => self.clients.matchAll({ type: 'window', includeUncontrolled: true })

self.addEventListener('push', (e) => {
  let d = { titulo: 'Canetolino', texto: 'Hora do seu momento Canetolino 💜', url: './#/app/home', acoes: [] }
  try {
    d = { ...d, ...e.data.json() }
  } catch {}
  e.waitUntil(
    janelas().then(async (ws) => {
      // app aberto e na frente: o Dose fala por um aviso dentro do app
      const aberta = ws.find((w) => w.focused && w.visibilityState === 'visible')
      if (aberta) {
        aberta.postMessage({ tipo: 'lembrete', texto: d.texto, url: d.url, comemoracao: d.tipo === 'comemoracao' })
        avisar('visto', d.token)
        if (!EXIGE_NOTIFICACAO) return
      }
      const opcoes = { body: d.texto, icon: icone, badge, data: { url: d.url, token: d.token, tipo: d.tipo }, tag: d.tag || d.url, renotify: true, timestamp: Date.now() }
      if (d.imagem) opcoes.image = d.imagem
      if (Array.isArray(d.acoes) && d.acoes.length) opcoes.actions = d.acoes.slice(0, 2)
      return self.registration.showNotification(d.titulo, opcoes)
    }),
  )
})

self.addEventListener('notificationclick', (e) => {
  e.notification.close()
  const { url, token } = e.notification.data || {}
  const acao = e.action

  if (acao === 'copo') {
    e.waitUntil(
      avisar('copo', token).then(async (r) => {
        const ws = await janelas()
        ws.forEach((w) => w.postMessage({ tipo: 'atualizar-agua' }))
        if (!r?.ok) return self.registration.showNotification('Canetolino', { body: 'Não consegui registrar o copo agora. Toque para registrar no app.', icon: icone, badge, data: { url }, tag: 'agua' })
        const litros = (r.total_ml / 1000).toLocaleString('pt-BR', { maximumFractionDigits: 2 })
        return r.meta
          ? self.registration.showNotification('Canetolino', { body: `Meta de água batida! ${litros} L hoje. O Dose está orgulhoso 🎉`, icon: icone, badge, image: 'https://canetolino.com.br/notificacao/comemoracao.jpg', data: { url }, tag: 'agua' })
          : self.registration.showNotification('Canetolino', { body: `+1 copo registrado 💧 ${litros} L hoje.`, icon: icone, badge, data: { url }, tag: 'agua', silent: true })
      }),
    )
    return
  }
  if (acao === 'soneca') {
    e.waitUntil(avisar('soneca', token))
    return
  }

  const destino = abrirUrl(url)
  e.waitUntil(
    Promise.all([
      avisar('abrir', token),
      janelas().then((ws) => {
        const w = ws.find((c) => c.url.startsWith(self.registration.scope))
        if (w) return w.focus().then(() => w.navigate(destino))
        return self.clients.openWindow(destino)
      }),
    ]),
  )
})
