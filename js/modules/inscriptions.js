/**
 * ============================================================
 * js/modules/inscriptions.js
 * FISI Events — Módulo de Inscripciones
 * ============================================================
 */

import { CONFIG_SISTEMA, STORAGE_KEYS, DB_VARS } from '../config.js';
import {
    mostrarAlertaFlotante,
    verificarYConfirmarChoqueHorario,
} from '../utils/alerts.js';

const TABLA_INSCRIPCIONES = 'inscripciones';
const TABLA_EVENTOS       = 'eventos';

/* ── Helpers de red ──────────────────────────────────────── */
function _construirHeaders() {
    return new Headers({
        'Content-Type':  'application/json',
        'apikey':        DB_VARS.KEY,
        'Authorization': `Bearer ${DB_VARS.KEY}`,
        'Prefer':        'return=representation',
    });
}

function _hayConexion() {
    return navigator.onLine;
}

/* ── Helpers localStorage ────────────────────────────────── */
function _leerInscripcionesLocales() {
    try {
        const raw = localStorage.getItem(STORAGE_KEYS.INSCRIPCIONES_LOCAL ?? 'fisi_inscripciones');
        return raw ? JSON.parse(raw) : [];
    } catch {
        return [];
    }
}

function _guardarInscripcionesLocales(inscripciones) {
    localStorage.setItem(
        STORAGE_KEYS.INSCRIPCIONES_LOCAL ?? 'fisi_inscripciones',
        JSON.stringify(inscripciones)
    );
}

/* ── Algoritmo de colisión temporal ─────────────────────── */
function _eventosColisionan(fechaA, inicioA, finA, fechaB, inicioB, finB) {
    if (fechaA !== fechaB) return false;
    const toMin = (h) => {
        if (!h) return null;
        const p = String(h).split(':').map(Number);
        return p[0] * 60 + (p[1] ?? 0);
    };
    const iA = toMin(inicioA), fA = toMin(finA);
    const iB = toMin(inicioB), fB = toMin(finB);
    if (fA === null || fB === null) return false;
    return iA < fB && iB < fA;
}

/* ── Obtener inscripciones del alumno ────────────────────── */
async function _obtenerInscripcionesDelAlumno(userId) {
    if (!_hayConexion()) {
        return _leerInscripcionesLocales().filter(ins => ins.user_id === userId);
    }
    try {
        const url = new URL(`${DB_VARS.URL}/rest/v1/${TABLA_INSCRIPCIONES}`);
        url.searchParams.set('select', `*,${TABLA_EVENTOS}(id,titulo,fecha_inicio,hora_inicio,hora_fin,estado,capacidad_max)`);
        url.searchParams.set('user_id', `eq.${userId}`);
        const resp = await fetch(url.toString(), { method: 'GET', headers: _construirHeaders() });
        if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
        const datos = await resp.json();
        return Array.isArray(datos) ? datos : [];
    } catch (err) {
        console.error('[inscriptions] Error obteniendo inscripciones:', err);
        return _leerInscripcionesLocales().filter(ins => ins.user_id === userId);
    }
}

/* ── Verificar aforo ─────────────────────────────────────── */
async function _verificarAforo(eventId, capacidad) {
    if (capacidad === null || capacidad === undefined) return { disponible: true, inscritos: 0 };
    if (!_hayConexion()) {
        const todas    = _leerInscripcionesLocales();
        const inscritos = todas.filter(ins => String(ins.event_id) === String(eventId)).length;
        return { disponible: inscritos < capacidad, inscritos };
    }
    try {
        const url = new URL(`${DB_VARS.URL}/rest/v1/${TABLA_INSCRIPCIONES}`);
        url.searchParams.set('select',   'id');
        url.searchParams.set('event_id', `eq.${eventId}`);
        const headers = _construirHeaders();
        headers.set('Prefer', 'count=exact');
        const resp = await fetch(url.toString(), { method: 'GET', headers });
        if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
        const cr       = resp.headers.get('Content-Range') ?? '';
        const match    = cr.match(/\/(\d+)$/);
        const inscritos = match ? parseInt(match[1], 10) : 0;
        return { disponible: inscritos < Number(capacidad), inscritos };
    } catch (err) {
        console.error('[inscriptions] Error verificando aforo:', err);
        const todas     = _leerInscripcionesLocales();
        const inscritos = todas.filter(ins => String(ins.event_id) === String(eventId)).length;
        return { disponible: inscritos < capacidad, inscritos };
    }
}

