/**
 * ============================================================
 * js/modules/events.js
 * FISI Events — Módulo de Gestión de Eventos
 * Integrante 4: Panel de Organización
 * ============================================================
 */

import { CONFIG_SISTEMA } from '../config.js';

/* ── Extracción correcta desde el sub-objeto STATUS_EVENTO ── */
const { PROGRAMADO, EN_CURSO, FINALIZADO } = CONFIG_SISTEMA.STATUS_EVENTO;

/* ── Clave de almacenamiento local (modo demo) ─────────────── */
const STORAGE_KEY = 'fisi_eventos';

/* ── Helper: Generador de ID incremental local ──────────────── */
function generarIdLocal() {
  const eventos = _leerEventosLocal();
  const maxId = eventos.reduce((max, ev) => Math.max(max, ev.id || 0), 0);
  return maxId + 1;
}

/* ── Helpers de almacenamiento local ────────────────────────── */
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

/* ── Capa de Mapeo Relacional Bidireccional (JS <-> SQL) ── */
function _mapearSQLaJS(filaSQL) {
  if (!filaSQL) return null;
  return {
    id: filaSQL.id,
    title: filaSQL.titulo,
    category: filaSQL.categoria,
    startDate: filaSQL.fecha_inicio,
    startTime: filaSQL.hora_inicio,
    endTime: filaSQL.hora_fin,
    deadline: filaSQL.limite_inscripcion,
    maxCapacity: filaSQL.capacidad_max,
    createdBy: filaSQL.creado_por,
    status: filaSQL.estado,
    createdAt: filaSQL.creado_en
  };
}

/* ============================================================
   crearEventoDB
   ============================================================ */
export async function crearEventoDB(datosEvento) {
  // ── Validación de Regla 3: Capacidad entera positiva ──
  if (datosEvento.maxCapacity !== null && datosEvento.maxCapacity !== undefined && datosEvento.maxCapacity !== '') {
    const capacidad = Number(datosEvento.maxCapacity);
    if (!Number.isInteger(capacidad) || capacidad <= 0) {
      throw new Error('La capacidad máxima debe ser un número entero positivo. (Regla 3)');
    }
  }

  // ── Validación obligatoria de rango de horas (endTime > startTime) ──
  if (datosEvento.startTime && datosEvento.endTime) {
    if (datosEvento.endTime <= datosEvento.startTime) {
      throw new Error('La hora de finalización (endTime) debe ser posterior a la hora de inicio (startTime).');
    }
  }

  // ── Validación: Deadline anterior a la fecha de inicio ──
  if (datosEvento.deadline && datosEvento.startDate) {
    const dl = new Date(datosEvento.deadline);
    const fi = new Date(datosEvento.startDate);
    if (dl >= fi) {
      throw new Error('El límite de inscripción debe ser estrictamente anterior a la fecha de inicio del evento.');
    }
  }

  // Transformación del payload al formato estricto de columnas SQL (snake_case)
  const payloadSQL = {
    titulo: datosEvento.title,
    categoria: datosEvento.category,
    fecha_inicio: datosEvento.startDate,
    hora_inicio: datosEvento.startTime,
    hora_fin: datosEvento.endTime || null,
    limite_inscripcion: datosEvento.deadline, // Requerido No Nulo según el DDL
    capacidad_max: datosEvento.maxCapacity ? parseInt(datosEvento.maxCapacity) : null,
    creado_por: datosEvento.createdBy,
    estado: PROGRAMADO // "programado" por defecto
  };

  // ── MODO PRODUCCIÓN: Uso de variables globales de BDD ──
  if (typeof window.DB_VARS !== 'undefined' && window.DB_VARS?.URL && window.DB_VARS?.KEY) {
    try {
      const response = await fetch(`${window.DB_VARS.URL}/rest/v1/eventos`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'apikey': window.DB_VARS.KEY,
          'Authorization': `Bearer ${window.DB_VARS.KEY}`,
          'Prefer': 'return=representation',
        },
        body: JSON.stringify(payloadSQL),
      });

      if (!response.ok) {
        const err = await response.json();
        throw new Error(err.message || 'Error al crear el evento en la base de datos.');
      }

      const [eventoCreado] = await response.json();
      return _mapearSQLaJS(eventoCreado);
    } catch (networkError) {
      console.warn('[events.js] BDD externa no disponible, cayendo a localStorage:', networkError.message);
    }
  }

  // ── MODO DEMO: Almacenamiento local estructurado ──
  const eventos = _leerEventosLocal();
  const nuevoEventoSQL = {
    ...payloadSQL,
    id: generarIdLocal(),
    creado_en: new Date().toISOString()
  };
  
  eventos.push(nuevoEventoSQL);
  _guardarEventosLocal(eventos);

  console.log('[events.js] Evento creado (demo relacional):', nuevoEventoSQL);
  return _mapearSQLaJS(nuevoEventoSQL);
}

