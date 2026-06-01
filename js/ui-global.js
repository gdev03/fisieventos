/**
 * @file ui-global.js
 * @description Middleware auto-ejecutable de FISI Events.
 *   Lee la sesión activa desde LocalStorage en cada carga de página y muta
 *   dinámicamente el componente de navegación: reemplaza el botón "Iniciar Sesión"
 *   por un dropdown interactivo con el nombre del usuario y las opciones de perfil.
 *   Gestiona el cierre de sesión completo con limpieza de almacenamiento y redirección.
 * @module ui-global
 */

import { STORAGE_KEYS, CONFIG_SISTEMA } from './config.js';

/* ─────────────────────────────────────────────────────────────────────────── *
 * SECCIÓN 1 – AUTO-EJECUCIÓN EN CARGA DE PÁGINA                              *
 * ─────────────────────────────────────────────────────────────────────────── */

(function inicializarNavbar() {
  /**
   * La función se enlaza a DOMContentLoaded para garantizar que el DOM
   * esté completamente disponible antes de manipular el Navbar.
   */
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', _procesarNavbar);
  } else {
    // El DOM ya está listo (script cargado con defer o al final del body)
    _procesarNavbar();
  }
})();

/* ─────────────────────────────────────────────────────────────────────────── *
 * SECCIÓN 2 – PROCESAMIENTO DEL NAVBAR                                        *
 * ─────────────────────────────────────────────────────────────────────────── */

/**
 * Punto de entrada principal. Lee la sesión y decide si reescribir el Navbar.
 */
function _procesarNavbar() {
  const sesion = _leerSesion();

  if (!sesion.activa) {
    // No hay sesión: el Navbar permanece con el botón "Iniciar Sesión" estándar.
    _resaltarEnlaceActivo();
    return;
  }

  const contenedorNav = document.getElementById('nav-links');
  if (!contenedorNav) {
    // El Navbar puede no existir en algunas páginas (ej. login.html en pantalla completa).
    return;
  }

  _inyectarDropdownUsuario(contenedorNav, sesion);
  _resaltarEnlaceActivo();
  _protegerPaginasPrivadas(sesion.rol);
}

/* ─────────────────────────────────────────────────────────────────────────── *
 * SECCIÓN 3 – LECTURA DE SESIÓN DESDE LOCALSTORAGE                           *
 * ─────────────────────────────────────────────────────────────────────────── */

/**
 * @typedef {Object} SesionData
 * @property {boolean} activa      - Si hay una sesión válida.
 * @property {string|null} token   - JWT de acceso.
 * @property {Object|null} usuario - Perfil del usuario.
 * @property {string|null} rol     - Rol del usuario ('alumno' | 'organizador').
 */

/**
 * Lee y valida la sesión almacenada en LocalStorage.
 * @returns {SesionData}
 */
function _leerSesion() {
  try {
    const token   = localStorage.getItem(STORAGE_KEYS.SESION_TOKEN);
    const rawData = localStorage.getItem(STORAGE_KEYS.USER_DATA);
    const rol     = localStorage.getItem(STORAGE_KEYS.USER_ROLE);

    if (!token || !rawData || !rol) {
      return { activa: false, token: null, usuario: null, rol: null };
    }

    const usuario = JSON.parse(rawData);

    // Verificar que el rol tenga un valor válido reconocido
    const rolesValidos = Object.values(CONFIG_SISTEMA.ROLES);
    if (!rolesValidos.includes(rol)) {
      _limpiarSesion();
      return { activa: false, token: null, usuario: null, rol: null };
    }

    return { activa: true, token, usuario, rol };
  } catch {
    // Si el JSON está corrupto, limpiar y tratar como sin sesión
    _limpiarSesion();
    return { activa: false, token: null, usuario: null, rol: null };
  }
}

/* ─────────────────────────────────────────────────────────────────────────── *
 * SECCIÓN 4 – INYECCIÓN DEL DROPDOWN DE USUARIO                              *
 * ─────────────────────────────────────────────────────────────────────────── */

/**
 * Reescribe el contenedor del Navbar reemplazando el botón de login
 * por un componente dropdown interactivo con el nombre del usuario.
 *
 * @param {HTMLElement} contenedorNav - Elemento #nav-links del DOM.
 * @param {SesionData} sesion         - Datos de la sesión activa.
 */
