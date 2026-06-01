/**
 * @file auth.js
 * @description Módulo de autenticación de FISI Events.
 *   Gestiona el registro y login de usuarios contra Supabase Auth + tabla `usuarios`,
 *   aplicando la Matriz de Mapeo Bidireccional JS <-> SQL y las restricciones DDL.
 * @module modules/auth
 */

import { CONFIG_SISTEMA, STORAGE_KEYS, DB_VARS } from '../config.js';
import { mostrarAlertaFlotante } from '../utils/alerts.js';

/* ─────────────────────────────────────────────────────────────────────────── *
 * SECCIÓN 1 – CONSTANTES INTERNAS                                             *
 * ─────────────────────────────────────────────────────────────────────────── */

const TABLA_USUARIOS    = 'usuarios';
const AUTH_SIGNUP_URL   = `${DB_VARS.URL}/auth/v1/signup`;
const AUTH_SIGNIN_URL   = `${DB_VARS.URL}/auth/v1/token?grant_type=password`;
const TABLA_USUARIOS_URL = `${DB_VARS.URL}/rest/v1/${TABLA_USUARIOS}`;

/* ─────────────────────────────────────────────────────────────────────────── *
 * SECCIÓN 2 – HELPERS INTERNOS                                                *
 * ─────────────────────────────────────────────────────────────────────────── */

/**
 * Cabeceras para el endpoint de Auth de Supabase (no requiere Bearer token de usuario).
 * @returns {Headers}
 */
function _headersAuth() {
  return new Headers({
    'Content-Type': 'application/json',
    'apikey':        DB_VARS.KEY,
  });
}

/**
 * Cabeceras para los endpoints REST con el token del usuario autenticado.
 * @param {string} accessToken - JWT del usuario.
 * @returns {Headers}
 */
function _headersREST(accessToken) {
  return new Headers({
    'Content-Type': 'application/json',
    'apikey':        DB_VARS.KEY,
    'Authorization': `Bearer ${accessToken}`,
    'Prefer':        'return=representation',
  });
}

/**
 * Persiste las credenciales en LocalStorage con las claves definidas en STORAGE_KEYS.
 *
 * @param {string} token    - JWT de acceso emitido por Supabase Auth.
 * @param {Object} userData - Perfil completo del usuario.
 * @param {string} role     - Rol del usuario ('alumno' | 'organizador').
 */
function _persistirSesion(token, userData, role) {
  localStorage.setItem(STORAGE_KEYS.SESION_TOKEN, token);
  localStorage.setItem(STORAGE_KEYS.USER_DATA,    JSON.stringify(userData));
  localStorage.setItem(STORAGE_KEYS.USER_ROLE,    role);
}

/**
 * Elimina por completo todas las claves de sesión del LocalStorage.
 */
export function cerrarSesion() {
  localStorage.removeItem(STORAGE_KEYS.SESION_TOKEN);
  localStorage.removeItem(STORAGE_KEYS.USER_DATA);
  localStorage.removeItem(STORAGE_KEYS.USER_ROLE);
}

/**
 * Recupera el objeto del usuario autenticado desde LocalStorage.
 * @returns {{ token: string|null, userData: Object|null, role: string|null }}
 */
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

/* ─────────────────────────────────────────────────────────────────────────── *
 * SECCIÓN 3 – VALIDACIONES DE CLIENTE                                         *
 * ─────────────────────────────────────────────────────────────────────────── */

/**
 * Valida el código de estudiante UNMSM.
 * Debe ser exclusivamente numérico con longitud entre 8 y 10 caracteres.
 *
 * @param {string} codigo
 * @returns {{ valido: boolean, mensaje: string }}
 */
function _validarCodigoEstudiante(codigo) {
  const regex = /^\d{8,10}$/;
  if (!codigo || !regex.test(String(codigo).trim())) {
    return {
      valido:  false,
      mensaje: 'El código de estudiante debe contener entre 8 y 10 dígitos numéricos.',
    };
  }
  return { valido: true, mensaje: '' };
}

/**
 * Valida que un campo de texto solo contenga caracteres alfabéticos y espacios.
 *
 * @param {string} valor
 * @param {string} nombreCampo
 * @returns {{ valido: boolean, mensaje: string }}
 */
function _validarTextoAlfabetico(valor, nombreCampo) {
  const regex = /^[A-Za-záéíóúÁÉÍÓÚñÑüÜ\s'-]+$/;
  if (!valor || !regex.test(String(valor).trim())) {
    return {
      valido:  false,
      mensaje: `El campo "${nombreCampo}" solo admite letras y espacios.`,
    };
  }
  return { valido: true, mensaje: '' };
}

/**
 * Valida que el email tenga un formato mínimamente válido.
 * @param {string} email
 * @returns {{ valido: boolean, mensaje: string }}
 */
function _validarEmail(email) {
  const regex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!email || !regex.test(email.trim())) {
    return { valido: false, mensaje: 'El correo electrónico no es válido.' };
  }
  return { valido: true, mensaje: '' };
}

