// ==========================================================================
// sw.js - Service Worker con estrategia Cache First para Instalabilidad PWA
// Temas 6.1 y 6.2: Soporte Offline del App Shell e Iconos de Instalación
// Alumno: Antonio García González
// ==========================================================================
// REGLA DEL CURSO: 100% JavaScript Vanilla, sin librerías externas y CERO
// async/await. Toda la asincronía se resuelve con Promesas (.then / .catch).
//
// PROPÓSITO ARQUITECTÓNICO:
//   Aunque el flujo de la cámara (MediaStream) proviene del hardware local y no de la red,
//   contar con un Service Worker activo que responda en 'fetch' es requisito obligatorio
//   de instalabilidad y garantiza que el App Shell abra en Modo Avión sin errores de red.
// ==========================================================================

const CACHE_NAME = 'pwa-camara-v2';

// Recursos esenciales precacheados con rutas relativas (./) para respetar
// el subdirectorio del repositorio en GitHub Pages sin errores 404.
const ARCHIVOS_APP_SHELL = [
  './',
  './index.html',
  './styles.css',
  './app.js',
  './manifest.json',
  './icons/icon-192.png',
  './icons/icon-512.png'
];

// 1. EVENTO INSTALL: Precarga atómica del App Shell e iconos físicos
self.addEventListener('install', (event) => {
  // Pasa directamente a activación sin quedar retenido en estado 'waiting'
  self.skipWaiting();

  // cache.addAll() es atómico: si cualquiera de los 7 recursos devuelve 404,
  // la promesa se rechaza y la instalación del Service Worker se aborta.
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then((cache) => {
        console.log('[SW] Precacheando App Shell e iconos...');
        return cache.addAll(ARCHIVOS_APP_SHELL);
      })
  );
});

// 2. EVENTO ACTIVATE: Purga de contenedores de versiones anteriores y control inmediato
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
        // Toma control inmediato de las pestañas abiertas en el scope actual sin recargar
        return self.clients.claim();
      })
  );
});

// 3. EVENTO FETCH: Estrategia Cache First para lecturas GET
self.addEventListener('fetch', (event) => {
  // La Cache API únicamente soporta peticiones GET
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