/* ============================================================
   obtenerEventosOrganizador
   ============================================================ */
export async function obtenerEventosOrganizador(organizadorId) {
  if (typeof window.DB_VARS !== 'undefined' && window.DB_VARS?.URL && window.DB_VARS?.KEY) {
    try {
      const url = `${window.DB_VARS.URL}/rest/v1/eventos?creado_por=eq.${organizadorId}&order=id.desc`;
      const response = await fetch(url, {
        headers: {
          'apikey': window.DB_VARS.KEY,
          'Authorization': `Bearer ${window.DB_VARS.KEY}`,
        },
      });
      if (!response.ok) throw new Error('Error al obtener eventos de la BDD.');
      const datos = await response.json();
      return datos.map(_mapearSQLaJS);
    } catch (e) {
      console.warn('[events.js] Usando localStorage para listado:', e.message);
    }
  }

  const todos = _leerEventosLocal();
  const filtrados = todos.filter(ev => !organizadorId || ev.creado_por === organizadorId);
  return filtrados.map(_mapearSQLaJS);
}

/* ============================================================
   obtenerEventoPorId
   ============================================================ */
export async function obtenerEventoPorId(eventoId) {
  const id = parseInt(eventoId);

  if (typeof window.DB_VARS !== 'undefined' && window.DB_VARS?.URL && window.DB_VARS?.KEY) {
    try {
      const url = `${window.DB_VARS.URL}/rest/v1/eventos?id=eq.${id}`;
      const response = await fetch(url, {
        headers: { 'apikey': window.DB_VARS.KEY, 'Authorization': `Bearer ${window.DB_VARS.KEY}` },
      });
      const data = await response.json();
      return _mapearSQLaJS(data[0]) || null;
    } catch (e) {
      console.warn('[events.js] Usando localStorage para búsqueda individual:', e.message);
    }
  }

  const todos = _leerEventosLocal();
  const encontrado = todos.find(ev => ev.id === id);
  return _mapearSQLaJS(encontrado);
}

/* ============================================================
   cambiarEstadoEvento
   ============================================================ */
export async function cambiarEstadoEvento(eventoId, nuevoEstado) {
  const evento = await obtenerEventoPorId(eventoId);
  if (!evento) throw new Error(`Evento #${eventoId} no encontrado. (Regla 8)`);

  const transicionValida = {
    [PROGRAMADO]: [EN_CURSO],
    [EN_CURSO]:   [FINALIZADO],
    [FINALIZADO]: [],
  };

  if (!transicionValida[evento.status]?.includes(nuevoEstado)) {
    throw new Error(
      `Transición inválida: "${evento.status}" → "${nuevoEstado}". ` +
      (evento.status === FINALIZADO ? 'Los eventos finalizados son completamente inmutables. (Regla 9)' : '')
    );
  }

  // ── MODO PRODUCCIÓN ───────────────────────────────────────
  if (typeof window.DB_VARS !== 'undefined' && window.DB_VARS?.URL && window.DB_VARS?.KEY) {
    try {
      const response = await fetch(`${window.DB_VARS.URL}/rest/v1/eventos?id=eq.${eventoId}`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          'apikey': window.DB_VARS.KEY,
          'Authorization': `Bearer ${window.DB_VARS.KEY}`,
          'Prefer': 'return=representation',
        },
        body: JSON.stringify({ estado: nuevoEstado }),
      });
      if (!response.ok) throw new Error('Error al actualizar estado en la BDD externa.');
      const [actualizado] = await response.json();
      return _mapearSQLaJS(actualizado);
    } catch (e) {
      console.warn('[events.js] Cayendo a localStorage para actualización de estado:', e.message);
    }
  }

  // ── MODO DEMO ─────────────────────────────────────────────
  const eventos = _leerEventosLocal();
  const idx = eventos.findIndex(ev => ev.id === parseInt(eventoId));
  if (idx === -1) throw new Error('Evento no encontrado en almacenamiento local.');
  
  eventos[idx].estado = nuevoEstado;
  _guardarEventosLocal(eventos);

  console.log(`[events.js] Estado cambiado exitosamente (demo): #${eventoId} → "${nuevoEstado}"`);
  return _mapearSQLaJS(eventos[idx]);
}
