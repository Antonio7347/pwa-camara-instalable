# pwa-camara-instalable

Práctica **Tema 6.1 y 6.2: Instalabilidad Nativa (`manifest.json`) y Acceso Ético a Cámara Frontal/Trasera**.

**Alumno:** Antonio García González  
**Asignatura:** Desarrollo de Aplicaciones Web Progresivas (PWA)

## Características implementadas

- **100% JavaScript Vanilla** sin librerías externas y sin `async/await` (asincronía resuelta con `.then()`, `.catch()` y `.finally()`).
- **Instalabilidad nativa (`manifest.json` + `sw.js`):** Service Worker con estrategia *Cache First* y rutas relativas `./` para GitHub Pages, más captura de `beforeinstallprompt` (`#btn-instalar`).
- **Pre-Permiso Ético (UX Consciente):** Tarjeta `#aviso-permiso` previa antes de invocar `navigator.mediaDevices.getUserMedia()`.
- **Alternancia de cámaras y liberación de hardware:** `detenerCamaraActiva()` antes de cambiar entre cámara trasera (`environment`) y frontal (`user`), y apagado limpio de pistas (`track.stop()`).
- **Soporte iOS / WebKit:** `<link rel="apple-touch-icon" href="./icons/icon-192.png">`, `<video id="visor-camara" autoplay playsinline muted>` y guía manual `#instrucciones-ios` cuando no se ejecuta en modo `standalone`.
