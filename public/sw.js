// Офлайн-режим: страницы приложения кладём в кэш, запросы к базе (Supabase) не трогаем.
const CACHE = 'one-percent-v1'

self.addEventListener('install', event => {
  event.waitUntil(caches.open(CACHE).then(cache => cache.addAll(['./', './manifest.webmanifest', './icon.svg'])))
  self.skipWaiting()
})

self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys().then(keys => Promise.all(keys.filter(key => key !== CACHE).map(key => caches.delete(key)))),
  )
  self.clients.claim()
})

self.addEventListener('fetch', event => {
  const url = new URL(event.request.url)
  const sameOrigin = url.origin === self.location.origin
  const isFont = url.hostname.endsWith('fonts.googleapis.com') || url.hostname.endsWith('fonts.gstatic.com')
  if (event.request.method !== 'GET' || (!sameOrigin && !isFont)) return

  // Сначала сеть (чтобы видеть свежую версию), без сети — из кэша.
  event.respondWith(
    fetch(event.request)
      .then(response => {
        const copy = response.clone()
        void caches.open(CACHE).then(cache => cache.put(event.request, copy))
        return response
      })
      .catch(() =>
        caches.match(event.request).then(hit => hit ?? (event.request.mode === 'navigate' ? caches.match('./') : Response.error())),
      ),
  )
})
