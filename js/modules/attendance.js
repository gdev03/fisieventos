/**
 * ============================================================
 * js/modules/attendance.js
 * FISI Events — Módulo de Control de Asistencia
 * ============================================================
 */

import { CONFIG_SISTEMA, DB_VARS } from '../config.js';
import { obtenerEventoPorId } from './events.js';

const { EN_CURSO, FINALIZADO } = CONFIG_SISTEMA.STATUS_EVENTO;

const ASISTENCIA_KEY  = 'fisi_asistencias';
const INSCRIPCION_KEY = 'fisi_inscripciones';

/* ── Helpers localStorage ────────────────────────────────── */
function _leerRegistros(clave) {
    try { return JSON.parse(localStorage.getItem(clave) || '{}'); } catch { return {}; }
}
function _guardarRegistros(clave, registros) {
    localStorage.setItem(clave, JSON.stringify(registros));
}

/* ── Clave compuesta ─────────────────────────────────────── */
const _clave = (eventoId, userId) => `${eventoId}::${userId}`;

/* ── Cabeceras Supabase ──────────────────────────────────── */
function _headers() {
    return {
        'Content-Type':  'application/json',
        'apikey':        DB_VARS.KEY,
        'Authorization': `Bearer ${DB_VARS.KEY}`,
        'Prefer':        'return=representation,resolution=merge-duplicates',
    };
}

/* ============================================================
   marcarAsistencia
   ============================================================ */
export async function marcarAsistencia(authUserId, eventoId, asistio) {
    const id = parseInt(eventoId);
    const evento = await obtenerEventoPorId(id);
    if (!evento) throw new Error('Evento no encontrado.');

    const estadoEvento = evento.status || evento.estado;
    if (estadoEvento === FINALIZADO) {
        throw new Error(`El evento #${id} está FINALIZADO. La lista de asistencia es inmutable.`);
    }
    if (estadoEvento !== EN_CURSO) {
        throw new Error(`El evento #${id} no está EN_CURSO. Solo se puede registrar asistencia durante el evento.`);
    }

    const payloadSQL = {
        user_id:    authUserId,
        event_id:   id,
        asistio:    asistio,
        marcado_en: asistio ? new Date().toISOString() : null,
    };

    try {
        const resp = await fetch(`${DB_VARS.URL}/rest/v1/asistencias`, {
            method:  'POST',
            headers: _headers(),
            body:    JSON.stringify(payloadSQL),
        });
        if (!resp.ok) throw new Error('Error al registrar asistencia en la BDD.');
        const [registro] = await resp.json();
        return {
            eventId:  registro.event_id,
            userId:   registro.user_id,
            attended: registro.asistio,
            markedAt: registro.marcado_en
        };
    } catch (networkErr) {
        console.warn('[attendance.js] BDD inaccesible, usando localStorage:', networkErr.message);
    }

    // Modo demo
    const registros = _leerRegistros(ASISTENCIA_KEY);
    const key = _clave(id, authUserId);
    if (asistio) {
        registros[key] = { evento_id: id, user_id: authUserId, asistio: true, marcado_en: new Date().toISOString() };
    } else {
        delete registros[key];
    }
    _guardarRegistros(ASISTENCIA_KEY, registros);
    return registros[key]
        ? { eventId: id, userId: authUserId, attended: true, markedAt: registros[key].marcado_en }
        : { attended: false };
}

/* ============================================================
   obtenerAsistencias — retorna UUIDs de asistentes de un evento
   ============================================================ */
export function obtenerAsistencias(eventoId) {
    const id = parseInt(eventoId);
    const registros = _leerRegistros(ASISTENCIA_KEY);
    return Object.values(registros)
        .filter(r => parseInt(r.evento_id) === id && r.asistio === true)
        .map(r => r.user_id);
}

/* ============================================================
   estaCongelado
   ============================================================ */
export async function estaCongelado(eventoId) {
    const evento = await obtenerEventoPorId(eventoId);
    const estado = evento?.status || evento?.estado;
    return estado === FINALIZADO;
}

/* ============================================================
   generarResumenAsistencia
   ============================================================ */
export function generarResumenAsistencia(eventoId) {
    const id = parseInt(eventoId);
    const inscripcionesDB = _leerRegistros(INSCRIPCION_KEY);
    const listaInscripciones = Array.isArray(inscripcionesDB)
        ? inscripcionesDB
        : Object.values(inscripcionesDB);

    const inscritosDelEvento = listaInscripciones.filter(insc => {
        const evId = insc.evento_id || insc.eventId || insc.event_id;
        return parseInt(evId) === id;
    });
    const uuidsInscritos = inscritosDelEvento.map(i => i.user_id || i.userId);
    const asistencias    = obtenerAsistencias(id);
    const presentes      = asistencias.filter(uuid => uuidsInscritos.includes(uuid)).length;
    const totalInscritos = uuidsInscritos.length;
    const ausentes       = totalInscritos - presentes;
    const porcentaje     = totalInscritos > 0 ? Math.round((presentes / totalInscritos) * 100) : 0;

    return { totalInscritos, presentes, ausentes, porcentaje };
}

/* ============================================================
   obtenerInscritosEvento — para dashboard-organizador
   Devuelve lista de inscritos enriquecida con estado de asistencia
   ============================================================ */