function _inyectarDropdownUsuario(contenedorNav, sesion) {
  const { usuario, rol } = sesion;

  // Extraer el primer nombre del campo 'nombres' (puede ser "María José")
  const primerNombre = String(usuario.nombres ?? '').split(' ')[0] || 'Usuario';

  // Determinar la URL del dashboard según el rol
  const urlDashboard = rol === CONFIG_SISTEMA.ROLES.ALUMNO
    ? 'dashboard-alumno.html'
    : 'dashboard-organizador.html';

  // Etiqueta de rol para el dropdown
  const etiquetaRol = rol === CONFIG_SISTEMA.ROLES.ALUMNO
    ? '🎓 Alumno'
    : '⚙️ Organizador';

  // Buscar y eliminar el botón "Iniciar Sesión" si existe
  const btnLogin = contenedorNav.querySelector('a[href="login.html"], .btn-login, #btn-iniciar-sesion');
  if (btnLogin) {
    btnLogin.remove();
  }

  // Construir el componente dropdown
  const wrapper = document.createElement('div');
  wrapper.className = 'nav-usuario-wrapper';
  wrapper.setAttribute('data-testid', 'nav-usuario');

  // Botón disparador del dropdown
  const trigger = document.createElement('button');
  trigger.className = 'nav-usuario-trigger';
  trigger.setAttribute('aria-haspopup', 'true');
  trigger.setAttribute('aria-expanded', 'false');
  trigger.setAttribute('aria-controls', 'nav-dropdown-menu');
  trigger.innerHTML = `
    <span class="nav-usuario-avatar" aria-hidden="true">
      ${primerNombre.charAt(0).toUpperCase()}
    </span>
    <span class="nav-usuario-nombre">${_escaparHTML(primerNombre)}</span>
    <span class="nav-usuario-chevron" aria-hidden="true">▾</span>
  `;

  // Menú desplegable
  const menu = document.createElement('ul');
  menu.className  = 'nav-dropdown-menu';
  menu.id         = 'nav-dropdown-menu';
  menu.setAttribute('role', 'menu');
  menu.hidden = true;

  // Elemento de encabezado con rol
  const itemRol = document.createElement('li');
  itemRol.className = 'nav-dropdown-header';
  itemRol.setAttribute('role', 'presentation');
  itemRol.innerHTML = `<span>${_escaparHTML(etiquetaRol)}</span>`;

  // Enlace al Dashboard
  const itemDashboard = _crearItemMenu(
    'nav-dropdown-item',
    '📊 Mi Panel',
    urlDashboard,
    'menuitem',
  );

  // Enlace al catálogo público
  const itemCatalogo = _crearItemMenu(
    'nav-dropdown-item',
    '📅 Ver Eventos',
    'index.html',
    'menuitem',
  );

  // Separador
  const separador = document.createElement('li');
  separador.className = 'nav-dropdown-separator';
  separador.setAttribute('role', 'separator');

  // Botón de cerrar sesión
  const itemLogout = document.createElement('li');
  itemLogout.setAttribute('role', 'none');
  const btnLogout = document.createElement('button');
  btnLogout.className = 'nav-dropdown-item nav-dropdown-logout';
  btnLogout.setAttribute('role', 'menuitem');
  btnLogout.textContent = '🚪 Cerrar Sesión';
  btnLogout.addEventListener('click', _manejarCierreSesion);
  itemLogout.appendChild(btnLogout);

  menu.appendChild(itemRol);
  menu.appendChild(itemDashboard);
  menu.appendChild(itemCatalogo);
  menu.appendChild(separador);
  menu.appendChild(itemLogout);

  wrapper.appendChild(trigger);
  wrapper.appendChild(menu);

  // Adjuntar al contenedor del Navbar
  contenedorNav.appendChild(wrapper);

  // Inyectar estilos del dropdown (una sola vez)
  _inyectarEstilosDropdown();

  // Registrar los eventos de interacción
  _registrarEventosDropdown(trigger, menu);
}

/**
 * Crea un elemento `<li>` de menú con un enlace `<a>` interno.
 *
 * @param {string} className  - Clase CSS del elemento.
 * @param {string} texto      - Texto visible del enlace.
 * @param {string} href       - URL de destino.
 * @param {string} role       - Valor del atributo ARIA role.
 * @returns {HTMLLIElement}
 */
function _crearItemMenu(className, texto, href, role) {
  const item = document.createElement('li');
  item.setAttribute('role', 'none');

  const enlace = document.createElement('a');
  enlace.className = className;
  enlace.href      = href;
  enlace.setAttribute('role', role);
  enlace.textContent = texto;

  item.appendChild(enlace);
  return item;
}

/* ─────────────────────────────────────────────────────────────────────────── *
 * SECCIÓN 5 – EVENTOS DEL DROPDOWN                                            *
 * ─────────────────────────────────────────────────────────────────────────── */

/**
 * Registra la lógica de apertura/cierre del dropdown y cierre al hacer clic fuera.
 *
 * @param {HTMLButtonElement} trigger - Botón disparador.
 * @param {HTMLUListElement}  menu    - Menú desplegable.
 */
