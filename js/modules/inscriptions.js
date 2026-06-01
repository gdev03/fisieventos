/**
 * @file inscriptions.js
 * @description Módulo de gestión de inscripciones para FISI Events.
 *   Realiza validación de aforo disponible, detección de choque de horarios
 *   y operaciones CRUD contra la REST API de Supabase, con fallback a LocalStorage.
 * @module modules/inscriptions
 */

import { CONFIG_SISTEMA, STORAGE_KEYS, DB_VARS } from '../config.js';
import {
  mostrarAlertaFlotante,
  verificarYConfirmarChoqueHorario,
} from '../utils/alerts.js';

/* ─────────────────────────────────────────────────────────────────────────── *
 * SECCIÓN 1 – CONSTANTES INTERNAS                                             *
 * ─────────────────────────────────────────────────────────────────────────── */

const TABLA_INSCRIPCIONES = 'inscripciones';
const TABLA_EVENTOS        = 'eventos';

/* ─────────────────────────────────────────────────────────────────────────── *
 * SECCIÓN 2 – HELPERS DE RED                                                  *
 * ─────────────────────────────────────────────────────────────────────────── */

/**
 * Construye las cabeceras HTTP estándar para las peticiones a Supabase.
 * @returns {Headers}
 */
function _construirHeaders() {
  return new Headers({
    'Content-Type': 'application/json',
    'apikey':        DB_VARS.KEY,
    'Authorization': `Bearer ${DB_VARS.KEY}`,
    'Prefer':        'return=representation',
  });
}

/**
 * Determina si hay conectividad disponible para operar en modo red.
 * @returns {boolean}
 */
function _hayConexion() {
  return navigator.onLine;
}

/* ─────────────────────────────────────────────────────────────────────────── *
 * SECCIÓN 3 – OPERACIONES LOCALSTORAGE (FALLBACK OFFLINE)                     *
 * ─────────────────────────────────────────────────────────────────────────── */

/**
 * Lee la colección de inscripciones almacenada localmente.
 * @returns {Array<Object>}
 */