/* ============================================================
   inscribir — flujo principal
   ============================================================ */
export async function inscribir(userId, eventoNuevo, btnRef = null) {
    try {
        // 1. Validar estado del evento
        const estadoEvento = eventoNuevo.estado || eventoNuevo.status;
        if (estadoEvento !== CONFIG_SISTEMA.STATUS_EVENTO.PROGRAMADO) {
            const msgEstado = estadoEvento === CONFIG_SISTEMA.STATUS_EVENTO.EN_CURSO
                ? 'Las inscripciones ya están cerradas (evento en curso).'
                : 'No es posible inscribirse a un evento finalizado.';
            mostrarAlertaFlotante(msgEstado, 'error');
            return { exito: false, mensaje: msgEstado };
        }

        // 2. Verificar aforo
        const { disponible, inscritos } = await _verificarAforo(
            eventoNuevo.id,
            eventoNuevo.capacidad_max ?? eventoNuevo.maxCapacity
        );
        if (!disponible) {
            if (btnRef) { btnRef.disabled = true; btnRef.textContent = 'LLENO'; }
            const msgAforo = `Evento al máximo de capacidad (${inscritos} inscritos).`;
            mostrarAlertaFlotante(msgAforo, 'aviso');
            return { exito: false, mensaje: msgAforo };
        }

        // 3. Obtener inscripciones actuales
        const inscripcionesActuales = await _obtenerInscripcionesDelAlumno(userId);

        // 4. Detectar cruces de horario
        let hayChoque = false;
        for (const ins of inscripcionesActuales) {
            const ev = ins.eventos ?? ins;
            if (!ev.fecha_inicio || !ev.hora_inicio || !ev.hora_fin) continue;
            if (_eventosColisionan(
                eventoNuevo.fecha_inicio || eventoNuevo.startDate,
                eventoNuevo.hora_inicio  || eventoNuevo.startTime,
                eventoNuevo.hora_fin     || eventoNuevo.endTime,
                ev.fecha_inicio, ev.hora_inicio, ev.hora_fin
            )) { hayChoque = true; break; }
        }

        if (hayChoque) {
            const confirmado = await verificarYConfirmarChoqueHorario(
                eventoNuevo.titulo || eventoNuevo.title,
                eventoNuevo.fecha_inicio || eventoNuevo.startDate,
                eventoNuevo.hora_inicio  || eventoNuevo.startTime,
                eventoNuevo.hora_fin     || eventoNuevo.endTime,
            );
            if (!confirmado) return { exito: false, mensaje: 'Inscripción cancelada por choque de horario.' };
        }

        // 5. Insertar la inscripción
        const nuevaInscripcion = {
            user_id:           userId,
            event_id:          eventoNuevo.id,
            fecha_inscripcion: new Date().toISOString(),
        };

        if (_hayConexion()) {
            const url  = `${DB_VARS.URL}/rest/v1/${TABLA_INSCRIPCIONES}`;
            const resp = await fetch(url, {
                method:  'POST',
                headers: _construirHeaders(),
                body:    JSON.stringify(nuevaInscripcion),
            });
            if (resp.status === 409) {
                const msgDup = 'Ya estás inscrito en este evento.';
                mostrarAlertaFlotante(msgDup, 'aviso');
                return { exito: false, mensaje: msgDup };
            }
            if (!resp.ok) {
                const err = await resp.json().catch(() => ({}));
                throw new Error(err.message ?? `HTTP ${resp.status}`);
            }
            const [inscripcionCreada] = await resp.json();
            mostrarAlertaFlotante(`¡Inscripción exitosa a "${eventoNuevo.titulo || eventoNuevo.title}"!`, 'exito');
            return { exito: true, mensaje: 'Inscripción registrada.', inscripcion: inscripcionCreada };
        } else {
            const locales  = _leerInscripcionesLocales();
            const yaExiste = locales.some(
                ins => ins.user_id === userId && String(ins.event_id) === String(eventoNuevo.id)
            );
            if (yaExiste) {
                const msgDup = 'Ya estás inscrito en este evento.';
                mostrarAlertaFlotante(msgDup, 'aviso');
                return { exito: false, mensaje: msgDup };
            }
            nuevaInscripcion.id = Date.now();
            locales.push(nuevaInscripcion);
            _guardarInscripcionesLocales(locales);
            mostrarAlertaFlotante(`Inscripción guardada localmente (sin conexión).`, 'aviso');
            return { exito: true, mensaje: 'Inscripción en modo offline.', inscripcion: nuevaInscripcion };
        }
    } catch (err) {
        console.error('[inscriptions] Error crítico al inscribir:', err);
        mostrarAlertaFlotante('Error inesperado al procesar la inscripción.', 'error');
        return { exito: false, mensaje: err.message ?? 'Error desconocido.' };
    }
}

