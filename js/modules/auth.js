/**
 * ============================================================
 * js/modules/auth.js
 * FISI Events — Módulo de Autenticación
 * ============================================================
 */

import { CONFIG_SISTEMA, STORAGE_KEYS, DB_VARS } from '../config.js';
import { mostrarAlertaFlotante } from '../utils/alerts.js';

/* ── Constantes ──────────────────────────────────────────── */
const TABLA_USUARIOS     = 'usuarios';
const AUTH_SIGNUP_URL    = `${DB_VARS.URL}/auth/v1/signup`;
const AUTH_SIGNIN_URL    = `${DB_VARS.URL}/auth/v1/token?grant_type=password`;
const TABLA_USUARIOS_URL = `${DB_VARS.URL}/rest/v1/${TABLA_USUARIOS}`;

/* ── Helpers de cabeceras ────────────────────────────────── */
function _headersAuth() {
    return new Headers({
        'Content-Type': 'application/json',
        'apikey':       DB_VARS.KEY,
    });
}

function _headersREST(accessToken) {
    return new Headers({
        'Content-Type':  'application/json',
        'apikey':        DB_VARS.KEY,
        'Authorization': `Bearer ${accessToken}`,
        'Prefer':        'return=representation',
    });
}

/* ── Conversión username → email virtual para Supabase ───── */
function _usernameAEmail(username) {
    return `${String(username).trim().toLowerCase()}@fisievents.unmsm.edu.pe`;
}

/* ── Persistencia de sesión ──────────────────────────────── */
function _persistirSesion(token, userData, role) {
    localStorage.setItem(STORAGE_KEYS.SESION_TOKEN, token);
    localStorage.setItem(STORAGE_KEYS.USER_DATA,    JSON.stringify(userData));
    localStorage.setItem(STORAGE_KEYS.USER_ROLE,    role);
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
        if (!token || !userData || !role) return null;
        // Normalizar campos del perfil
        return {
            ...userData,
            token,
            role,
            id:        userData.id,
            firstName: userData.nombres     || userData.firstName || '',
            lastName:  userData.apellidos   || userData.lastName  || '',
            organizerType: userData.tipo_organizador || userData.organizerType || null,
            groupName:     userData.nombre_grupo     || userData.groupName     || null,
        };
    } catch {
        return null;
    }
}

/* ── Validaciones ────────────────────────────────────────── */
function _validarUsername(username) {
    if (!username || String(username).trim().length < 4) {
        return { valido: false, mensaje: 'El usuario debe tener al menos 4 caracteres.' };
    }
    return { valido: true, mensaje: '' };
}

function _validarPassword(password) {
    if (!password || password.length < 8) {
        return { valido: false, mensaje: 'La contraseña debe tener al menos 8 caracteres.' };
    }
    return { valido: true, mensaje: '' };
}

