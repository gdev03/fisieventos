/**
 * CONFIGURACIÓN GLOBAL E INICIALIZACIÓN DE LA BASE DE DATOS
 * Proyecto: fisi-eventos
 */

// 1. Credenciales de la Base de Datos Externa (Reemplaza con tus datos reales)
export const DB_CONFIG = Object.freeze({
    URL: "https://nvzvnrwibfgywxchgjxc.supabase.co", // O la URL de Firebase
    ANON_KEY: "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im52enZucndpYmZneXd4Y2hnanhjIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Nzk2ODEzNDYsImV4cCI6MjA5NTI1NzM0Nn0.VRgZQGI_ruqmkjAHCxRXt1sGui42q0oSe7yVudEONlA"
});

// 2. Diccionario de Roles de Usuario
export const ROLES = Object.freeze({
    ALUMNO: "alumno",
    ORGANIZADOR: "organizador"
});

// 3. Subtipos de cuenta para Organizadores
export const TIPO_ORGANIZADOR = Object.freeze({
    PERSONA: "persona", // Docente, administrativo o alumno libre
    GRUPO: "grupo"       // Círculos de investigación, laboratorios o agrupaciones
});

// 4. Máquina de Estados del Ciclo de Vida del Evento
export const STATUS_EVENTO = Object.freeze({
    PROGRAMADO: "programado", // Visible en cartelera, inscripciones abiertas
    EN_CURSO: "en_curso",     // Evento realizándose en vivo, asistencia habilitada
    FINALIZADO: "finalizado"  // Evento cerrado, datos congelados para reportes
});

// 5. Categorías de Eventos Escalables
export const CATEGORIAS = Object.freeze({
    CHARLA: "charla",
    TALLER: "taller",
    SEMINARIO: "seminario",
    CONGRESO: "congreso"
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
