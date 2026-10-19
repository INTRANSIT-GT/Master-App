/* Service worker · SOLO guarda en caché los archivos estáticos de la interfaz (HTML, CSS, JS, logos e iconos de instalación).
   NUNCA guarda datos operativos: las solicitudes a Supabase (otro origen) y cualquier petición que no sea
   un archivo estático de la lista van directo a la red. Sin conexión, la app abre pero avisa y no confirma operaciones.
   Para publicar una versión nueva, cambia VERSION. */
const VERSION = 'v1.0.61';
const CACHE = 'intransit-interfaz-' + VERSION;
const ESTATICOS = [
  './', './index.html', './offline.html', './manifest.json', './css/app.css',
  './js/config.js', './js/vendor/supabase.js', './js/assets.js', './js/catalogos.js', './js/utils.js', './js/engine.js', './js/pwa.js', './js/exportar.js', './js/vendor/jspdf.umd.min.js', './js/vendor/jspdf.plugin.autotable.min.js', './js/backend.js', './js/ui.js', './js/modulos/transporte.js', './js/modulos/comercial.js', './js/modulos/torre.js', './js/modulos/finanzas.js', './js/modulos/admin.js', './js/modulos/ayuda.js',
  './assets/logos/logo-blanco.png', './assets/logos/logo-color.png', './assets/logos/isologo.png', './assets/logos/isologo-blanco.png',
  './assets/icons/icon-192.png', './assets/icons/icon-512.png', './assets/icons/icon-maskable-512.png', './assets/icons/apple-touch-icon.png',
  './assets/icons/favicon-32.png', './assets/icons/favicon-48.png'
];
const URLS = new Set(ESTATICOS.map(p => new URL(p, self.registration.scope).href.replace(/index\.html$/, '')));
const SIEMPRE_RED = new Set([new URL('./js/config.js', self.registration.scope).href]);   // la configuración debe estar siempre fresca

self.addEventListener('install', e => {
  e.waitUntil(caches.open(CACHE).then(c => Promise.allSettled(ESTATICOS.map(p => c.add(p)))).then(() => self.skipWaiting()));
});
self.addEventListener('activate', e => {
  e.waitUntil(caches.keys().then(ks => Promise.all(ks.filter(k => k.startsWith('intransit-interfaz-') && k !== CACHE).map(k => caches.delete(k)))).then(() => self.clients.claim()));
});
self.addEventListener('fetch', e => {
  const r = e.request, u = new URL(r.url);
  if (r.method !== 'GET' || u.origin !== self.location.origin) return;            // Supabase y todo lo externo: directo a la red
  if (r.mode === 'navigate') {                                                    // abrir la app: red primero; si no hay red, la interfaz guardada
    e.respondWith(fetch(r).catch(() => caches.match('./index.html').then(x => x || caches.match('./offline.html'))));
    return;
  }
  const clave = u.origin + u.pathname;
  if (!URLS.has(clave)) return;                                                   // lo que no es interfaz estática no se toca
  // RED PRIMERO: si hay internet, baja siempre la última versión de la interfaz;
  // solo si falla (sin conexión) usa la copia guardada. Así los cambios se ven al recargar.
  e.respondWith(fetch(r).then(resp => {
    if (resp && resp.ok) caches.open(CACHE).then(c => c.put(r, resp.clone()));
    return resp;
  }).catch(() => caches.match(r)));
});
