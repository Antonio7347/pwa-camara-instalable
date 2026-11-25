# ⚡ HOJA FLASH DE DEFENSA ORAL: `pwa-camara-instalable` (TEMAS 6.1 Y 6.2)

> **Regla de oro:** 100% Vanilla JS · Cero `async/await` (solo `.then()`, `.catch()`, `.finally()`) · Rutas relativas `./` para GitHub Pages · Compatible con Android e iPhone (iOS/WebKit).

## 🎤 Pitch de 30 segundos (para arrancar)
*"Profesor, es una PWA instalable en modo `standalone` bajo HTTPS en GitHub Pages con rutas `./`, Service Worker *Cache First* (`sw.js`) e iconos físicos de 192 y 512 px (`manifest.json`). En Android intercepto `beforeinstallprompt` para mostrar `#btn-instalar`, y en iPhone detecto WebKit (`!navigator.standalone`) para mostrar la guía manual `#instrucciones-ios`. Para la cámara aplico el **Patrón Pre-Permiso UX** en 2 clics antes de `getUserMedia()`, resuelvo con `.then/.catch/.finally` y libero el sensor físico con `track.stop()` al alternar entre lente trasera y frontal."*

---

## 🔥 BLOQUE 1 — Tema 6.1: Instalabilidad y `manifest.json` (5 Preguntas)

1. **¿Cuáles son los 3 requisitos obligatorios para que un navegador permita instalar una PWA?**
   - **Respuesta:** 1) **HTTPS** (o `localhost`), 2) **Service Worker activo** (`app.js` **L30** registra `./sw.js` y `sw.js` **L67** responde `fetch`), y 3) **`manifest.json` válido** (`index.html` **L21**) con `start_url`, `"display": "standalone"` (**L7**) e iconos PNG físicos exactos de **192×192 y 512×512 px** (**L11–L23**).

2. **¿Diferencia entre `theme_color` y `background_color`, y qué hace `"purpose": "any maskable"`?**
   - **Respuesta:** En `manifest.json` (**L8–L9**), `theme_color` pinta la barra superior del sistema operativo y `background_color` pinta la *Splash Screen* mientras carga. `"any maskable"` (**L16**) deja a Android recortar el icono en formas adaptativas sin bordes blancos.

3. **¿Para qué sirve `event.preventDefault()` en `beforeinstallprompt` y por qué limpias `eventoInstalacionDiferido = null`?**
   - **Respuesta:** En `app.js` (**L101–L105**), `event.preventDefault()` detiene el mini-banner automático para usar nuestro botón `#btn-instalar`. En **L242–L253**, tras `.prompt()` y `.userChoice` limpiamos `eventoInstalacionDiferido = null` y ocultamos el botón porque `.prompt()` **solo puede ejecutarse una única vez** (repetirlo lanza `InvalidStateError`).

4. **¿Por qué incluiste `sw.js` con *Cache First* si el video de la cámara es local y no viene de internet?**
   - **Respuesta:** Porque es requisito obligatorio de instalabilidad y precachea los 7 archivos del App Shell (`sw.js` **L19–L27**) para que la app instalada abra instantáneamente incluso en **Modo Avión** sin pantalla de error del navegador.

5. **¿Por qué todas las rutas usan `./` y qué pasa si un archivo en `ARCHIVOS_APP_SHELL` da 404?**
   - **Respuesta:** Usan `./` (`index.html` **L21–L27**, `app.js` **L30**, `sw.js` **L19**) porque en GitHub Pages vive en el subdirectorio `/pwa-camara-instalable/` (`/` iría a la raíz dando 404). Y en `sw.js` (**L40**), `cache.addAll()` es **atómico**: un solo 404 aborta toda la instalación del SW.

---

## 🔥 BLOQUE 2 — Tema 6.2: Pre-Permiso UX y Hardware de Cámara (5 Preguntas)

