/**
 * @file auth.js
 * @description Módulo de autenticación por Username de FISI Events.
 */

import { CONFIG_SISTEMA, STORAGE_KEYS, DB_VARS } from '../config.js';
import { mostrarAlertaFlotante } from '../utils/alerts.js';

const TABLA_USUARIOS     = 'usuarios';
const AUTH_SIGNUP_URL    = `${DB_VARS.URL}/auth/v1/signup`;
const AUTH_SIGNIN_URL    = `${DB_VARS.URL}/auth/v1/token?grant_type=password`;
const TABLA_USUARIOS_URL = `${DB_VARS.URL}/rest/v1/${TABLA_USUARIOS}`;

function _headersAuth() {
    return new Headers({ 'Content-Type': 'application/json', 'apikey': DB_VARS.KEY });
}

function _headersREST(accessToken) {
    return new Headers({
        'Content-Type': 'application/json',
        'apikey': DB_VARS.KEY,
        'Authorization': `Bearer ${accessToken}`,
        'Prefer': 'return=representation',
    });
}

function _persistirSesion(token, userData, role) {
    localStorage.setItem(STORAGE_KEYS.SESION_TOKEN, token);
    localStorage.setItem(STORAGE_KEYS.USER_DATA, JSON.stringify(userData));
    localStorage.setItem(STORAGE_KEYS.USER_ROLE, role);
}

export function cerrarSesion() {
    localStorage.removeItem(STORAGE_KEYS.SESION_TOKEN);
    localStorage.removeItem(STORAGE_KEYS.USER_DATA);
    localStorage.removeItem(STORAGE_KEYS.USER_ROLE);
}

export function getUsuarioLogueado() {
    try {
        const token    = localStorage.getItem(STORAGE_KEYS.SESION_TOKEN) ?? null;
        const rawData  = localStorage.getItem(STORAGE_KEYS.USER_DATA);
        const userData = rawData ? JSON.parse(rawData) : null;
        const role     = localStorage.getItem(STORAGE_KEYS.USER_ROLE) ?? null;
        return { token, userData, role };
    } catch {
        return { token: null, userData: null, role: null };
    }
}

// ── VALIDACIONES ──
function _validarUsername(username) {
    if (!username || username.trim().length < 4) {
        return { valido: false, mensaje: 'El usuario debe tener al menos 4 caracteres.' };
    }
    return { valido: true, mensaje: '' };
}

function _usernameAEmail(username) {
    // Engañamos a Supabase en el fondo creando un correo virtual válido
    return `${username.trim().toLowerCase()}@fisievents.unmsm.edu.pe`;
}

