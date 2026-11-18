// ==========================================================================
// sw.js - Service Worker con estrategia Cache First para Instalabilidad PWA
// Alumno: Antonio García González
// ==========================================================================
// REGLA DEL CURSO: 100% JavaScript Vanilla, sin librerías externas y SIN
// async/await. Toda la asincronía se resuelve con Promesas (.then / .catch).
// ==========================================================================

const CACHE_NAME = 'pwa-camara-v1';

// Todos los recursos esenciales de la aplicación usan rutas relativas (./)
// para funcionar dentro del subdirectorio de GitHub Pages.
const ARCHIVOS_APP_SHELL = [
  './',
  './index.html',
  './styles.css',
  './app.js',
  './manifest.json',
  './icons/icon-192.png',
  './icons/icon-512.png'
];

// 1. EVENTO INSTALL: Precarga todos los archivos e iconos en la caché local
self.addEventListener('install', (event) => {
  // Fuerza que el Service Worker nuevo tome el control sin esperar a cerrar pestañas
  self.skipWaiting();

  event.waitUntil(
    caches.open(CACHE_NAME)
      .then((cache) => {
        console.log('[SW] Precacheando App Shell e iconos...');
        return cache.addAll(ARCHIVOS_APP_SHELL);
      })
  );
});

// 2. EVENTO ACTIVATE: Elimina versiones de caché anteriores y reclama clientes
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys()
      .then((nombresCaches) => {
        return Promise.all(
          nombresCaches.map((nombre) => {
            if (nombre !== CACHE_NAME) {
              console.log('[SW] Eliminando caché obsoleta:', nombre);
              return caches.delete(nombre);
            }
          })
        );
      })
      .then(() => {
        // Permite que el SW controle la página de inmediato en el scope actual
        return self.clients.claim();
      })
  );
});

// 3. EVENTO FETCH: Estrategia Cache First (primero busca en caché; si no existe, va a la red)
self.addEventListener('fetch', (event) => {
  // Solo interceptamos peticiones de lectura (GET)
  if (event.request.method !== 'GET') return;

  event.respondWith(
    caches.match(event.request)
      .then((respuestaCache) => {
        if (respuestaCache) {
          return respuestaCache;
        }
        return fetch(event.request);
      })
  );
});