6. **¿Qué problema irreversible ocurre si llamas a `getUserMedia()` al cargar la página sin `#aviso-permiso`?**
   - **Respuesta:** Si el usuario se asusta y pulsa *"Bloquear"*, el navegador guarda el bloqueo en el SO y **JavaScript pierde permanentemente la capacidad de volver a abrir el diálogo nativo** (fallando siempre con `NotAllowedError`). Por eso separamos en 2 clics: `#btn-preparar-camara` (`app.js` **L263**) muestra `#aviso-permiso` (`index.html` **L80**), y `#btn-confirmar-permiso` (`app.js` **L276**) recién llama a `iniciarCamara()`.

7. **¿Por qué ejecutas `streamActual.getTracks().forEach(t => t.stop())` en vez de solo `visorVideo.srcObject = null`?**
   - **Respuesta:** En `detenerCamaraActiva()` (`app.js` **L134–L141**), `srcObject = null` solo desconecta la etiqueta `<video>` dejando el sensor físico encendido y ocupado. En Android e iOS el SO **no permite abrir la cámara frontal mientras la trasera sigue retenida**; sin `track.stop()` previo (**L137** y **L159**), alternar de lente falla con **`NotReadableError`**.

8. **¿Cómo distingues en `.catch()` por qué falló la cámara y para qué usaste `.finally()`?**
   - **Respuesta:** En `iniciarCamara()` (`app.js` **L190–L208**) leo `error.name`: **`NotAllowedError`** (permiso denegado), **`NotFoundError`** (no existe ese lente físico) y **`NotReadableError`** (hardware ocupado). Y **`.finally()`** (**L209–L213**) corre siempre (éxito o fallo) para reactivar `btnConfirmar.disabled = false` sin usar `async/await`.

9. **¿Cómo funciona el cambio entre cámara trasera y frontal (`#btn-alternar-camara`)?**
   - **Respuesta:** En `app.js` (**L298–L303**), alterna `modoCamaraActual` con ternario (`'environment'` ↔ `'user'`) e invoca `iniciarCamara(modoCamaraActual)` (**L148**), que primero libera el lente previo con `detenerCamaraActiva()` y luego pide `{ video: { facingMode: modo }, audio: false }` (**L166–L171**).

10. **¿Por qué validas `if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia)` al inicio de `iniciarCamara()`?**
    - **Respuesta:** En `app.js` (**L150–L156**), por *Feature Detection* y **Contexto Seguro**: si abren la web bajo `http://` inseguro (fuera de HTTPS o `localhost`), el navegador elimina `navigator.mediaDevices` dejándolo `undefined`, y esta guarda evita un `TypeError`.

---

## 🔥 BLOQUE 3 — Notas Críticas de iPhone (iOS / WebKit) (4 Preguntas)

11. **¿Por qué en un iPhone nunca aparece `#btn-instalar` aunque uses Google Chrome para iOS?**
    - **Respuesta:** Porque en iOS todos los navegadores están obligados a usar el motor **WebKit**, que **no soporta `beforeinstallprompt`**. Por eso `verificarEntornoIOS()` (`app.js` **L81–L95**) detecta iOS y, si aún no corre instalada (`!navigator.standalone`), muestra la guía manual `#instrucciones-ios` (`index.html` **L53**).

12. **¿Qué pasa en iPhone si le quitas `playsinline` o `muted` a `<video id="visor-camara">`?**
    - **Respuesta:** En `index.html` (**L107**), sin **`playsinline`** Safari secuestra el video abriendo su reproductor nativo en **pantalla completa** y ocultando los botones HTML de cambiar y apagar cámara. Sin **`muted`**, la política móvil bloquea el `autoplay` dejando el cuadro en negro.

13. **¿Para qué pusiste `<link rel="apple-touch-icon" href="./icons/icon-192.png">` si ya tienes `manifest.json`?**
    - **Respuesta:** En `index.html` (**L25**), porque al crear el acceso directo en inicio, **WebKit sigue priorizando su etiqueta propietaria `apple-touch-icon`**; sin ella pondría una captura en blanco en lugar del icono de 192×192 px.

14. **Si doy permiso de cámara en Safari de iPhone y luego instalo la PWA, ¿por qué vuelve a pedir permiso?**
    - **Respuesta:** Por el **aislamiento (*sandboxing*) de permisos en iOS**: Safari y la app instalada en inicio (`standalone`) no comparten almacén de permisos, por lo que al abrir el icono instalado solicita consentimiento de nuevo.
