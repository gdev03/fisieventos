/**
 * ============================================================
 * js/modules/attendance.js
 * FISI Events — Módulo de Control de Asistencia
 * Panel de Organización
 * ============================================================
 */

import { CONFIG_SISTEMA } from '../config.js';
import { obtenerEventoPorId } from './events.js';

/* ── Extracción correcta desde el sub-objeto STATUS_EVENTO ── */
const { EN_CURSO, FINALIZADO } = CONFIG_SISTEMA.STATUS_EVENTO;

/* ── Claves de almacenamiento local (relacional) ───────────── */
const ASISTENCIA_KEY = 'fisi_asistencias';
const INSCRIPCION_KEY = 'fisi_inscripciones'; // Requerido para cruzar datos

/* ── Formato de clave compuesta para indexación rápida ─────── */
const _clave = (eventoId, authUserId) => `${eventoId}::${authUserId}`;

/* ── Helpers localStorage ───────────────────────────────────── */
function _leerRegistros(claveAlmacenamiento) {
  try {
    return JSON.parse(localStorage.getItem(claveAlmacenamiento) || '{}');
  } catch {
    return {};
  }
}

function _guardarRegistros(claveAlmacenamiento, registros) {
  localStorage.setItem(claveAlmacenamiento, JSON.stringify(registros));
}

/* ============================================================
   marcarAsistencia
   ------------------------------------------------------------
   Registra o revierte la asistencia de un participante usando 
   su UUID nativo de Supabase Auth.
   Cumple con la Regla 9: Solo opera si el evento está EN_CURSO.
   ============================================================ */
export async function marcarAsistencia(eventoId, authUserId, asistio) {
  const id = parseInt(eventoId);

  // ── Validación Estricta de la Regla 9 ──────────────
  const evento = await obtenerEventoPorId(id);
  if (!evento) throw new Error('Evento no encontrado.');

  if (evento.status === FINALIZADO) {
    throw new Error(`El evento #${id} está FINALIZADO. La lista de asistencia es inmutable. (Regla 9)`);
  }

  if (evento.status !== EN_CURSO) {
    throw new Error(`El evento #${id} no está EN_CURSO. Solo se puede registrar asistencia durante el desarrollo del evento.`);
  }

  // ── MODO PRODUCCIÓN: Conexión con Supabase/Firebase ───────
  if (typeof window.DB_VARS !== 'undefined' && window.DB_VARS?.URL && window.DB_VARS?.KEY) {
    try {
      /* ── MATRIZ DE SINCRONIZACIÓN AL DDL FÍSICO (asistencias) ── */
      const payloadSQL = {
        user_id: authUserId, // <-- UUID real del Auth de Supabase
        event_id: id,        // <-- ID entero del evento
        asistio: asistio,
        marcado_en: asistio ? new Date().toISOString() : null,
      };

      const response = await fetch(`${window.DB_VARS.URL}/rest/v1/asistencias`, {
        method: 'POST', 
        headers: {
          'Content-Type': 'application/json',
          'apikey': window.DB_VARS.KEY,
          'Authorization': `Bearer ${window.DB_VARS.KEY}`,
          'Prefer': 'return=representation,resolution=merge-duplicates', // Upsert relacional nativo
        },
        body: JSON.stringify(payloadSQL),
      });

      if (!response.ok) throw new Error('Error al registrar asistencia en la BDD externa.');
      const [registro] = await response.json();
      
      /* ── RETORNO EN CAMELCASE PARA EL FRONTEND ── */
      return {
        eventId: registro.event_id,
        userId: registro.user_id, // Se retorna el UUID para consistencia
        attended: registro.asistio,
        markedAt: registro.marcado_en
      };
    } catch (networkErr) {
      console.warn('[attendance.js] BDD externa inaccesible, cayendo a localStorage:', networkErr.message);
    }
  }

  // ── MODO DEMO: localStorage relacional consistente ────────────
  const registros = _leerRegistros(ASISTENCIA_KEY);
  const key = _clave(id, authUserId);

  if (asistio) {
    registros[key] = {
      evento_id: id,
      user_id: authUserId, // Se guarda como UUID
      asistio: true,
      marcado_en: new Date().toISOString(),
    };
  } else {
    delete registros[key];
  }

  _guardarRegistros(ASISTENCIA_KEY, registros);
  
  return registros[key] ? {
    eventId: registros[key].evento_id,
    userId: registros[key].user_id,
    attended: registros[key].asistio,
    markedAt: registros[key].marcado_en
  } : { attended: false };
}

/* ============================================================
   obtenerAsistencias
   ============================================================ */
export function obtenerAsistencias(eventoId) {
  const id = parseInt(eventoId);
  const registros = _leerRegistros(ASISTENCIA_KEY);

  return Object.values(registros)
    .filter(r => parseInt(r.evento_id) === id && r.asistio === true)
    .map(r => r.user_id); // Retornamos el array de UUIDs
}

/* ============================================================
   estaCongelado
   ============================================================ */
export async function estaCongelado(eventoId) {
  const evento = await obtenerEventoPorId(eventoId);
  return evento?.status === FINALIZADO;
}

/* ============================================================
   generarResumenAsistencia
   ------------------------------------------------------------
   Cruza de manera relacional: Inscripciones vs Asistencias
   usando los UUIDs como puente de verdad.
   ============================================================ */
export function generarResumenAsistencia(eventoId) {
  const id = parseInt(eventoId);
  
  // 1. Leer inscripciones relacionales de la persistencia
  const inscripcionesDB = _leerRegistros(INSCRIPCION_KEY);
  
  const listaInscripciones = Array.isArray(inscripcionesDB) 
    ? inscripcionesDB 
    : Object.values(inscripcionesDB);

  // Filtrar usuarios inscritos en el evento
  const inscritosDelEvento = listaInscripciones.filter(insc => {
    const evId = insc.evento_id || insc.eventId;
    return parseInt(evId) === id;
  });

  // Mapear UUIDs únicos (tolerante a nomenclatura backend o frontend)
  const uuidsInscritos = inscritosDelEvento.map(i => i.user_id || i.userId);
  
  // 2. Leer las asistencias registradas (que ahora devuelven UUIDs)
  const asistencias = obtenerAsistencias(id);
  
  // 3. Cruzar datos (Evita contar alumnos colados no inscritos)
  const presentes = asistencias.filter(uuid => uuidsInscritos.includes(uuid)).length;
  const totalInscritos = uuidsInscritos.length;
  const ausentes = totalInscritos - presentes;
  const porcentaje = totalInscritos > 0 ? Math.round((presentes / totalInscritos) * 100) : 0;

  return {
    totalInscritos,
    presentes,
    ausentes,
    porcentaje,
  };
}
