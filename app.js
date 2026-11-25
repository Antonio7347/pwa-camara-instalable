// ==========================================================================
// app.js - Instalabilidad Nativa, Pre-Permiso Ético y Control de Cámara
// Temas 6.1 (Manifest e Instalación) y 6.2 (Acceso Ético a Hardware Multimedia)
// Alumno: Antonio García González
// ==========================================================================
// REGLA DEL CURSO: 100% JavaScript Vanilla, sin librerías externas y CERO
// uso de async/await. Toda asincronía se resuelve con .then(), .catch() y .finally().
//
// FLUJO GENERAL DE EJECUCIÓN:
//   1. Instalación:
//      - Android/Chromium: 'beforeinstallprompt' (preventDefault) ──► muestra #btn-instalar ──► .prompt() y .userChoice
//      - iPhone/WebKit:    verificarEntornoIOS() (!standalone)    ──► muestra guía manual #instrucciones-ios
//   2. Cámara con Consentimiento Consciente (2 pasos):
//      - Clic 1 (#btn-preparar-camara)  ──► despliega #aviso-permiso en HTML sin tocar el hardware todavía
//      - Clic 2 (#btn-confirmar-permiso) ──► iniciarCamara(modo) ──► detenerCamaraActiva() (track.stop) ──► getUserMedia()
// ==========================================================================

// Estado de la sesión para el evento de instalación diferido y el MediaStream activo
let eventoInstalacionDiferido = null;
let streamActual = null;
let modoCamaraActual = 'environment'; // 'environment' = lente trasera | 'user' = lente frontal

// --------------------------------------------------------------------------
// 1. REGISTRO DEL SERVICE WORKER (Uno de los 3 requisitos de instalabilidad PWA
//    junto con contexto seguro HTTPS y un manifest.json válido con iconos 192/512)
// --------------------------------------------------------------------------
if ('serviceWorker' in navigator) {
  // Ruta relativa './sw.js' indispensable para subdirectorios en GitHub Pages;
  // usar '/sw.js' apuntaría a la raíz del dominio provocando Error 404.
  navigator.serviceWorker.register('./sw.js')
    .then((registro) => {
      console.log('[PWA] Service Worker registrado en el scope:', registro.scope);
    })
    .catch((error) => {
      console.error('[PWA] Error al registrar el Service Worker:', error);
    });
}

// --------------------------------------------------------------------------
// 2. UTILIDADES DE INTERFAZ (Mensajes de estado, badge de lente y botones)
// --------------------------------------------------------------------------
function obtenerNombreLente(modo) {
  return modo === 'environment' ? 'Trasera' : 'Frontal';
}

function actualizarMensajeEstado(texto, tipo) {
  const elementoEstado = document.getElementById('mensaje-estado');
  if (!elementoEstado) return;

  elementoEstado.textContent = texto;
  elementoEstado.className = 'mensaje-estado';

  if (tipo === 'activo' || tipo === 'error') {
    elementoEstado.classList.add(tipo);
  }
}

function actualizarIndicadorLente() {
  const indicador = document.getElementById('indicador-lente');
  if (!indicador) return;

  indicador.textContent = `Lente: ${obtenerNombreLente(modoCamaraActual)}`;
}

function actualizarControlesCamara(camaraEncendida) {
  const btnAlternar = document.getElementById('btn-alternar-camara');
  const btnApagar = document.getElementById('btn-apagar-camara');
  const placeholder = document.getElementById('placeholder-camara');

  if (btnAlternar) btnAlternar.disabled = !camaraEncendida;
  if (btnApagar) btnApagar.disabled = !camaraEncendida;
  if (placeholder) placeholder.hidden = camaraEncendida;
}