function _registrarEventosDropdown(trigger, menu) {
  trigger.addEventListener('click', (e) => {
    e.stopPropagation();
    const abierto = !menu.hidden;

    if (abierto) {
      _cerrarDropdown(trigger, menu);
    } else {
      _abrirDropdown(trigger, menu);
    }
  });

  // Cerrar al hacer clic fuera del dropdown
  document.addEventListener('click', (e) => {
    if (!trigger.contains(e.target) && !menu.contains(e.target)) {
      _cerrarDropdown(trigger, menu);
    }
  });

  // Cerrar con la tecla Escape
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && !menu.hidden) {
      _cerrarDropdown(trigger, menu);
      trigger.focus();
    }
  });
}

/**
 * Abre el menú dropdown actualizando atributos ARIA.
 */
function _abrirDropdown(trigger, menu) {
  menu.hidden = false;
  trigger.setAttribute('aria-expanded', 'true');
  trigger.classList.add('nav-usuario-trigger--abierto');
}

/**
 * Cierra el menú dropdown actualizando atributos ARIA.
 */
function _cerrarDropdown(trigger, menu) {
  menu.hidden = true;
  trigger.setAttribute('aria-expanded', 'false');
  trigger.classList.remove('nav-usuario-trigger--abierto');
}

/* ─────────────────────────────────────────────────────────────────────────── *
 * SECCIÓN 6 – CIERRE DE SESIÓN                                                *
 * ─────────────────────────────────────────────────────────────────────────── */

/**
 * Maneja el evento de cierre de sesión:
 *  1. Limpia TODAS las claves de LocalStorage relacionadas con la sesión.
 *  2. Redirige forzosamente a `index.html`.
 */
function _manejarCierreSesion() {
  _limpiarSesion();
  window.location.href = 'index.html';
}

/**
 * Elimina todas las claves de sesión del LocalStorage.
 */
function _limpiarSesion() {
  localStorage.removeItem(STORAGE_KEYS.SESION_TOKEN);
  localStorage.removeItem(STORAGE_KEYS.USER_DATA);
  localStorage.removeItem(STORAGE_KEYS.USER_ROLE);
}

/* ─────────────────────────────────────────────────────────────────────────── *
 * SECCIÓN 7 – PROTECCIÓN DE RUTAS PRIVADAS                                   *
 * ─────────────────────────────────────────────────────────────────────────── */

/**
 * Redirige a `index.html` si el usuario sin sesión intenta acceder a
 * páginas protegidas, o si el rol no coincide con la página solicitada.
 *
 * @param {string|null} rol - Rol del usuario autenticado.
 */
function _protegerPaginasPrivadas(rol) {
  const paginaActual = window.location.pathname.split('/').pop();

  const paginasAlumno       = ['dashboard-alumno.html'];
  const paginasOrganizador  = ['dashboard-organizador.html'];
  const paginasPrivadas     = [...paginasAlumno, ...paginasOrganizador];

  if (!paginasPrivadas.includes(paginaActual)) return;

  if (!rol) {
    // No autenticado: redirigir al login
    window.location.href = 'login.html';
    return;
  }

  if (paginasAlumno.includes(paginaActual) && rol !== CONFIG_SISTEMA.ROLES.ALUMNO) {
    // Un organizador intenta acceder al panel de alumno
    window.location.href = 'dashboard-organizador.html';
    return;
  }

  if (paginasOrganizador.includes(paginaActual) && rol !== CONFIG_SISTEMA.ROLES.ORGANIZADOR) {
    // Un alumno intenta acceder al panel de organizador
    window.location.href = 'dashboard-alumno.html';
  }
}

/* ─────────────────────────────────────────────────────────────────────────── *
 * SECCIÓN 8 – RESALTADO DE ENLACE ACTIVO                                     *
 * ─────────────────────────────────────────────────────────────────────────── */

/**
 * Agrega la clase `nav-link--activo` al enlace del Navbar que corresponde
 * a la página actual, para indicar la sección visitada.
 */
function _resaltarEnlaceActivo() {
  const paginaActual = window.location.pathname.split('/').pop() || 'index.html';
  const enlaces      = document.querySelectorAll('#nav-links a');

  enlaces.forEach((enlace) => {
    const href = enlace.getAttribute('href') ?? '';
    if (href === paginaActual || (paginaActual === '' && href === 'index.html')) {
      enlace.classList.add('nav-link--activo');
      enlace.setAttribute('aria-current', 'page');
    }
  });
}

/* ─────────────────────────────────────────────────────────────────────────── *
 * SECCIÓN 9 – ESTILOS DEL DROPDOWN (INYECTADOS DINÁMICAMENTE)                *
 * ─────────────────────────────────────────────────────────────────────────── */

/**
 * Inyecta los estilos CSS del dropdown de usuario en el <head>.
 * Solo se inyecta una vez por carga de página.
 */
