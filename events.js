/**
 * ============================================================
 * js/modules/events.js
 * FISI Events — Módulo de Gestión de Eventos
 * ============================================================
 */

import { CONFIG_SISTEMA, DB_VARS } from '../config.js';

const { PROGRAMADO, EN_CURSO, FINALIZADO } = CONFIG_SISTEMA.STATUS_EVENTO;

const STORAGE_KEY = 'fisi_eventos';

/* ── Helper: Generador de ID incremental local ────────────── */
function generarIdLocal() {
    const eventos = _leerEventosLocal();
    const maxId = eventos.reduce((max, ev) => Math.max(max, ev.id || 0), 0);
    return maxId + 1;
}

/* ── Helpers de almacenamiento local ─────────────────────── */
function _leerEventosLocal() {
    try {
        return JSON.parse(localStorage.getItem(STORAGE_KEY) || '[]');
    } catch {
        return [];
    }
}

function _guardarEventosLocal(eventos) {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(eventos));
}

/* ── Capa de Mapeo Relacional Bidireccional (SQL → JS) ────── */
function _mapearSQLaJS(filaSQL) {
    if (!filaSQL) return null;
    return {
        id:          filaSQL.id,
        eventId:     filaSQL.id,              // alias para compatibilidad frontend
        title:       filaSQL.titulo,
        category:    filaSQL.categoria,
        startDate:   filaSQL.fecha_inicio,
        startTime:   filaSQL.hora_inicio,
        endTime:     filaSQL.hora_fin,
        deadline:    filaSQL.limite_inscripcion,
        maxCapacity: filaSQL.capacidad_max,
        createdBy:   filaSQL.creado_por,
        status:      filaSQL.estado,
        estado:      filaSQL.estado,          // alias snake_case para módulos internos
        createdAt:   filaSQL.creado_en,
        // Campos en español para compatibilidad con calendar/catalog render
        titulo:      filaSQL.titulo,
        categoria:   filaSQL.categoria,
        fecha_inicio:       filaSQL.fecha_inicio,
        hora_inicio:        filaSQL.hora_inicio,
        hora_fin:           filaSQL.hora_fin,
        capacidad_max:      filaSQL.capacidad_max,
    };
}

/* ── Helper de cabeceras Supabase ─────────────────────────── */
function _headers(extra = {}) {
    return {
        'Content-Type':  'application/json',
        'apikey':        DB_VARS.KEY,
        'Authorization': `Bearer ${DB_VARS.KEY}`,
        'Prefer':        'return=representation',
        ...extra
    };
}

/* ============================================================
   obtenerTodosLosEventos — para el catálogo público
   ============================================================ */
export async function obtenerTodosLosEventos() {
    try {
        const url = `${DB_VARS.URL}/rest/v1/eventos?order=id.desc`;
        const resp = await fetch(url, { headers: _headers() });
        if (!resp.ok) throw new Error('Error de red');
        const datos = await resp.json();
        return datos.map(_mapearSQLaJS);
    } catch {
        return _leerEventosLocal().map(_mapearSQLaJS);
    }
}

/* ============================================================
   crearEventoDB
   ============================================================ */
export async function crearEventoDB(datosEvento) {
    // Validación de capacidad
    if (datosEvento.maxCapacity !== null &&
        datosEvento.maxCapacity !== undefined &&
        datosEvento.maxCapacity !== '') {
        const capacidad = Number(datosEvento.maxCapacity);
        if (!Number.isInteger(capacidad) || capacidad <= 0) {
            throw new Error('La capacidad máxima debe ser un número entero positivo.');
        }
    }
    // Validación de horas
    if (datosEvento.startTime && datosEvento.endTime) {
        if (datosEvento.endTime <= datosEvento.startTime) {
            throw new Error('La hora de finalización debe ser posterior a la hora de inicio.');
        }
    }
    // Validación de deadline
    if (datosEvento.deadline && datosEvento.startDate) {
        const dl = new Date(datosEvento.deadline);
        const fi = new Date(datosEvento.startDate);
        if (dl >= fi) {
            throw new Error('El límite de inscripción debe ser anterior a la fecha de inicio del evento.');
        }
    }

    const payloadSQL = {
        titulo:             datosEvento.title,
        categoria:          datosEvento.category,
        fecha_inicio:       datosEvento.startDate,
        hora_inicio:        datosEvento.startTime,
        hora_fin:           datosEvento.endTime || null,
        limite_inscripcion: datosEvento.deadline,
        capacidad_max:      datosEvento.maxCapacity ? parseInt(datosEvento.maxCapacity) : null,
        creado_por:         datosEvento.createdBy,
        estado:             PROGRAMADO
    };

    try {
        const resp = await fetch(`${DB_VARS.URL}/rest/v1/eventos`, {
            method:  'POST',
            headers: _headers(),
            body:    JSON.stringify(payloadSQL),
        });
        if (!resp.ok) {
            const err = await resp.json().catch(() => ({}));
            throw new Error(err.message || 'Error al crear el evento en la base de datos.');
        }
        const [eventoCreado] = await resp.json();
        return _mapearSQLaJS(eventoCreado);
    } catch (networkError) {
        console.warn('[events.js] BDD externa no disponible, usando localStorage:', networkError.message);
    }

    // Modo demo
    const eventos = _leerEventosLocal();
    const nuevoEventoSQL = {
        ...payloadSQL,
        id:         generarIdLocal(),
        creado_en:  new Date().toISOString()
    };
    eventos.push(nuevoEventoSQL);
    _guardarEventosLocal(eventos);
    return _mapearSQLaJS(nuevoEventoSQL);
}