// --------------------------------------------------------------------------
// 3. DETECCIÓN DE ENTORNO iOS / WEBKIT Y DEGRADACIÓN ELEGANTE DE INSTALACIÓN
// - En iOS todos los navegadores usan el motor WebKit, el cual nunca dispara
//   'beforeinstallprompt'. Si detectamos un iPhone/iPad ejecutándose aún en pestaña
//   del navegador (!standalone), mostramos las instrucciones manuales de instalación.
// --------------------------------------------------------------------------
function verificarEntornoIOS() {
  const esDispositivoAppleMovil = /iPad|iPhone|iPod/.test(navigator.userAgent) ||
    (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
  const esIOS = esDispositivoAppleMovil && !window.MSStream;

  // Comprueba tanto la propiedad propietaria de Safari (navigator.standalone) como el estándar CSS display-mode
  const estaInstalada = window.navigator.standalone === true ||
    window.matchMedia('(display-mode: standalone)').matches;

  if (esIOS && !estaInstalada) {
    const guiaIOS = document.getElementById('instrucciones-ios');
    if (guiaIOS) {
      guiaIOS.hidden = false;
    }
  }
}

// --------------------------------------------------------------------------
// 4. INTERCEPCIÓN DE INSTALACIÓN NATIVA EN ANDROID / CHROMIUM
// --------------------------------------------------------------------------
window.addEventListener('beforeinstallprompt', (event) => {
  // Detiene el mini-banner automático del navegador y conserva el evento en memoria
  // para dispararlo únicamente cuando el usuario pulse nuestro botón #btn-instalar.
  event.preventDefault();
  eventoInstalacionDiferido = event;

  const btnInstalar = document.getElementById('btn-instalar');
  if (btnInstalar) {
    btnInstalar.hidden = false;
  }
});

// Se dispara cuando la PWA completa su instalación, limpiando la referencia usada
window.addEventListener('appinstalled', () => {
  const btnInstalar = document.getElementById('btn-instalar');
  if (btnInstalar) {
    btnInstalar.hidden = true;
  }
  eventoInstalacionDiferido = null;
  actualizarMensajeEstado('PWA instalada correctamente en el dispositivo.', 'activo');
});

// --------------------------------------------------------------------------
// 5. GESTIÓN DE HARDWARE MULTIMEDIA (MediaStream, track.stop y Promesas puras)
// --------------------------------------------------------------------------

/**
 * Libera físicamente el sensor deteniendo cada pista activa del MediaStream.
 * No basta con asignar `visorVideo.srcObject = null`, ya que eso solo desconecta la etiqueta
 * HTML dejando el sensor encendido y retenido por el sistema operativo. En Android e iOS/WebKit,
 * abrir la cámara frontal mientras la trasera sigue activa sin hacer `track.stop()` bloquea el
 * hardware y rechaza la promesa con `NotReadableError`.
 */
function detenerCamaraActiva() {
  if (streamActual) {
    streamActual.getTracks().forEach((track) => {
      track.stop();
    });
    streamActual = null;
  }
}

/**
 * Solicita al navegador acceso al lente indicado ('environment' = trasera | 'user' = frontal).
 * Resuelve la asincronía con .then(), diagnostica excepciones DOMException en .catch()
 * y rehabilita la UI en .finally().
 */
function iniciarCamara(modo) {
  // Feature Detection y Contexto Seguro: navigator.mediaDevices es undefined fuera de HTTPS o localhost
  if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
    actualizarMensajeEstado(
      'Esta API requiere conexión segura (HTTPS) o un navegador compatible.',
      'error'
    );
    return Promise.resolve();
  }

  // Paso obligatorio antes de abrir otro lente para evitar conflicto de hardware ocupado
  detenerCamaraActiva();

  const btnConfirmar = document.getElementById('btn-confirmar-permiso');
  if (btnConfirmar) btnConfirmar.disabled = true;

  actualizarMensajeEstado(`Solicitando acceso a cámara ${obtenerNombreLente(modo)}...`);

  const restricciones = {
    video: { facingMode: modo },
    audio: false
  };

  return navigator.mediaDevices.getUserMedia(restricciones)
    .then((stream) => {
      streamActual = stream;
      const visorVideo = document.getElementById('visor-camara');
      visorVideo.srcObject = stream;

      actualizarControlesCamara(true);
      actualizarIndicadorLente();
      actualizarMensajeEstado(`Cámara activa (${obtenerNombreLente(modo)})`, 'activo');
    })
    .catch((error) => {
      const visorVideo = document.getElementById('visor-camara');
      if (visorVideo) visorVideo.srcObject = null;
      actualizarControlesCamara(false);

      // Clasificación específica según error.name de la excepción DOMException:
      // - NotAllowedError: permiso rechazado por el usuario o bloqueado permanentemente en ajustes del navegador.
      // - NotFoundError: el dispositivo carece del sensor físico solicitado (ej. PC sin cámara).
      // - NotReadableError: el sensor existe y tiene permiso, pero está retenido por otra app o un stream previo.
      if (error.name === 'NotAllowedError') {
        actualizarMensajeEstado(
          'Permiso denegado. Habilita el acceso a la cámara en los ajustes de tu navegador.',
          'error'
        );
      } else if (error.name === 'NotFoundError') {
        actualizarMensajeEstado(
          'No se detectó el sensor de cámara solicitado en este dispositivo.',
          'error'
        );
      } else if (error.name === 'NotReadableError') {
        actualizarMensajeEstado(
          'No se pudo leer el sensor de cámara (puede estar ocupado por otra app).',
          'error'
        );
      } else {
        actualizarMensajeEstado(`Error al acceder al hardware: ${error.message}`, 'error');
      }
    })
    .finally(() => {
      // .finally() se ejecuta siempre (tanto en éxito como en fallo) para reactivar el botón
      // y prevenir múltiples solicitudes simultáneas mientras se inicializaba el sensor.
      if (btnConfirmar) btnConfirmar.disabled = false;
    });
}

