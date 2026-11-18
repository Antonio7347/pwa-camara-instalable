// ==========================================================================
// app.js - Instalabilidad Nativa, Pre-Permiso Ético y Control de Cámara
// Alumno: Antonio García González
// ==========================================================================
// REGLA OBLIGATORIA: 100% JavaScript Vanilla, sin librerías externas y CERO
// uso de async/await. Toda operación asíncrona usa .then(), .catch() y .finally().
// ==========================================================================

// Referencias de estado global para instalación y hardware de cámara
let eventoInstalacionDiferido = null;
let streamActual = null;
let modoCamaraActual = 'environment'; // 'environment' = cámara trasera | 'user' = cámara frontal

// --------------------------------------------------------------------------
// 1. REGISTRO DEL SERVICE WORKER (Requisito técnico para instalabilidad)
// --------------------------------------------------------------------------
if ('serviceWorker' in navigator) {
  // Se usa ruta relativa './sw.js' para respetar el subdirectorio en GitHub Pages
  navigator.serviceWorker.register('./sw.js')
    .then((registro) => {
      console.log('[PWA] Service Worker registrado en el scope:', registro.scope);
    })
    .catch((error) => {
      console.error('[PWA] Error al registrar el Service Worker:', error);
    });
}

// --------------------------------------------------------------------------
// 2. UTILIDADES DE INTERFAZ (Estado visual, lente y botones)
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
// 3. DETECCIÓN DE iPHONE / iPAD (iOS / WebKit)
// --------------------------------------------------------------------------
// En iOS, Safari nunca dispara el evento 'beforeinstallprompt'.
// Por eso verificamos si el usuario está en iOS y si aún no abre la app instalada.
function verificarEntornoIOS() {
  const esDispositivoAppleMovil = /iPad|iPhone|iPod/.test(navigator.userAgent) ||
    (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
  const esIOS = esDispositivoAppleMovil && !window.MSStream;

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
// 4. INSTALACIÓN NATIVA EN ANDROID / CHROME (beforeinstallprompt)
// --------------------------------------------------------------------------
window.addEventListener('beforeinstallprompt', (event) => {
  // Evita que Chrome muestre su mini-banner automático antes de tiempo
  event.preventDefault();
  eventoInstalacionDiferido = event;

  // Muestra nuestro botón personalizado dentro de la interfaz
  const btnInstalar = document.getElementById('btn-instalar');
  if (btnInstalar) {
    btnInstalar.hidden = false;
  }
});

// Si la app se instala desde la barra del navegador o desde nuestro botón, ocultamos el botón
window.addEventListener('appinstalled', () => {
  const btnInstalar = document.getElementById('btn-instalar');
  if (btnInstalar) {
    btnInstalar.hidden = true;
  }
  eventoInstalacionDiferido = null;
  actualizarMensajeEstado('PWA instalada correctamente en el dispositivo.', 'activo');
});

// --------------------------------------------------------------------------
// 5. CONTROL DE HARDWARE DE CÁMARA (Promesas puras con .then/.catch/.finally)
// --------------------------------------------------------------------------

// Libera todas las pistas activas del sensor antes de apagar o cambiar de cámara.
// En Android e iOS/WebKit es obligatorio detener el stream previo para evitar bloqueos.
function detenerCamaraActiva() {
  if (streamActual) {
    streamActual.getTracks().forEach((track) => {
      track.stop();
    });
    streamActual = null;
  }
}

// Solicita el acceso a la cámara indicada ('environment' o 'user')
function iniciarCamara(modo) {
  // Verificación de seguridad: getUserMedia solo existe bajo HTTPS o localhost
  if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
    actualizarMensajeEstado(
      'Esta API requiere conexión segura (HTTPS) o un navegador compatible.',
      'error'
    );
    return Promise.resolve();
  }

  // Siempre liberamos la cámara anterior antes de encender otra
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
      // Se ejecuta siempre (haya éxito o error) para reactivar el botón de confirmación
      if (btnConfirmar) btnConfirmar.disabled = false;
    });
}

// --------------------------------------------------------------------------
// 6. CONEXIÓN DE EVENTOS DE LA INTERFAZ AL CARGAR EL DOM
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

  // Botón personalizado de instalación (Android / Chrome)
  if (btnInstalar) {
    btnInstalar.addEventListener('click', () => {
      if (!eventoInstalacionDiferido) return;

      // Muestra el diálogo nativo de instalación y escucha la decisión del usuario
      eventoInstalacionDiferido.prompt();
      eventoInstalacionDiferido.userChoice
        .then((resultado) => {
          if (resultado.outcome === 'accepted') {
            btnInstalar.hidden = true;
            actualizarMensajeEstado('Instalación aceptada por el usuario.', 'activo');
          } else {
            // Chrome solo permite usar prompt() una vez por cada evento beforeinstallprompt
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

  // Paso 1 del flujo ético (Pre-Permiso): muestra la tarjeta informativa sin tocar el hardware
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

  // Paso 2 del flujo ético: el usuario confirma y recién ahora invocamos getUserMedia()
  if (btnConfirmarPermiso) {
    btnConfirmarPermiso.addEventListener('click', () => {
      if (avisoPermiso) {
        avisoPermiso.hidden = true;
      }
      iniciarCamara(modoCamaraActual);
    });
  }

  // Opción de cancelar dentro del aviso previo sin disparar el diálogo nativo
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

  // Alternar entre cámara trasera ('environment') y cámara frontal ('user')
  if (btnAlternarCamara) {
    btnAlternarCamara.addEventListener('click', () => {
      modoCamaraActual = modoCamaraActual === 'environment' ? 'user' : 'environment';
      actualizarIndicadorLente();
      iniciarCamara(modoCamaraActual);
    });
  }

  // Apagar cámara: detiene los tracks, limpia el video y actualiza el estado
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