/**
 * Valida que la contraseña cumpla longitud mínima de 8 caracteres.
 * @param {string} password
 * @returns {{ valido: boolean, mensaje: string }}
 */
function _validarPassword(password) {
  if (!password || password.length < 8) {
    return { valido: false, mensaje: 'La contraseña debe tener al menos 8 caracteres.' };
  }
  return { valido: true, mensaje: '' };
}

/* ─────────────────────────────────────────────────────────────────────────── *
 * SECCIÓN 4 – CONSTRUCCIÓN DEL PAYLOAD USUARIO (MAPEO JS → SQL)               *
 * ─────────────────────────────────────────────────────────────────────────── */

/**
 * Construye el objeto que se insertará en la tabla `usuarios` según el DDL.
 * Aplica la Matriz de Mapeo Bidireccional con nulidad condicional estricta.
 *
 * @param {string} uuid           - UUID generado por Supabase Auth.
 * @param {Object} formData       - Datos del formulario del cliente.
 * @param {string} formData.firstName
 * @param {string} formData.lastName
 * @param {string} formData.role              - 'alumno' | 'organizador'
 * @param {string} [formData.studentCode]     - Solo si rol es 'alumno'
 * @param {string} [formData.faculty]         - Solo si rol es 'alumno'
 * @param {string} [formData.career]          - Solo si rol es 'alumno'
 * @param {string} [formData.organizerType]   - 'persona' | 'grupo'; solo si es 'organizador'
 * @param {string} [formData.groupName]       - Solo si organizerType === 'grupo'
 * @returns {Object} Payload SQL-compatible para la tabla `usuarios`.
 */
function _construirPayloadUsuario(uuid, formData) {
  const rol = formData.role;

  const base = {
    id:       uuid,
    nombres:  String(formData.firstName).trim(),
    apellidos: String(formData.lastName).trim(),
    rol:      rol,
  };

  if (rol === CONFIG_SISTEMA.ROLES.ALUMNO) {
    // Campos de alumno: obligatorios
    // Campos de organizador: deben ser NULL para cumplir el CHECK constraint
    return {
      ...base,
      codigo_estudiante: String(formData.studentCode).trim(),
      facultad:          String(formData.faculty).trim(),
      carrera:           String(formData.career).trim(),
      tipo_organizador:  null,
      nombre_grupo:      null,
    };
  }

  if (rol === CONFIG_SISTEMA.ROLES.ORGANIZADOR) {
    const tipo = formData.organizerType; // 'persona' | 'grupo'

    // Campos de alumno deben ser NULL para cumplir el CHECK constraint
    const payloadOrganizador = {
      ...base,
      codigo_estudiante: null,
      facultad:          null,
      carrera:           null,
      tipo_organizador:  tipo,
    };

    if (tipo === CONFIG_SISTEMA.TIPO_ORGANIZADOR.GRUPO) {
      // El nombre de grupo es obligatorio si el tipo es 'grupo'
      payloadOrganizador.nombre_grupo = String(formData.groupName).trim();
    } else {
      // Si tipo es 'persona', nombre_grupo DEBE ser NULL (CHECK constraint de la BDD)
      payloadOrganizador.nombre_grupo = null;
    }

    return payloadOrganizador;
  }

  throw new Error(`Rol desconocido: "${rol}". Solo se aceptan 'alumno' u 'organizador'.`);
}

/* ─────────────────────────────────────────────────────────────────────────── *
 * SECCIÓN 5 – REGISTRO DE USUARIO                                             *
 * ─────────────────────────────────────────────────────────────────────────── */

/**
 * Registra un nuevo usuario en Supabase Auth y persiste su perfil en la
 * tabla `usuarios` con los campos condicionales según su rol.
 *
 * @param {string} email    - Correo electrónico del usuario.
 * @param {string} password - Contraseña del usuario.
 * @param {Object} formData - Datos del formulario (ver _construirPayloadUsuario).
 * @returns {Promise<{exito: boolean, mensaje: string, usuario?: Object}>}
 */