function _inyectarEstilosDropdown() {
  if (document.getElementById('fisi-ui-global-style')) return;

  const style = document.createElement('style');
  style.id    = 'fisi-ui-global-style';
  style.textContent = `
    /* ── Wrapper del usuario en el navbar ── */
    .nav-usuario-wrapper {
      position: relative;
      display: inline-block;
    }

    /* ── Botón trigger ── */
    .nav-usuario-trigger {
      display: flex;
      align-items: center;
      gap: 0.45rem;
      background: none;
      border: none;
      cursor: pointer;
      padding: 0.4rem 0.6rem;
      border-radius: 6px;
      font-family: var(--fuente-fisi, 'Inter', sans-serif);
      font-size: 0.9rem;
      font-weight: 600;
      color: var(--blanco-fondo, #FAFAFA);
      transition: background 0.18s ease;
    }
    .nav-usuario-trigger:hover,
    .nav-usuario-trigger--abierto {
      background: rgba(255,255,255,0.12);
    }

    /* ── Avatar circular con inicial ── */
    .nav-usuario-avatar {
      display: inline-flex;
      align-items: center;
      justify-content: center;
      width: 30px;
      height: 30px;
      border-radius: 50%;
      background: var(--rojo-sanmarcos, #7F0000);
      border: 2px solid rgba(255,255,255,0.4);
      font-size: 0.78rem;
      font-weight: 700;
      color: #fff;
      text-transform: uppercase;
      flex-shrink: 0;
    }

    /* ── Chevron ── */
    .nav-usuario-chevron {
      font-size: 0.75rem;
      opacity: 0.75;
      transition: transform 0.2s ease;
    }
    .nav-usuario-trigger--abierto .nav-usuario-chevron {
      transform: rotate(180deg);
    }

    /* ── Menú desplegable ── */
    .nav-dropdown-menu {
      position: absolute;
      top: calc(100% + 8px);
      right: 0;
      background: #fff;
      border: 1px solid #e5e7eb;
      border-radius: 10px;
      box-shadow: 0 8px 28px rgba(0,0,0,0.14);
      min-width: 200px;
      list-style: none;
      margin: 0;
      padding: 0.4rem 0;
      z-index: 8000;
      animation: dropdown-aparecer 0.18s ease;
    }
    @keyframes dropdown-aparecer {
      from { opacity: 0; transform: translateY(-6px); }
      to   { opacity: 1; transform: translateY(0); }
    }

    /* ── Encabezado del menú ── */
    .nav-dropdown-header {
      padding: 0.5rem 1rem 0.4rem;
      font-size: 0.73rem;
      font-weight: 600;
      color: #9ca3af;
      text-transform: uppercase;
      letter-spacing: 0.05em;
      border-bottom: 1px solid #f3f4f6;
      margin-bottom: 0.3rem;
    }

    /* ── Ítems del menú ── */
    .nav-dropdown-item {
      display: flex;
      align-items: center;
      width: 100%;
      padding: 0.55rem 1rem;
      font-family: var(--fuente-fisi, 'Inter', sans-serif);
      font-size: 0.86rem;
      font-weight: 500;
      color: #374151;
      text-decoration: none;
      background: none;
      border: none;
      cursor: pointer;
      transition: background 0.15s ease, color 0.15s ease;
      text-align: left;
    }
    .nav-dropdown-item:hover {
      background: #f9fafb;
      color: var(--rojo-sanmarcos, #7F0000);
    }

    /* ── Separador ── */
    .nav-dropdown-separator {
      border-top: 1px solid #f3f4f6;
      margin: 0.3rem 0;
    }

    /* ── Botón de logout ── */
    .nav-dropdown-logout {
      color: var(--rojo-alerta, #DC3545) !important;
      font-weight: 600 !important;
    }
    .nav-dropdown-logout:hover {
      background: #fff5f5 !important;
    }

    /* ── Enlace activo del navbar ── */
    .nav-link--activo {
      color: var(--rojo-sanmarcos, #7F0000) !important;
      font-weight: 700;
    }
  `;
  document.head.appendChild(style);
}

/* ─────────────────────────────────────────────────────────────────────────── *
 * SECCIÓN 10 – UTILIDADES EXPORTADAS                                          *
 * ─────────────────────────────────────────────────────────────────────────── */

/**
 * Escapa caracteres HTML para prevenir XSS al inyectar datos en innerHTML.
 * @param {string} texto
 * @returns {string}
 */
function _escaparHTML(texto) {
  const div = document.createElement('div');
  div.textContent = String(texto);
  return div.innerHTML;
}

/**
 * Expone la función de lectura de sesión para que los dashboards puedan
 * consumirla sin necesidad de importar desde auth.js directamente.
 *
 * @returns {SesionData}
 */
export function obtenerSesionActiva() {
  return _leerSesion();
}
