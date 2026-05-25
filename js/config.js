/**
 * CONFIGURACIÓN GLOBAL E INICIALIZACIÓN DE LA BASE DE DATOS
 * Proyecto: fisi-eventos
 */

// ==========================================
// 1. CREDENCIALES DE LA BASE DE DATOS EXTERNA
// ==========================================
export const DB_CONFIG = Object.freeze({
    URL: "https://nvzvnrwibfgywxchgjxc.supabase.co",
    ANON_KEY: "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im52enZucndpYmZneXd4Y2hnanhjIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Nzk2ODEzNDYsImV4cCI6MjA5NTI1NzM0Nn0.VRgZQGI_ruqmkjAHCxRXt1sGui42q0oSe7yVudEONlA"
});

// ==========================================
// 2. DICCIONARIO DE ROLES DE USUARIO
// ==========================================
export const ROLES = Object.freeze({
    ALUMNO: "alumno",
    ORGANIZADOR: "organizador"
});

// ==========================================
// 3. SUBTIPOS DE CUENTA PARA ORGANIZADORES
// ==========================================
export const TIPO_ORGANIZADOR = Object.freeze({
    PERSONA: "persona", // Docente, administrativo, alumno libre
    GRUPO: "grupo"       // Círculos de investigación, laboratorios, agrupaciones
});

// ==========================================
// 4. MÁQUINA DE ESTADOS DEL CICLO DE VIDA DEL EVENTO
// ==========================================
export const STATUS_EVENTO = Object.freeze({
    PROGRAMADO: "programado", // Visible en cartelera, inscripciones abiertas
    EN_CURSO: "en_curso",     // Evento realizándose en vivo, asistencia habilitada
    FINALIZADO: "finalizado"  // Evento cerrado, datos congelados para reportes
});

// ==========================================
// 5. CATEGORÍAS DE EVENTOS ESCALABLES
// ==========================================
export const CATEGORIAS = Object.freeze({
    CHARLA: "charla",
    TALLER: "taller",
    SEMINARIO: "seminario",
    CONGRESO: "congreso"
});

// ==========================================
// 6. LLAVES DE ALMACENAMIENTO DEL NAVEGADOR (Storage Keys)
// ==========================================
// Define los nombres exactos para guardar tokens y preferencias sin pisarse el código.
export const STORAGE_KEYS = Object.freeze({
    SESION_TOKEN: "fisi_eventos_token",       // Guarda el token/ID de autenticación
    USER_DATA: "fisi_eventos_user_data",       // Guarda el objeto del usuario actual
    USER_ROLE: "fisi_eventos_user_role",       // Almacena el rol activo ('alumno' o 'organizador')
    OMITIR_AVISO_CRUCE: "omitir_alerta_choque" // Preferencia local: true/false ("No volver a mostrar")
});

// ==========================================
// 7. DATOS MAESTROS DE LA UNMSM (Desplegables Dinámicos)
// ==========================================
// Estructura oficial para los selects del formulario de registro de login.html.
export const MAESTROS_UNMSM = Object.freeze({       // Completar luego con datos de la SAN MARCOS
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

// ==========================================
// 8. CONSTANTES DE ASISTENCIA REVERSIBLE
// ==========================================
// Define el valor booleano exacto que se guardará en la tabla 'asistencias'.
export const CONTROL_ASISTENCIA = Object.freeze({
    PRESENTE: true,   // El estudiante asistió a la actividad en vivo
    AUSENTE: false    // El estudiante faltó o el organizador no marcó check-in
});

// ==========================================
// 9. LÍMITES TÉCNICOS Y REGLAS DE VALIDACIÓN
// ==========================================
// Parámetros de frontera para inputs y lógica de negocio.
export const LIMITES_VALIDACION = Object.freeze({
    CODIGO_ALUMNO: { MIN: 8, MAX: 10 },       // Longitud del código de San Marcos
    EVENTOS: { MIN_CAPACIDAD: 1 },            // Capacidad mínima permitida (numérico positivo)
    FORMATOS_EXPORTACION: ["csv"]             // Formatos soportados por export-helpers.js
});

/** COMO INTEGRAR EN OTRO CÓDIGO
// Ejemplo de uso en js/modules/events.js (Integrante 4)
import { STATUS_EVENTO } from "../config.js";

function iniciarEvento(evento) {
    // En lugar de escribir "en_curso" a mano, usan tu contrato seguro:
    evento.estado = STATUS_EVENTO.EN_CURSO; 
    console.log(`El evento ahora está: ${evento.estado}`);
}
*/