function _validarTextoAlfabetico(valor, nombreCampo) {
    const regex = /^[A-Za-záéíóúÁÉÍÓÚñÑüÜ\s'-]+$/;
    if (!valor || !regex.test(String(valor).trim())) {
        return { valido: false, mensaje: `El campo "${nombreCampo}" solo admite letras y espacios.` };
    }
    return { valido: true, mensaje: '' };
}

function _validarCodigoEstudiante(codigo) {
    const regex = /^\d{8,10}$/;
    if (!codigo || !regex.test(String(codigo).trim())) {
        return { valido: false, mensaje: 'El código debe contener entre 8 y 10 dígitos numéricos.' };
    }
    return { valido: true, mensaje: '' };
}

/* ── Construcción del payload SQL ────────────────────────── */
function _construirPayloadUsuario(uuid, formData) {
    const rol = formData.role;
    const base = {
        id:       uuid,
        username: String(formData.username || '').trim(),
        nombres:  String(formData.firstName || '').trim(),
        apellidos:String(formData.lastName  || '').trim(),
        rol,
    };

    if (rol === CONFIG_SISTEMA.ROLES.ALUMNO) {
        return {
            ...base,
            codigo_estudiante: String(formData.studentCode || '').trim(),
            facultad:          String(formData.faculty     || '').trim(),
            carrera:           String(formData.career      || '').trim(),
            tipo_organizador:  null,
            nombre_grupo:      null,
        };
    }

    if (rol === CONFIG_SISTEMA.ROLES.ORGANIZADOR) {
        const tipo = formData.organizerType;
        return {
            ...base,
            codigo_estudiante: null,
            facultad:          null,
            carrera:           null,
            tipo_organizador:  tipo,
            nombre_grupo:      tipo === CONFIG_SISTEMA.TIPO_ORGANIZADOR.GRUPO
                ? String(formData.groupName || '').trim()
                : null,
        };
    }

    throw new Error(`Rol desconocido: "${rol}".`);
}

/* ============================================================
   REGISTRO
   ============================================================ */
export async function registrar(username, password, formData) {
    try {
        // 1. Validaciones de cliente
        const validUser = _validarUsername(username);
        if (!validUser.valido) {
            mostrarAlertaFlotante(validUser.mensaje, 'error');
            return { exito: false, mensaje: validUser.mensaje };
        }

        const validPass = _validarPassword(password);
        if (!validPass.valido) {
            mostrarAlertaFlotante(validPass.mensaje, 'error');
            return { exito: false, mensaje: validPass.mensaje };
        }

        const validNombres = _validarTextoAlfabetico(formData.firstName, 'Nombres');
        if (!validNombres.valido) {
            mostrarAlertaFlotante(validNombres.mensaje, 'error');
            return { exito: false, mensaje: validNombres.mensaje };
        }

        const validApellidos = _validarTextoAlfabetico(formData.lastName, 'Apellidos');
        if (!validApellidos.valido) {
            mostrarAlertaFlotante(validApellidos.mensaje, 'error');
            return { exito: false, mensaje: validApellidos.mensaje };
        }

        if (formData.role === CONFIG_SISTEMA.ROLES.ALUMNO) {
            const validCodigo = _validarCodigoEstudiante(formData.studentCode);
            if (!validCodigo.valido) {
                mostrarAlertaFlotante(validCodigo.mensaje, 'error');
                return { exito: false, mensaje: validCodigo.mensaje };
            }
            if (!formData.faculty) {
                const msg = 'Debes seleccionar tu Facultad.';
                mostrarAlertaFlotante(msg, 'error');
                return { exito: false, mensaje: msg };
            }
            if (!formData.career) {
                const msg = 'Debes seleccionar tu Carrera.';
                mostrarAlertaFlotante(msg, 'error');
                return { exito: false, mensaje: msg };
            }
        } else if (formData.role === CONFIG_SISTEMA.ROLES.ORGANIZADOR) {
            if (!formData.organizerType) {
                const msg = 'Debes seleccionar el tipo de organizador.';
                mostrarAlertaFlotante(msg, 'error');
                return { exito: false, mensaje: msg };
            }
            if (formData.organizerType === CONFIG_SISTEMA.TIPO_ORGANIZADOR.GRUPO &&
                !formData.groupName) {
                const msg = 'El nombre del grupo/círculo es obligatorio.';
                mostrarAlertaFlotante(msg, 'error');
                return { exito: false, mensaje: msg };
            }
        } else {
            const msg = 'Rol de usuario no reconocido.';
            mostrarAlertaFlotante(msg, 'error');
            return { exito: false, mensaje: msg };
        }

        // 2. Crear usuario en Supabase Auth
        const emailVirtual = _usernameAEmail(username);
        const authResponse = await fetch(AUTH_SIGNUP_URL, {
            method:  'POST',
            headers: _headersAuth(),
            body:    JSON.stringify({ email: emailVirtual, password }),
        });
        const authData = await authResponse.json();

        if (!authResponse.ok) {
            const msgAuth = authData.msg ?? authData.error_description ?? authData.message ?? 'Error al crear la cuenta.';
            mostrarAlertaFlotante(msgAuth, 'error');
            return { exito: false, mensaje: msgAuth };
        }

        const uuid        = authData.user?.id;
        const accessToken = authData.access_token;

        if (!uuid) {
            const msg = 'No se pudo obtener el identificador del usuario creado.';
            mostrarAlertaFlotante(msg, 'error');
            return { exito: false, mensaje: msg };
        }

        // 3. Insertar perfil en tabla `usuarios`
        const payloadSQL = _construirPayloadUsuario(uuid, { ...formData, username });
        const perfilResponse = await fetch(TABLA_USUARIOS_URL, {
            method:  'POST',
            headers: _headersREST(accessToken),
            body:    JSON.stringify(payloadSQL),
        });

        if (!perfilResponse.ok) {
            const errorBody = await perfilResponse.json().catch(() => ({}));
            const msgPerfil = errorBody.message ?? `Error HTTP ${perfilResponse.status} al guardar el perfil.`;
            mostrarAlertaFlotante(msgPerfil, 'error');
            return { exito: false, mensaje: msgPerfil };
        }

        const [perfilCreado] = await perfilResponse.json();

        // 4. Persistir sesión
        _persistirSesion(accessToken, perfilCreado, formData.role);
        mostrarAlertaFlotante(`¡Bienvenido/a, ${formData.firstName}! Tu cuenta ha sido creada.`, 'exito');
        return { exito: true, mensaje: 'Registro completado.', usuario: perfilCreado };

    } catch (err) {
        console.error('[auth] Error crítico en registro:', err);
        mostrarAlertaFlotante('Ocurrió un error de red. Verifica tu conexión.', 'error');
        return { exito: false, mensaje: err.message ?? 'Error desconocido.' };
    }
}

/* ============================================================
   INICIO DE SESIÓN
   ============================================================ */
export async function iniciarSesion(username, password) {
    try {
        if (!username || !password) {
            mostrarAlertaFlotante('Ingresa tu usuario y contraseña.', 'error');
            return { exito: false, mensaje: 'Campos vacíos.' };
        }

        // Convertir username a email virtual
        const emailVirtual = _usernameAEmail(username);

        // 1. Solicitar token a Supabase Auth
        const authResponse = await fetch(AUTH_SIGNIN_URL, {
            method:  'POST',
            headers: _headersAuth(),
            body:    JSON.stringify({ email: emailVirtual, password }),
        });
        const authData = await authResponse.json();

        if (!authResponse.ok) {
            const msgAuth = authData.error_description ?? authData.msg ?? authData.message ?? 'Credenciales incorrectas.';
            mostrarAlertaFlotante(msgAuth, 'error');
            return { exito: false, mensaje: msgAuth };
        }

        const accessToken = authData.access_token;
        const userId      = authData.user?.id;

        if (!accessToken || !userId) {
            const msg = 'Respuesta de autenticación incompleta.';
            mostrarAlertaFlotante(msg, 'error');
            return { exito: false, mensaje: msg };
        }

        // 2. Recuperar perfil de la tabla `usuarios`
        const perfilURL = new URL(TABLA_USUARIOS_URL);
        perfilURL.searchParams.set('select', '*');
        perfilURL.searchParams.set('id',     `eq.${userId}`);
        perfilURL.searchParams.set('limit',  '1');

        const perfilResponse = await fetch(perfilURL.toString(), {
            method:  'GET',
            headers: _headersREST(accessToken),
        });

        if (!perfilResponse.ok) {
            const errorBody = await perfilResponse.json().catch(() => ({}));
            const msgPerfil = errorBody.message ?? `Error HTTP ${perfilResponse.status} al recuperar perfil.`;
            mostrarAlertaFlotante(msgPerfil, 'error');
            return { exito: false, mensaje: msgPerfil };
        }

        const perfiles = await perfilResponse.json();
        if (!Array.isArray(perfiles) || perfiles.length === 0) {
            const msg = 'No se encontró un perfil de usuario para esta cuenta.';
            mostrarAlertaFlotante(msg, 'error');
            return { exito: false, mensaje: msg };
        }

        const perfil = perfiles[0];
        const rol    = perfil.rol;

        // 3. Persistir sesión
        _persistirSesion(accessToken, perfil, rol);
        mostrarAlertaFlotante(`¡Bienvenido/a de vuelta, ${perfil.nombres}!`, 'exito');
        return { exito: true, mensaje: 'Sesión iniciada.', usuario: perfil, role: rol };

    } catch (err) {
        console.error('[auth] Error crítico en inicio de sesión:', err);
        mostrarAlertaFlotante('Error de red. Verifica tu conexión a internet.', 'error');
        return { exito: false, mensaje: err.message ?? 'Error desconocido.' };
    }
}

/* ============================================================
   REDIRECCIÓN POR ROL
   ============================================================ */
export function redirigirPorRol(rol) {
    if (rol === CONFIG_SISTEMA.ROLES.ALUMNO) {
        window.location.href = 'dashboard-alumno.html';
    } else if (rol === CONFIG_SISTEMA.ROLES.ORGANIZADOR) {
        window.location.href = 'dashboard-organizador.html';
    } else {
        window.location.href = 'index.html';
    }
}