export async function obtenerInscritosEvento(eventoId) {
    const id = parseInt(eventoId);

    try {
        // Intentar traer inscritos de Supabase con join a usuarios
        const url = new URL(`${DB_VARS.URL}/rest/v1/inscripciones`);
        url.searchParams.set('select',   `*,usuarios(id,nombres,apellidos,codigo_estudiante,carrera),asistencias(asistio,marcado_en)`);
        url.searchParams.set('event_id', `eq.${id}`);

        const resp = await fetch(url.toString(), {
            headers: {
                'apikey':        DB_VARS.KEY,
                'Authorization': `Bearer ${DB_VARS.KEY}`,
            }
        });
        if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
        const datos = await resp.json();

        return datos.map(ins => {
            const usuario     = ins.usuarios ?? {};
            const asistencia  = Array.isArray(ins.asistencias) ? ins.asistencias[0] : (ins.asistencias ?? {});
            return {
                id:               ins.id,
                userId:           ins.user_id,
                eventId:          ins.event_id,
                fechaInscripcion: ins.fecha_inscripcion,
                nombres:          usuario.nombres             || '—',
                apellidos:        usuario.apellidos           || '—',
                codigoEstudiante: usuario.codigo_estudiante   || '—',
                carrera:          usuario.carrera             || '—',
                asistio:          asistencia.asistio          ?? false,
                marcadoEn:        asistencia.marcado_en       ?? null,
            };
        });
    } catch (e) {
        console.warn('[attendance.js] Usando localStorage para inscritos:', e.message);
    }

    // Fallback: combinar inscripciones locales + asistencias locales
    const inscripciones = (() => {
        try {
            const raw = localStorage.getItem(INSCRIPCION_KEY);
            const data = raw ? JSON.parse(raw) : [];
            return Array.isArray(data) ? data : Object.values(data);
        } catch { return []; }
    })();

    const asistencias = _leerRegistros(ASISTENCIA_KEY);

    return inscripciones
        .filter(ins => parseInt(ins.event_id || ins.eventId) === id)
        .map(ins => {
            const uid  = ins.user_id || ins.userId;
            const key  = _clave(id, uid);
            const asis = asistencias[key];
            return {
                id:               ins.id,
                userId:           uid,
                eventId:          id,
                fechaInscripcion: ins.fecha_inscripcion || ins.inscribedAt,
                nombres:          ins.nombres   || 'Alumno',
                apellidos:        ins.apellidos || '',
                codigoEstudiante: ins.codigo_estudiante || '—',
                carrera:          ins.carrera   || '—',
                asistio:          asis?.asistio ?? false,
                marcadoEn:        asis?.marcado_en ?? null,
            };
        });
}

/* ============================================================
   obtenerHistorialAsistencia — para dashboard-alumno
   Devuelve eventos finalizados con su estado de asistencia
   ============================================================ */
export async function obtenerHistorialAsistencia(userId) {
    try {
        // Intentar traer de Supabase: inscripciones del alumno + evento + asistencia
        const url = new URL(`${DB_VARS.URL}/rest/v1/inscripciones`);
        url.searchParams.set('select',  `*,eventos(id,titulo,categoria,fecha_inicio,hora_inicio,hora_fin,estado),asistencias(asistio,marcado_en)`);
        url.searchParams.set('user_id', `eq.${userId}`);

        const resp = await fetch(url.toString(), {
            headers: {
                'apikey':        DB_VARS.KEY,
                'Authorization': `Bearer ${DB_VARS.KEY}`,
            }
        });
        if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
        const datos = await resp.json();

        return datos
            .filter(ins => {
                const ev = ins.eventos ?? {};
                return ev.estado === FINALIZADO;
            })
            .map(ins => {
                const ev   = ins.eventos ?? {};
                const asis = Array.isArray(ins.asistencias) ? ins.asistencias[0] : (ins.asistencias ?? {});
                return {
                    eventId:    ins.event_id,
                    title:      ev.titulo        || '—',
                    category:   ev.categoria     || '—',
                    startDate:  ev.fecha_inicio  || '',
                    startTime:  ev.hora_inicio   || '',
                    endTime:    ev.hora_fin       || '',
                    estado:     ev.estado        || FINALIZADO,
                    asistio:    asis.asistio     ?? false,
                    marcadoEn:  asis.marcado_en  ?? null,
                };
            });
    } catch (e) {
        console.warn('[attendance.js] Usando localStorage para historial:', e.message);
    }

    // Fallback localStorage
    const inscripciones = (() => {
        try {
            const raw  = localStorage.getItem(INSCRIPCION_KEY);
            const data = raw ? JSON.parse(raw) : [];
            return Array.isArray(data) ? data : Object.values(data);
        } catch { return []; }
    })();

    const eventos = (() => {
        try { return JSON.parse(localStorage.getItem('fisi_eventos') || '[]'); } catch { return []; }
    })();

    const asistencias = _leerRegistros(ASISTENCIA_KEY);

    return inscripciones
        .filter(ins => (ins.user_id || ins.userId) === userId)
        .map(ins => {
            const evId = parseInt(ins.event_id || ins.eventId);
            const ev   = eventos.find(e => e.id === evId) || {};
            const uid  = ins.user_id || ins.userId;
            const key  = _clave(evId, uid);
            const asis = asistencias[key];
            return {
                eventId:   evId,
                title:     ev.titulo       || '—',
                category:  ev.categoria    || '—',
                startDate: ev.fecha_inicio || '',
                startTime: ev.hora_inicio  || '',
                endTime:   ev.hora_fin     || '',
                estado:    ev.estado       || FINALIZADO,
                asistio:   asis?.asistio   ?? false,
                marcadoEn: asis?.marcado_en ?? null,
            };
        })
        .filter(item => item.estado === FINALIZADO);
}
