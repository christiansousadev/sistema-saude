// service worker para cache offline e notificacoes push pwa
const CACHE_NAME = 'sistema-saude-v1'
const STATIC_ASSETS = [
  '/',
  '/manifest.json',
  '/globe.svg',
  '/file.svg'
]

// INSTALA SERVICE WORKER E PRE-ARMAZENA SHELL BASICO
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      return cache.addAll(STATIC_ASSETS).catch(() => {
        // ignora se algum ativo nao responder durante install
      })
    })
  )
  self.skipWaiting()
})

// ATIVA E LIMPA CACHES ANTIGOS
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) => {
      return Promise.all(
        keys.map((key) => {
          if (key !== CACHE_NAME) {
            return caches.delete(key)
          }
        })
      )
    })
  )
  self.clients.claim()
})

// INTERCEPTA REQUISICOES COM ESTRATEGIA HIBRIDA
self.addEventListener('fetch', (event) => {
  const url = new URL(event.request.url)

  // chamadas de api e auth sempre usam a rede diretamente
  if (url.pathname.startsWith('/api') || url.pathname.startsWith('/auth')) {
    return
  }

  // navegacao de paginas: network first com fallback de cache
  if (event.request.mode === 'navigate') {
    event.respondWith(
      fetch(event.request).catch(() => {
        return caches.match(event.request).then((res) => {
          return res || caches.match('/')
        })
      })
    )
    return
  }

  // ativos estaticos: cache first com fallback de rede
  if (
    url.pathname.startsWith('/_next/static') ||
    url.pathname.endsWith('.svg') ||
    url.pathname.endsWith('.png') ||
    url.pathname.endsWith('.ico')
  ) {
    event.respondWith(
      caches.match(event.request).then((cached) => {
        if (cached) return cached
        return fetch(event.request).then((networkRes) => {
          if (networkRes && networkRes.status === 200) {
            const resClone = networkRes.clone()
            caches.open(CACHE_NAME).then((cache) => cache.put(event.request, resClone))
          }
          return networkRes
        })
      })
    )
  }
})

// RECEBE NOTIFICACOES PUSH E EXIBE ALERTA DO SISTEMA
self.addEventListener('push', (event) => {
  let data = { title: 'Lembrete de Saúde', body: 'Hora de beber água ou checar sua medicação!' }
  if (event.data) {
    try {
      data = event.data.json()
    } catch {
      data.body = event.data.text()
    }
  }

  const options = {
    body: data.body,
    icon: '/globe.svg',
    badge: '/globe.svg',
    vibrate: [100, 50, 100],
    data: {
      url: data.url || '/dashboard'
    }
  }

  event.waitUntil(
    self.registration.showNotification(data.title, options)
  )
})

// TRATA CLIQUE NA NOTIFICACAO E ABRE A JANELA DA APLICACAO
self.addEventListener('notificationclick', (event) => {
  event.notification.close()
  const targetUrl = event.notification.data?.url || '/dashboard'

  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clientList) => {
      for (const client of clientList) {
        if (client.url.includes(targetUrl) && 'focus' in client) {
          return client.focus()
        }
      }
      if (clients.openWindow) {
        return clients.openWindow(targetUrl)
      }
    })
  )
})