function _validarTextoAlfabetico(valor, nombreCampo) {
    const regex = /^[A-Za-záéíóúÁÉÍÓÚñÑüÜ\s'-]+$/;
    if (!valor || !regex.test(String(valor).trim())) {
        return { valido: false, mensaje: `El campo "${nombreCampo}" solo admite letras.` };
    }
    return { valido: true, mensaje: '' };
}

// ── CONSTRUCTOR DE PAYLOAD ──
function _construirPayloadUsuario(uuid, formData) {
    const rol = formData.role;
    const esGrupo = (rol === CONFIG_SISTEMA.ROLES.ORGANIZADOR && formData.organizerType === 'grupo');

    const base = {
        id: uuid,
        username: formData.username.trim(),
        rol: rol,
    };

    if (rol === CONFIG_SISTEMA.ROLES.ALUMNO) {
        return {
            ...base,
            nombres: String(formData.firstName).trim(),
            apellidos: String(formData.lastName).trim(),
            codigo_estudiante: String(formData.studentCode).trim(),
            facultad: String(formData.faculty).trim(),
            carrera: String(formData.career).trim(),
            tipo_organizador: null,
            nombre_grupo: null,
        };
    }

    if (rol === CONFIG_SISTEMA.ROLES.ORGANIZADOR) {
        return {
            ...base,
            codigo_estudiante: null,
            facultad: null,
            carrera: null,
            tipo_organizador: formData.organizerType,
            nombres: esGrupo ? null : String(formData.firstName).trim(),
            apellidos: esGrupo ? null : String(formData.lastName).trim(),
            nombre_grupo: esGrupo ? String(formData.groupName).trim() : null,
        };
    }
    throw new Error('Rol desconocido.');
}

// ── REGISTRO ──
export async function registrar(username, password, formData) {
    try {
        const validUser = _validarUsername(username);
        if (!validUser.valido) {
            mostrarAlertaFlotante(validUser.mensaje, 'error');
            return { exito: false };
        }
        if (!password || password.length < 8) {
            mostrarAlertaFlotante('Contraseña mínima 8 caracteres', 'error');
            return { exito: false };
        }

        const esGrupo = (formData.role === 'organizador' && formData.organizerType === 'grupo');

        // Solo exigir nombres si NO es un grupo
        if (!esGrupo) {
            const vNom = _validarTextoAlfabetico(formData.firstName, 'Nombres');
            if (!vNom.valido) { mostrarAlertaFlotante(vNom.mensaje, 'error'); return { exito: false }; }
            const vApe = _validarTextoAlfabetico(formData.lastName, 'Apellidos');
            if (!vApe.valido) { mostrarAlertaFlotante(vApe.mensaje, 'error'); return { exito: false }; }
        } else {
            if (!formData.groupName) { mostrarAlertaFlotante('Falta nombre del grupo', 'error'); return { exito: false }; }
        }

        const emailVirtual = _usernameAEmail(username);
        const authResponse = await fetch(AUTH_SIGNUP_URL, {
            method: 'POST',
            headers: _headersAuth(),
            body: JSON.stringify({ email: emailVirtual, password }),
        });

        const authData = await authResponse.json();
        if (!authResponse.ok) {
            mostrarAlertaFlotante(authData.message || 'Error en registro', 'error');
            return { exito: false };
        }

        const payloadSQL = _construirPayloadUsuario(authData.user.id, formData);
        const perfilResponse = await fetch(TABLA_USUARIOS_URL, {
            method: 'POST',
            headers: _headersREST(authData.access_token),
            body: JSON.stringify(payloadSQL),
        });

        if (!perfilResponse.ok) {
            mostrarAlertaFlotante('Error guardando perfil', 'error');
            return { exito: false };
        }
        
        const [perfilCreado] = await perfilResponse.json();
        _persistirSesion(authData.access_token, perfilCreado, formData.role);

        mostrarAlertaFlotante(`¡Registro exitoso! Bienvenido ${esGrupo ? formData.groupName : formData.firstName}.`, 'exito');
        return { exito: true, role: formData.role };
    } catch (err) {
        mostrarAlertaFlotante('Error de red al registrar.', 'error');
        return { exito: false };
    }
}

// ── INICIO DE SESIÓN ──
export async function iniciarSesion(username, password) {
    try {
        if (!username || !password) {
            mostrarAlertaFlotante('Campos incompletos', 'error');
            return { exito: false };
        }

        const emailVirtual = _usernameAEmail(username);
        const authResponse = await fetch(AUTH_SIGNIN_URL, {
            method: 'POST',
            headers: _headersAuth(),
            body: JSON.stringify({ email: emailVirtual, password })
        });
        
        const authData = await authResponse.json();
        if (!authResponse.ok) {
            mostrarAlertaFlotante('Usuario o contraseña incorrectos', 'error');
            return { exito: false };
        }

        const perfilURL = `${TABLA_USUARIOS_URL}?select=*&id=eq.${authData.user.id}&limit=1`;
        const perfilResponse = await fetch(perfilURL, { method: 'GET', headers: _headersREST(authData.access_token) });
        const perfiles = await perfilResponse.json();

        if (perfiles.length === 0) {
            mostrarAlertaFlotante('Perfil no encontrado', 'error');
            return { exito: false };
        }

        const perfil = perfiles[0];
        _persistirSesion(authData.access_token, perfil, perfil.rol);

        mostrarAlertaFlotante(`¡Bienvenido de vuelta, ${perfil.username}!`, 'exito');
        return { exito: true, role: perfil.rol };
    } catch (err) {
        mostrarAlertaFlotante('Error de conexión', 'error');
        return { exito: false };
    }
}

export function redirigirPorRol(rol) {
    if (rol === CONFIG_SISTEMA.ROLES.ALUMNO) window.location.href = 'dashboard-alumno.html';
    else if (rol === CONFIG_SISTEMA.ROLES.ORGANIZADOR) window.location.href = 'dashboard-organizador.html';
    else window.location.href = 'index.html';
}