// --------------------------------------------------------------------------
// 6. INICIALIZACIÓN Y EVENTOS DE INTERFAZ AL CARGAR EL DOM
// --------------------------------------------------------------------------
document.addEventListener('DOMContentLoaded', () => {
  verificarEntornoIOS();
  actualizarIndicadorLente();
  actualizarControlesCamara(false);

  const btnInstalar = document.getElementById('btn-instalar');
  const btnPrepararCamara = document.getElementById('btn-preparar-camara');
  const avisoPermiso = document.getElementById('aviso-permiso');
  const textoLentePermiso = document.getElementById('texto-lente-permiso');
  const btnConfirmarPermiso = document.getElementById('btn-confirmar-permiso');
  const btnCancelarPermiso = document.getElementById('btn-cancelar-permiso');
  const btnAlternarCamara = document.getElementById('btn-alternar-camara');
  const btnApagarCamara = document.getElementById('btn-apagar-camara');
  const visorVideo = document.getElementById('visor-camara');

  // Disparo bajo demanda del cuadro de instalación en Android / Chromium
  if (btnInstalar) {
    btnInstalar.addEventListener('click', () => {
      if (!eventoInstalacionDiferido) return;

      // .prompt() abre el diálogo nativo; por seguridad solo puede invocarse una única vez
      // sobre cada instancia del evento (reutilizarlo lanzaría InvalidStateError), por lo que
      // al resolverse .userChoice ocultamos el botón y limpiamos eventoInstalacionDiferido = null.
      eventoInstalacionDiferido.prompt();
      eventoInstalacionDiferido.userChoice
        .then((resultado) => {
          if (resultado.outcome === 'accepted') {
            btnInstalar.hidden = true;
            actualizarMensajeEstado('Instalación aceptada por el usuario.', 'activo');
          } else {
            btnInstalar.hidden = true;
            actualizarMensajeEstado('Instalación pospuesta. Recarga la página si deseas instalarla después.');
          }
          eventoInstalacionDiferido = null;
        })
        .catch((error) => {
          console.error('[PWA] Error durante el proceso de instalación:', error);
        });
    });
  }

  // Paso 1 del Patrón Pre-Permiso (UX Consciente):
  // Solo muestra la tarjeta explicativa en el DOM sin disparar todavía el diálogo nativo del navegador.
  if (btnPrepararCamara) {
    btnPrepararCamara.addEventListener('click', () => {
      if (textoLentePermiso) {
        textoLentePermiso.textContent = `Cámara que se encenderá: ${obtenerNombreLente(modoCamaraActual)}.`;
      }
      if (avisoPermiso) {
        avisoPermiso.hidden = false;
      }
    });
  }

  // Paso 2 del Patrón Pre-Permiso:
  // Con el consentimiento informado del usuario, ocultamos el aviso e invocamos getUserMedia().
  if (btnConfirmarPermiso) {
    btnConfirmarPermiso.addEventListener('click', () => {
      if (avisoPermiso) {
        avisoPermiso.hidden = true;
      }
      iniciarCamara(modoCamaraActual);
    });
  }

  // Permite desistir en la capa HTML sin quemar el permiso nativo del sistema operativo
  if (btnCancelarPermiso) {
    btnCancelarPermiso.addEventListener('click', () => {
      if (avisoPermiso) {
        avisoPermiso.hidden = true;
      }
      if (!streamActual) {
        actualizarMensajeEstado('Acceso cancelado antes de solicitar permiso al navegador.');
      }
    });
  }

  // Alternancia entre lente trasera ('environment') y frontal ('user') liberando antes el stream previo
  if (btnAlternarCamara) {
    btnAlternarCamara.addEventListener('click', () => {
      modoCamaraActual = modoCamaraActual === 'environment' ? 'user' : 'environment';
      actualizarIndicadorLente();
      iniciarCamara(modoCamaraActual);
    });
  }

  // Apagado completo: detiene pistas físicas (track.stop), desvincula el <video> y restaura el placeholder
  if (btnApagarCamara) {
    btnApagarCamara.addEventListener('click', () => {
      detenerCamaraActiva();
      if (visorVideo) {
        visorVideo.srcObject = null;
      }
      actualizarControlesCamara(false);
      actualizarMensajeEstado('Cámara apagada. Sensor liberado correctamente.');
    });
  }
});
