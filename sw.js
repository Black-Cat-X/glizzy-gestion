// Service worker de Glizzy Gestión v7
// Recibe fotos compartidas desde Android y mantiene el shell disponible sin conexión.
const CACHE = 'glizzy-gestion-v7';
const CACHE_FOTO = 'glizzy-share';
const ARCHIVOS = [
  './',
  './index.html',
  './manifest.webmanifest',
  './icon-192.png',
  './icon-512.png',
  './css/app.css',
  './vendor/jsqr.min.js',
  './vendor/supabase.min.js',
  './js/qr.js',
  './js/config.js',
  './js/utils.js',
  './js/exportar.js',
  './js/finanzas.js',
  './js/inventario.js',
  './js/venta.js',
  './js/app.js'
];

self.addEventListener('install', e => {
  e.waitUntil(caches.open(CACHE).then(c => c.addAll(ARCHIVOS)));
  self.skipWaiting();
});

self.addEventListener('activate', e => {
  e.waitUntil(
    caches.keys()
      .then(ks => Promise.all(
        ks.filter(k => k !== CACHE && k !== CACHE_FOTO).map(k => caches.delete(k))
      ))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', e => {
  const req = e.request;
  const url = new URL(req.url);

  // 1) Foto compartida desde otra app (menú Compartir de Android)
  if (req.method === 'POST' && url.pathname.endsWith('/share-target')) {
    e.respondWith((async () => {
      try {
        const fd = await req.formData();
        const foto = fd.get('foto');
        if (foto && foto.size) {
          const c = await caches.open(CACHE_FOTO);
          await c.put('foto-compartida', new Response(foto, {
            headers: { 'Content-Type': foto.type || 'image/jpeg' }
          }));
        }
      } catch (err) { /* si falla, la página mostrará "no llegó ninguna foto" */ }
      return Response.redirect(
        new URL('./index.html?compartido=1', self.registration.scope).href, 303
      );
    })());
    return;
  }

  // 2) Solicitudes a Supabase y otras APIs externas: solo red, sin cachear
  if (req.method !== 'GET' || url.origin !== self.location.origin) return;

  // 3) Assets propios: red primero; si falla, sirve desde caché (shell offline)
  e.respondWith(
    fetch(req)
      .then(res => {
        if (res && res.ok) {
          const copia = res.clone();
          caches.open(CACHE).then(c => c.put(req, copia));
        }
        return res;
      })
      .catch(() =>
        caches.match(req, { ignoreSearch: true })
          .then(r => r || caches.match('./index.html'))
      )
  );
});