export async function registrar(email, password, formData) {
  try {
    /* ── 1. Validaciones de cliente ─────────────────────────────────────── */
    const validEmail = _validarEmail(email);
    if (!validEmail.valido) {
      mostrarAlertaFlotante(validEmail.mensaje, 'error');
      return { exito: false, mensaje: validEmail.mensaje };
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

    // Validaciones condicionales por rol
    if (formData.role === CONFIG_SISTEMA.ROLES.ALUMNO) {
      const validCodigo = _validarCodigoEstudiante(formData.studentCode);
      if (!validCodigo.valido) {
        mostrarAlertaFlotante(validCodigo.mensaje, 'error');
        return { exito: false, mensaje: validCodigo.mensaje };
      }
      if (!formData.faculty || String(formData.faculty).trim() === '') {
        const msg = 'Debes seleccionar tu Facultad.';
        mostrarAlertaFlotante(msg, 'error');
        return { exito: false, mensaje: msg };
      }
      if (!formData.career || String(formData.career).trim() === '') {
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
      if (
        formData.organizerType === CONFIG_SISTEMA.TIPO_ORGANIZADOR.GRUPO &&
        (!formData.groupName || String(formData.groupName).trim() === '')
      ) {
        const msg = 'El nombre del grupo/círculo de estudios es obligatorio.';
        mostrarAlertaFlotante(msg, 'error');
        return { exito: false, mensaje: msg };
      }
    } else {
      const msg = 'Rol de usuario no reconocido.';
      mostrarAlertaFlotante(msg, 'error');
      return { exito: false, mensaje: msg };
    }

    /* ── 2. Crear usuario en Supabase Auth ─────────────────────────────── */
    const authResponse = await fetch(AUTH_SIGNUP_URL, {
      method:  'POST',
      headers: _headersAuth(),
      body:    JSON.stringify({ email: email.trim(), password }),
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

    /* ── 3. Construir y enviar el perfil a la tabla `usuarios` ─────────── */
    const payloadSQL = _construirPayloadUsuario(uuid, formData);

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

    /* ── 4. Persistir sesión en LocalStorage ───────────────────────────── */
    _persistirSesion(accessToken, perfilCreado, formData.role);

    mostrarAlertaFlotante(`¡Bienvenido/a, ${formData.firstName}! Tu cuenta ha sido creada.`, 'exito');
    return { exito: true, mensaje: 'Registro completado.', usuario: perfilCreado };
  } catch (err) {
    console.error('[auth] Error crítico en registro:', err);
    mostrarAlertaFlotante('Ocurrió un error de red. Verifica tu conexión.', 'error');
    return { exito: false, mensaje: err.message ?? 'Error desconocido.' };
  }
}

/* ─────────────────────────────────────────────────────────────────────────── *
 * SECCIÓN 6 – INICIO DE SESIÓN                                                *
 * ─────────────────────────────────────────────────────────────────────────── */

/**
 * Autentica a un usuario existente y recupera su perfil de la tabla `usuarios`.
 *
 * @param {string} email    - Correo electrónico.
 * @param {string} password - Contraseña.
 * @returns {Promise<{exito: boolean, mensaje: string, usuario?: Object, role?: string}>}
 */
export async function iniciarSesion(email, password) {
  try {
    /* ── 1. Validaciones de entrada ─────────────────────────────────────── */
    const validEmail = _validarEmail(email);
    if (!validEmail.valido) {
      mostrarAlertaFlotante(validEmail.mensaje, 'error');
      return { exito: false, mensaje: validEmail.mensaje };
    }

    if (!password || password.length === 0) {
      const msg = 'La contraseña no puede estar vacía.';
      mostrarAlertaFlotante(msg, 'error');
      return { exito: false, mensaje: msg };
    }

    /* ── 2. Solicitar token a Supabase Auth ─────────────────────────────── */
    const authResponse = await fetch(AUTH_SIGNIN_URL, {
      method:  'POST',
      headers: _headersAuth(),
      body:    JSON.stringify({ email: email.trim(), password }),
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

    /* ── 3. Recuperar el perfil completo de la tabla `usuarios` ─────────── */
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
      const msg = 'No se encontró un perfil de usuario registrado para esta cuenta.';
      mostrarAlertaFlotante(msg, 'error');
      return { exito: false, mensaje: msg };
    }

    const perfil = perfiles[0];
    const rol    = perfil.rol; // 'alumno' | 'organizador'

    /* ── 4. Persistir sesión en LocalStorage ───────────────────────────── */
    _persistirSesion(accessToken, perfil, rol);

    mostrarAlertaFlotante(`¡Bienvenido/a de vuelta, ${perfil.nombres}!`, 'exito');
    return { exito: true, mensaje: 'Sesión iniciada.', usuario: perfil, role: rol };
  } catch (err) {
    console.error('[auth] Error crítico en inicio de sesión:', err);
    mostrarAlertaFlotante('Error de red. Verifica tu conexión a internet.', 'error');
    return { exito: false, mensaje: err.message ?? 'Error desconocido.' };
  }
}

/* ─────────────────────────────────────────────────────────────────────────── *
 * SECCIÓN 7 – REDIRECCIÓN POR ROL                                             *
 * ─────────────────────────────────────────────────────────────────────────── */

/**
 * Redirige al usuario al dashboard correspondiente según su rol,
 * o a `index.html` si el rol no es reconocido.
 *
 * @param {string} rol - 'alumno' | 'organizador'
 */
export function redirigirPorRol(rol) {
  if (rol === CONFIG_SISTEMA.ROLES.ALUMNO) {
    window.location.href = 'dashboard-alumno.html';
  } else if (rol === CONFIG_SISTEMA.ROLES.ORGANIZADOR) {
    window.location.href = 'dashboard-organizador.html';
  } else {
    window.location.href = 'index.html';
  }
}