/* ============================================================
   obtenerEventosOrganizador / obtenerEventosPorOrganizador
   ============================================================ */
export async function obtenerEventosOrganizador(organizadorId) {
    try {
        const url = `${DB_VARS.URL}/rest/v1/eventos?creado_por=eq.${organizadorId}&order=id.desc`;
        const resp = await fetch(url, { headers: _headers() });
        if (!resp.ok) throw new Error('Error al obtener eventos.');
        const datos = await resp.json();
        return datos.map(_mapearSQLaJS);
    } catch (e) {
        console.warn('[events.js] Usando localStorage para listado:', e.message);
    }
    const todos = _leerEventosLocal();
    return todos
        .filter(ev => !organizadorId || ev.creado_por === organizadorId)
        .map(_mapearSQLaJS);
}

// Alias para compatibilidad con dashboard-organizador.html
export const obtenerEventosPorOrganizador = obtenerEventosOrganizador;

/* ============================================================
   obtenerEventoPorId
   ============================================================ */
export async function obtenerEventoPorId(eventoId) {
    const id = parseInt(eventoId);
    try {
        const url = `${DB_VARS.URL}/rest/v1/eventos?id=eq.${id}`;
        const resp = await fetch(url, { headers: _headers() });
        const data = await resp.json();
        return _mapearSQLaJS(data[0]) || null;
    } catch (e) {
        console.warn('[events.js] Usando localStorage para búsqueda individual:', e.message);
    }
    const todos = _leerEventosLocal();
    const encontrado = todos.find(ev => ev.id === id);
    return _mapearSQLaJS(encontrado);
}

/* ============================================================
   cambiarEstadoEvento / actualizarEstadoEvento
   ============================================================ */
export async function cambiarEstadoEvento(eventoId, nuevoEstado) {
    const evento = await obtenerEventoPorId(eventoId);
    if (!evento) throw new Error(`Evento #${eventoId} no encontrado.`);

    const transicionValida = {
        [PROGRAMADO]: [EN_CURSO],
        [EN_CURSO]:   [FINALIZADO],
        [FINALIZADO]: [],
    };

    const estadoActual = evento.status || evento.estado;
    if (!transicionValida[estadoActual]?.includes(nuevoEstado)) {
        throw new Error(
            `Transición inválida: "${estadoActual}" → "${nuevoEstado}". ` +
            (estadoActual === FINALIZADO ? 'Los eventos finalizados son inmutables.' : '')
        );
    }

    try {
        const resp = await fetch(`${DB_VARS.URL}/rest/v1/eventos?id=eq.${eventoId}`, {
            method:  'PATCH',
            headers: _headers(),
            body:    JSON.stringify({ estado: nuevoEstado }),
        });
        if (!resp.ok) throw new Error('Error al actualizar estado en la BDD.');
        const [actualizado] = await resp.json();
        return _mapearSQLaJS(actualizado);
    } catch (e) {
        console.warn('[events.js] Cayendo a localStorage para actualización de estado:', e.message);
    }

    const eventos = _leerEventosLocal();
    const idx = eventos.findIndex(ev => ev.id === parseInt(eventoId));
    if (idx === -1) throw new Error('Evento no encontrado en almacenamiento local.');
    eventos[idx].estado = nuevoEstado;
    _guardarEventosLocal(eventos);
    return _mapearSQLaJS(eventos[idx]);
}

// Alias para compatibilidad con dashboard-organizador.html
export const actualizarEstadoEvento = cambiarEstadoEvento;