function _leerInscripcionesLocales() {
  try {
    const raw = localStorage.getItem(STORAGE_KEYS.INSCRIPCIONES_LOCAL ?? 'fisi_inscripciones');
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

/**
 * Persiste la colección de inscripciones en LocalStorage.
 * @param {Array<Object>} inscripciones
 */
function _guardarInscripcionesLocales(inscripciones) {
  localStorage.setItem(
    STORAGE_KEYS.INSCRIPCIONES_LOCAL ?? 'fisi_inscripciones',
    JSON.stringify(inscripciones),
  );
}

/* ─────────────────────────────────────────────────────────────────────────── *
 * SECCIÓN 4 – ALGORITMO DE COLISIÓN TEMPORAL (LADO CLIENTE)                   *
 * ─────────────────────────────────────────────────────────────────────────── */

/**
 * Determina si dos eventos se intersectan temporalmente.
 *
 * Criterio matemático estricto: los eventos A y B colisionan si y solo si
 *   EventoA.hora_inicio < EventoB.hora_fin  AND  EventoB.hora_inicio < EventoA.hora_fin
 *
 * @param {string} fechaA   - Fecha del evento A en formato YYYY-MM-DD.
 * @param {string} inicioA  - Hora de inicio del evento A en formato HH:MM o HH:MM:SS.
 * @param {string} finA     - Hora de fin del evento A.
 * @param {string} fechaB   - Fecha del evento B.
 * @param {string} inicioB  - Hora de inicio del evento B.
 * @param {string} finB     - Hora de fin del evento B.
 * @returns {boolean} `true` si los eventos se intersectan.
 */
function _eventosColisionan(fechaA, inicioA, finA, fechaB, inicioB, finB) {
  // Solo aplicar si comparten la misma fecha de inicio
  if (fechaA !== fechaB) return false;

  // Convertir horas a minutos desde medianoche para comparación numérica
  const toMinutos = (horaStr) => {
    if (!horaStr) return null;
    const partes = String(horaStr).split(':').map(Number);
    return partes[0] * 60 + (partes[1] ?? 0);
  };

  const inicioAMin = toMinutos(inicioA);
  const finAMin    = toMinutos(finA);
  const inicioBMin = toMinutos(inicioB);
  const finBMin    = toMinutos(finB);

  // Si alguno no tiene hora de fin definida, no es posible determinar colisión
  if (finAMin === null || finBMin === null) return false;

  // Inecuación de intersección de intervalos
  return inicioAMin < finBMin && inicioBMin < finAMin;
}

/* ─────────────────────────────────────────────────────────────────────────── *
 * SECCIÓN 5 – LECTURA DE INSCRIPCIONES DEL ALUMNO LOGUEADO                   *
 * ─────────────────────────────────────────────────────────────────────────── */

/**
 * Recupera todas las inscripciones activas del alumno autenticado,
 * incluyendo los datos del evento asociado para la validación de horarios.
 *
 * @param {string} userId - UUID del alumno autenticado.
 * @returns {Promise<Array<Object>>} Lista de inscripciones enriquecidas con datos del evento.
 */
async function _obtenerInscripcionesDelAlumno(userId) {
  if (!_hayConexion()) {
    // Fallback: filtrar inscripciones del alumno desde LocalStorage
    const todas = _leerInscripcionesLocales();
    return todas.filter((ins) => ins.user_id === userId);
  }

  try {
    // Consulta: inscripciones del alumno + datos del evento (join implícito via select)
    const url = new URL(`${DB_VARS.URL}/rest/v1/${TABLA_INSCRIPCIONES}`);
    url.searchParams.set('select', `*,${TABLA_EVENTOS}(id,titulo,fecha_inicio,hora_inicio,hora_fin,estado,capacidad_max)`);
    url.searchParams.set('user_id', `eq.${userId}`);

    const respuesta = await fetch(url.toString(), {
      method:  'GET',
      headers: _construirHeaders(),
    });

    if (!respuesta.ok) {
      const errorBody = await respuesta.json().catch(() => ({}));
      throw new Error(errorBody.message ?? `Error HTTP ${respuesta.status} al obtener inscripciones.`);
    }

    const datos = await respuesta.json();
    return Array.isArray(datos) ? datos : [];
  } catch (err) {
    console.error('[inscriptions] Error al obtener inscripciones del alumno:', err);
    // Degradar a LocalStorage
    const todas = _leerInscripcionesLocales();
    return todas.filter((ins) => ins.user_id === userId);
  }
}

/* ─────────────────────────────────────────────────────────────────────────── *
 * SECCIÓN 6 – VALIDACIÓN DE AFORO                                             *
 * ─────────────────────────────────────────────────────────────────────────── */

/**
 * Consulta el número actual de inscriptos para un evento y lo compara
 * con la capacidad máxima definida.
 *
 * @param {number|string} eventId   - ID del evento a verificar.
 * @param {number|null}   capacidad - Capacidad máxima del evento (null = ilimitado).
 * @returns {Promise<{disponible: boolean, inscritos: number}>}
 */
async function _verificarAforo(eventId, capacidad) {
  // Si el evento no tiene límite de capacidad, siempre está disponible
  if (capacidad === null || capacidad === undefined) {
    return { disponible: true, inscritos: 0 };
  }

  if (!_hayConexion()) {
    const todas    = _leerInscripcionesLocales();
    const inscritos = todas.filter((ins) => String(ins.event_id) === String(eventId)).length;
    return { disponible: inscritos < capacidad, inscritos };
  }

  try {
    const url = new URL(`${DB_VARS.URL}/rest/v1/${TABLA_INSCRIPCIONES}`);
    url.searchParams.set('select', 'id');
    url.searchParams.set('event_id', `eq.${eventId}`);

    // Pedir conteo exacto mediante cabecera Prefer de Supabase
    const headers = _construirHeaders();
    headers.set('Prefer', 'count=exact');

    const respuesta = await fetch(url.toString(), {
      method:  'GET',
      headers: headers,
    });

    if (!respuesta.ok) {
      throw new Error(`Error HTTP ${respuesta.status} al consultar aforo.`);
    }

    // Supabase devuelve el conteo en la cabecera Content-Range
    const contentRange = respuesta.headers.get('Content-Range') ?? '';
    const match        = contentRange.match(/\/(\d+)$/);
    const inscritos    = match ? parseInt(match[1], 10) : 0;

    return {
      disponible: inscritos < Number(capacidad),
      inscritos,
    };
  } catch (err) {
    console.error('[inscriptions] Error al verificar aforo:', err);
    // En caso de fallo de red, permitir intentar localmente
    const todas     = _leerInscripcionesLocales();
    const inscritos = todas.filter((ins) => String(ins.event_id) === String(eventId)).length;
    return { disponible: inscritos < capacidad, inscritos };
  }
}

/* ─────────────────────────────────────────────────────────────────────────── *
 * SECCIÓN 7 – INSCRIPCIÓN PRINCIPAL (FLUJO ATÓMICO)                          *
 * ─────────────────────────────────────────────────────────────────────────── */

/**
 * Procesa la inscripción de un alumno a un evento de forma atómica.
 *
 * Flujo:
 *  1. Verifica que el evento esté en estado 'programado'.
 *  2. Comprueba aforo disponible.
 *  3. Detecta cruces de horario y pide confirmación consciente al alumno.
 *  4. Inserta la fila en la tabla `inscripciones`.
 *
 * @param {string} userId         - UUID del alumno autenticado.
 * @param {Object} eventoNuevo    - Objeto con los datos del evento objetivo.
 * @param {number|string} eventoNuevo.id
 * @param {string} eventoNuevo.titulo
 * @param {string} eventoNuevo.fecha_inicio  - YYYY-MM-DD
 * @param {string} eventoNuevo.hora_inicio   - HH:MM
 * @param {string} eventoNuevo.hora_fin      - HH:MM
 * @param {string} eventoNuevo.estado        - Valor de CONFIG_SISTEMA.STATUS_EVENTO
 * @param {number|null} eventoNuevo.capacidad_max
 * @param {HTMLButtonElement|null} [btnRef=null] - Botón de referencia para mutar visualmente.
 * @returns {Promise<{exito: boolean, mensaje: string, inscripcion?: Object}>}
 */
export async function inscribir(userId, eventoNuevo, btnRef = null) {
  try {
    /* ── 1. Validar estado del evento ──────────────────────────────────── */
    if (eventoNuevo.estado !== CONFIG_SISTEMA.STATUS_EVENTO.PROGRAMADO) {
      const msgEstado = eventoNuevo.estado === CONFIG_SISTEMA.STATUS_EVENTO.EN_CURSO
        ? 'Las inscripciones a este evento ya están cerradas (evento en curso).'
        : 'No es posible inscribirse a un evento finalizado.';
      mostrarAlertaFlotante(msgEstado, 'error');
      return { exito: false, mensaje: msgEstado };
    }

    /* ── 2. Verificar aforo ────────────────────────────────────────────── */
    const { disponible, inscritos } = await _verificarAforo(
      eventoNuevo.id,
      eventoNuevo.capacidad_max,
    );

    if (!disponible) {
      // Mutar el botón a "LLENO" si se proporcionó referencia
      if (btnRef) {
        btnRef.disabled    = true;
        btnRef.textContent = 'LLENO';
        btnRef.classList.add('btn-evento-lleno');
      }
      const msgAforo = `Este evento ha alcanzado su capacidad máxima (${inscritos} inscritos). Cupos agotados.`;
      mostrarAlertaFlotante(msgAforo, 'aviso');
      return { exito: false, mensaje: msgAforo };
    }

    /* ── 3. Obtener inscripciones actuales del alumno ──────────────────── */
    const inscripcionesActuales = await _obtenerInscripcionesDelAlumno(userId);

    /* ── 4. Detectar cruces de horario ─────────────────────────────────── */
    let hayChoque = false;

    for (const ins of inscripcionesActuales) {
      // El objeto del evento puede estar anidado en la propiedad 'eventos' (join de Supabase)
      const evExistente = ins.eventos ?? ins;

      if (!evExistente.fecha_inicio || !evExistente.hora_inicio || !evExistente.hora_fin) {
        continue; // Datos incompletos, no se puede comparar
      }

      if (
        _eventosColisionan(
          eventoNuevo.fecha_inicio,
          eventoNuevo.hora_inicio,
          eventoNuevo.hora_fin,
          evExistente.fecha_inicio,
          evExistente.hora_inicio,
          evExistente.hora_fin,
        )
      ) {
        hayChoque = true;
        break;
      }
    }

    if (hayChoque) {
      const confirmado = await verificarYConfirmarChoqueHorario(
        eventoNuevo.titulo,
        eventoNuevo.fecha_inicio,
        eventoNuevo.hora_inicio,
        eventoNuevo.hora_fin,
      );

      if (!confirmado) {
        return { exito: false, mensaje: 'Inscripción cancelada por el alumno (choque de horario).' };
      }
    }

    /* ── 5. Insertar la inscripción ────────────────────────────────────── */
    const nuevaInscripcion = {
      user_id:          userId,
      event_id:         eventoNuevo.id,
      fecha_inscripcion: new Date().toISOString(),
    };

    if (_hayConexion()) {
      const url      = `${DB_VARS.URL}/rest/v1/${TABLA_INSCRIPCIONES}`;
      const respuesta = await fetch(url, {
        method:  'POST',
        headers: _construirHeaders(),
        body:    JSON.stringify(nuevaInscripcion),
      });

      if (respuesta.status === 409) {
        // Violación de UNIQUE(user_id, event_id) → ya estaba inscrito
        const msgDuplicado = 'Ya estás inscrito en este evento.';
        mostrarAlertaFlotante(msgDuplicado, 'aviso');
        return { exito: false, mensaje: msgDuplicado };
      }

      if (!respuesta.ok) {
        const errorBody = await respuesta.json().catch(() => ({}));
        throw new Error(errorBody.message ?? `Error HTTP ${respuesta.status} al inscribir.`);
      }

      const [inscripcionCreada] = await respuesta.json();
      mostrarAlertaFlotante(`¡Inscripción exitosa a "${eventoNuevo.titulo}"!`, 'exito');
      return { exito: true, mensaje: 'Inscripción registrada correctamente.', inscripcion: inscripcionCreada };
    } else {
      // Fallback offline: guardar en LocalStorage
      const locales = _leerInscripcionesLocales();

      const yaExiste = locales.some(
        (ins) => ins.user_id === userId && String(ins.event_id) === String(eventoNuevo.id),
      );
      if (yaExiste) {
        const msgDuplicado = 'Ya estás inscrito en este evento.';
        mostrarAlertaFlotante(msgDuplicado, 'aviso');
        return { exito: false, mensaje: msgDuplicado };
      }

      nuevaInscripcion.id = Date.now(); // ID temporal offline
      locales.push(nuevaInscripcion);
      _guardarInscripcionesLocales(locales);

      mostrarAlertaFlotante(
        `Inscripción guardada localmente (sin conexión) para "${eventoNuevo.titulo}".`,
        'aviso',
      );
      return { exito: true, mensaje: 'Inscripción registrada en modo offline.', inscripcion: nuevaInscripcion };
    }
  } catch (err) {
    console.error('[inscriptions] Error crítico al inscribir:', err);
    mostrarAlertaFlotante('Ocurrió un error inesperado al procesar la inscripción.', 'error');
    return { exito: false, mensaje: err.message ?? 'Error desconocido.' };
  }
}

/* ─────────────────────────────────────────────────────────────────────────── *
 * SECCIÓN 8 – CANCELAR INSCRIPCIÓN                                            *
 * ─────────────────────────────────────────────────────────────────────────── */

/**
 * Cancela la inscripción de un alumno a un evento.
 *
 * @param {string} userId   - UUID del alumno autenticado.
 * @param {number|string} eventId - ID del evento a cancelar.
 * @returns {Promise<{exito: boolean, mensaje: string}>}
 */
export async function cancelarInscripcion(userId, eventId) {
  try {
    if (_hayConexion()) {
      const url = new URL(`${DB_VARS.URL}/rest/v1/${TABLA_INSCRIPCIONES}`);
      url.searchParams.set('user_id',  `eq.${userId}`);
      url.searchParams.set('event_id', `eq.${eventId}`);

      const respuesta = await fetch(url.toString(), {
        method:  'DELETE',
        headers: _construirHeaders(),
      });

      if (!respuesta.ok) {
        const errorBody = await respuesta.json().catch(() => ({}));
        throw new Error(errorBody.message ?? `Error HTTP ${respuesta.status} al cancelar.`);
      }

      mostrarAlertaFlotante('Inscripción cancelada exitosamente.', 'exito');
      return { exito: true, mensaje: 'Inscripción eliminada de la base de datos.' };
    } else {
      // Fallback offline
      const locales     = _leerInscripcionesLocales();
      const filtradas   = locales.filter(
        (ins) => !(ins.user_id === userId && String(ins.event_id) === String(eventId)),
      );
      _guardarInscripcionesLocales(filtradas);

      mostrarAlertaFlotante('Inscripción cancelada localmente (sin conexión).', 'aviso');
      return { exito: true, mensaje: 'Inscripción eliminada en modo offline.' };
    }
  } catch (err) {
    console.error('[inscriptions] Error al cancelar inscripción:', err);
    mostrarAlertaFlotante('No se pudo cancelar la inscripción. Intente nuevamente.', 'error');
    return { exito: false, mensaje: err.message ?? 'Error desconocido.' };
  }
}

/* ─────────────────────────────────────────────────────────────────────────── *
 * SECCIÓN 9 – VERIFICAR INSCRIPCIÓN EXISTENTE                                 *
 * ─────────────────────────────────────────────────────────────────────────── */

/**
 * Comprueba si un alumno ya está inscrito en un evento específico.
 *
 * @param {string} userId  - UUID del alumno.
 * @param {number|string} eventId - ID del evento.
 * @returns {Promise<boolean>} `true` si ya existe una inscripción.
 */
export async function estaInscrito(userId, eventId) {
  try {
    if (_hayConexion()) {
      const url = new URL(`${DB_VARS.URL}/rest/v1/${TABLA_INSCRIPCIONES}`);
      url.searchParams.set('select',   'id');
      url.searchParams.set('user_id',  `eq.${userId}`);
      url.searchParams.set('event_id', `eq.${eventId}`);
      url.searchParams.set('limit',    '1');

      const headers = _construirHeaders();
      headers.set('Prefer', 'count=exact');

      const respuesta = await fetch(url.toString(), { method: 'GET', headers });
      if (!respuesta.ok) return false;

      const datos = await respuesta.json();
      return Array.isArray(datos) && datos.length > 0;
    } else {
      const locales = _leerInscripcionesLocales();
      return locales.some(
        (ins) => ins.user_id === userId && String(ins.event_id) === String(eventId),
      );
    }
  } catch {
    return false;
  }
}

/**
 * Recupera las inscripciones completas de un alumno (con datos de evento).
 * Expuesto para uso externo en los dashboards.
 *
 * @param {string} userId - UUID del alumno.
 * @returns {Promise<Array<Object>>}
 */
export async function obtenerMisInscripciones(userId) {
  return _obtenerInscripcionesDelAlumno(userId);
}