/* ============================================================
   cancelarInscripcion
   ============================================================ */
export async function cancelarInscripcion(userId, eventId) {
    try {
        if (_hayConexion()) {
            const url = new URL(`${DB_VARS.URL}/rest/v1/${TABLA_INSCRIPCIONES}`);
            url.searchParams.set('user_id',  `eq.${userId}`);
            url.searchParams.set('event_id', `eq.${eventId}`);
            const resp = await fetch(url.toString(), { method: 'DELETE', headers: _construirHeaders() });
            if (!resp.ok) {
                const err = await resp.json().catch(() => ({}));
                throw new Error(err.message ?? `HTTP ${resp.status}`);
            }
            mostrarAlertaFlotante('Inscripción cancelada exitosamente.', 'exito');
            return { exito: true, mensaje: 'Inscripción eliminada de la base de datos.' };
        } else {
            const locales  = _leerInscripcionesLocales();
            const filtradas = locales.filter(
                ins => !(ins.user_id === userId && String(ins.event_id) === String(eventId))
            );
            _guardarInscripcionesLocales(filtradas);
            mostrarAlertaFlotante('Inscripción cancelada localmente (sin conexión).', 'aviso');
            return { exito: true, mensaje: 'Inscripción eliminada offline.' };
        }
    } catch (err) {
        console.error('[inscriptions] Error al cancelar inscripción:', err);
        mostrarAlertaFlotante('No se pudo cancelar la inscripción.', 'error');
        return { exito: false, mensaje: err.message ?? 'Error desconocido.' };
    }
}

/* ============================================================
   estaInscrito
   ============================================================ */
export async function estaInscrito(userId, eventId) {
    try {
        if (_hayConexion()) {
            const url = new URL(`${DB_VARS.URL}/rest/v1/${TABLA_INSCRIPCIONES}`);
            url.searchParams.set('select',   'id');
            url.searchParams.set('user_id',  `eq.${userId}`);
            url.searchParams.set('event_id', `eq.${eventId}`);
            url.searchParams.set('limit',    '1');
            const resp = await fetch(url.toString(), { method: 'GET', headers: _construirHeaders() });
            if (!resp.ok) return false;
            const datos = await resp.json();
            return Array.isArray(datos) && datos.length > 0;
        } else {
            return _leerInscripcionesLocales().some(
                ins => ins.user_id === userId && String(ins.event_id) === String(eventId)
            );
        }
    } catch {
        return false;
    }
}

/* ============================================================
   obtenerMisInscripciones / obtenerInscripcionesAlumno
   — con datos enriquecidos del evento para el dashboard
   ============================================================ */
export async function obtenerMisInscripciones(userId) {
    return _obtenerInscripcionesDelAlumno(userId);
}

// Alias para dashboard-alumno.html
export async function obtenerInscripcionesAlumno(userId) {
    const raw = await _obtenerInscripcionesDelAlumno(userId);
    // Normalizar a formato JS camelCase con datos del evento aplanados
    return raw.map(ins => {
        const ev = ins.eventos ?? {};
        return {
            id:           ins.id,
            userId:       ins.user_id,
            eventId:      ins.event_id,
            inscribedAt:  ins.fecha_inscripcion,
            // Datos del evento (pueden venir del join o de la inscripción local)
            title:        ev.titulo       || ins.titulo       || '',
            category:     ev.categoria    || ins.categoria    || '',
            startDate:    ev.fecha_inicio || ins.fecha_inicio || '',
            startTime:    ev.hora_inicio  || ins.hora_inicio  || '',
            endTime:      ev.hora_fin     || ins.hora_fin     || '',
            estado:       ev.estado       || ins.estado       || CONFIG_SISTEMA.STATUS_EVENTO.PROGRAMADO,
            status:       ev.estado       || ins.estado       || CONFIG_SISTEMA.STATUS_EVENTO.PROGRAMADO,
            maxCapacity:  ev.capacidad_max ?? ins.capacidad_max ?? null,
        };
    });
}
