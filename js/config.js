/**
 * ============================================================
 * js/config.js
 * FISI Events — Configuración Global e Inicialización
 * ============================================================
 */

// ==========================================
// 1. CREDENCIALES DE LA BASE DE DATOS EXTERNA
// ==========================================
export const DB_CONFIG = Object.freeze({
    URL:      "https://nvzvnrwibfgywxchgjxc.supabase.co",
    ANON_KEY: "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im52enZucndpYmZneXd4Y2hnanhjIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Nzk2ODEzNDYsImV4cCI6MjA5NTI1NzM0Nn0.VRgZQGI_ruqmkjAHCxRXt1sGui42q0oSe7yVudEONlA"
});

// Variables de acceso rápido para los módulos (compatibilidad)
export const DB_VARS = Object.freeze({
    URL: DB_CONFIG.URL,
    KEY: DB_CONFIG.ANON_KEY
});

// Exponer en window para módulos de attendance/events que usan window.DB_VARS
if (typeof window !== 'undefined') {
    window.DB_VARS = { URL: DB_CONFIG.URL, KEY: DB_CONFIG.ANON_KEY };
}

// ==========================================
// 2. OBJETOS INDEPENDIENTES (compatibilidad)
// ==========================================
export const ROLES = Object.freeze({
    ALUMNO:       "alumno",
    ORGANIZADOR:  "organizador"
});

export const TIPO_ORGANIZADOR = Object.freeze({
    PERSONA: "persona",
    GRUPO:   "grupo"
});

export const STATUS_EVENTO = Object.freeze({
    PROGRAMADO: "programado",
    EN_CURSO:   "en_curso",
    FINALIZADO: "finalizado"
});

export const CATEGORIAS = Object.freeze({
    CHARLA:    "charla",
    TALLER:    "taller",
    SEMINARIO: "seminario",
    CONGRESO:  "congreso"
});

export const STORAGE_KEYS = Object.freeze({
    SESION_TOKEN:        "fisi_eventos_token",
    USER_DATA:           "fisi_eventos_user_data",
    USER_ROLE:           "fisi_eventos_user_role",
    OMITIR_AVISO_CRUCE:  "omitir_alerta_choque",
    INSCRIPCIONES_LOCAL: "fisi_inscripciones"
});

export const MAESTROS_UNMSM = Object.freeze({
    FACULTADES: [
        { id: "fisi", nombre: "Facultad de Ingeniería de Sistemas e Informática" }
    ],
    CARRERAS: {
        fisi: [
            "Ingeniería de Sistemas",
            "Ingeniería de Software",
            "Ciencia de la Computación"
        ]
    }
});

export const CONTROL_ASISTENCIA = Object.freeze({
    PRESENTE: true,
    AUSENTE:  false
});

export const LIMITES_VALIDACION = Object.freeze({
    CODIGO_ALUMNO:       { MIN: 8, MAX: 10 },
    EVENTOS:             { MIN_CAPACIDAD: 1 },
    FORMATOS_EXPORTACION: ["csv"]
});

// ==========================================
// 3. CONFIG_SISTEMA — Objeto unificado que todos los módulos importan
//    Contiene referencias a todos los sub-objetos anteriores.
// ==========================================
export const CONFIG_SISTEMA = Object.freeze({
    DB:                  DB_CONFIG,
    ROLES,
    TIPO_ORGANIZADOR,
    STATUS_EVENTO,
    CATEGORIAS,
    STORAGE_KEYS,
    MAESTROS_UNMSM,
    CONTROL_ASISTENCIA,
    LIMITES_VALIDACION
});
