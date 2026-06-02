/**
 * ============================================================
 * js/ui-global.js
 * FISI Events — Middleware global del Navbar
 * ============================================================
 */

import { STORAGE_KEYS, CONFIG_SISTEMA } from './config.js';

/* Auto-ejecución en carga de página */
(function inicializarNavbar() {
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', _procesarNavbar);
    } else {
        _procesarNavbar();
    }
})();

function _procesarNavbar() {
    const sesion = _leerSesion();

    // Proteger páginas privadas primero (incluso sin sesión)
    _protegerPaginasPrivadas(sesion.activa ? sesion.rol : null);

    _resaltarEnlaceActivo();

    if (!sesion.activa) return;

    // Buscar el contenedor de auth en el navbar
    // Compatible con: #nav-links, #navbar-auth-container
    const contenedorAuth = document.getElementById('navbar-auth-container')
                        || document.getElementById('nav-links');
    if (!contenedorAuth) return;

    _inyectarDropdownUsuario(contenedorAuth, sesion);
}

/* ── Leer sesión ─────────────────────────────────────────── */
function _leerSesion() {
    try {
        const token   = localStorage.getItem(STORAGE_KEYS.SESION_TOKEN);
        const rawData = localStorage.getItem(STORAGE_KEYS.USER_DATA);
        const rol     = localStorage.getItem(STORAGE_KEYS.USER_ROLE);
        if (!token || !rawData || !rol) return { activa: false };
        const usuario = JSON.parse(rawData);
        const rolesValidos = Object.values(CONFIG_SISTEMA.ROLES);
        if (!rolesValidos.includes(rol)) { _limpiarSesion(); return { activa: false }; }
        return { activa: true, token, usuario, rol };
    } catch {
        _limpiarSesion();
        return { activa: false };
    }
}

/* ── Inyectar dropdown de usuario ────────────────────────── */
function _inyectarDropdownUsuario(contenedor, sesion) {
    const { usuario, rol } = sesion;
    const primerNombre = String(usuario.nombres ?? usuario.firstName ?? '').split(' ')[0] || 'Usuario';
    const urlDashboard = rol === CONFIG_SISTEMA.ROLES.ALUMNO
        ? 'dashboard-alumno.html'
        : 'dashboard-organizador.html';
    const etiquetaRol = rol === CONFIG_SISTEMA.ROLES.ALUMNO ? '🎓 Alumno' : '⚙️ Organizador';

    // Eliminar botón de iniciar sesión si existe
    const btnLogin = contenedor.querySelector('a[href="login.html"], .btn-login, .navbar__enlace--cta');
    if (btnLogin) btnLogin.remove();

    const wrapper = document.createElement('div');
    wrapper.className = 'nav-usuario-wrapper';

    const trigger = document.createElement('button');
    trigger.className = 'nav-usuario-trigger';
    trigger.setAttribute('aria-haspopup', 'true');
    trigger.setAttribute('aria-expanded', 'false');
    trigger.innerHTML = `
        <span class="nav-usuario-avatar" aria-hidden="true">
            ${primerNombre.charAt(0).toUpperCase()}
        </span>
        <span class="nav-usuario-nombre">${_escaparHTML(primerNombre)}</span>
        <span class="nav-usuario-chevron" aria-hidden="true">▾</span>
    `;

    const menu = document.createElement('ul');
    menu.className = 'nav-dropdown-menu';
    menu.setAttribute('role', 'menu');
    menu.hidden = true;

    const itemRol = document.createElement('li');
    itemRol.className = 'nav-dropdown-header';
    itemRol.innerHTML = `<span>${_escaparHTML(etiquetaRol)}</span>`;

    const itemDashboard = _crearItemMenu('nav-dropdown-item', '📊 Mi Panel', urlDashboard, 'menuitem');
    const itemCatalogo  = _crearItemMenu('nav-dropdown-item', '📅 Ver Eventos', 'index.html', 'menuitem');

    const separador = document.createElement('li');
    separador.className = 'nav-dropdown-separator';
    separador.setAttribute('role', 'separator');

    const itemLogout = document.createElement('li');
    const btnLogout  = document.createElement('button');
    btnLogout.className   = 'nav-dropdown-item nav-dropdown-logout';
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
    contenedor.appendChild(wrapper);

    _inyectarEstilosDropdown();
    _registrarEventosDropdown(trigger, menu);
}

function _crearItemMenu(className, texto, href, role) {
    const item   = document.createElement('li');
    item.setAttribute('role', 'none');
    const enlace = document.createElement('a');
    enlace.className   = className;
    enlace.href        = href;
    enlace.setAttribute('role', role);
    enlace.textContent = texto;
    item.appendChild(enlace);
    return item;
}

/* ── Eventos del dropdown ─────────────────────────────────── */
function _registrarEventosDropdown(trigger, menu) {
    trigger.addEventListener('click', (e) => {
        e.stopPropagation();
        menu.hidden ? _abrirDropdown(trigger, menu) : _cerrarDropdown(trigger, menu);
    });
    document.addEventListener('click', (e) => {
        if (!trigger.contains(e.target) && !menu.contains(e.target)) {
            _cerrarDropdown(trigger, menu);
        }
    });
    document.addEventListener('keydown', (e) => {
        if (e.key === 'Escape' && !menu.hidden) { _cerrarDropdown(trigger, menu); trigger.focus(); }
    });
}

function _abrirDropdown(trigger, menu) {
    menu.hidden = false;
    trigger.setAttribute('aria-expanded', 'true');
    trigger.classList.add('nav-usuario-trigger--abierto');
}

function _cerrarDropdown(trigger, menu) {
    menu.hidden = true;
    trigger.setAttribute('aria-expanded', 'false');
    trigger.classList.remove('nav-usuario-trigger--abierto');
}

/* ── Cierre de sesión ─────────────────────────────────────── */
function _manejarCierreSesion() {
    _limpiarSesion();
    window.location.href = 'index.html';
}

function _limpiarSesion() {
    localStorage.removeItem(STORAGE_KEYS.SESION_TOKEN);
    localStorage.removeItem(STORAGE_KEYS.USER_DATA);
    localStorage.removeItem(STORAGE_KEYS.USER_ROLE);
}

/* ── Protección de rutas privadas ────────────────────────── */
function _protegerPaginasPrivadas(rol) {
    const paginaActual = window.location.pathname.split('/').pop() || 'index.html';
    const paginasAlumno      = ['dashboard-alumno.html'];
    const paginasOrganizador = ['dashboard-organizador.html'];
    const paginasPrivadas    = [...paginasAlumno, ...paginasOrganizador];

    if (!paginasPrivadas.includes(paginaActual)) return;

    if (!rol) {
        window.location.href = 'login.html';
        return;
    }
    if (paginasAlumno.includes(paginaActual) && rol !== CONFIG_SISTEMA.ROLES.ALUMNO) {
        window.location.href = 'dashboard-organizador.html';
        return;
    }
    if (paginasOrganizador.includes(paginaActual) && rol !== CONFIG_SISTEMA.ROLES.ORGANIZADOR) {
        window.location.href = 'dashboard-alumno.html';
    }
}

/* ── Resaltar enlace activo ──────────────────────────────── */
function _resaltarEnlaceActivo() {
    const paginaActual = window.location.pathname.split('/').pop() || 'index.html';
    document.querySelectorAll('#nav-links a, .navbar__nav a').forEach((enlace) => {
        const href = enlace.getAttribute('href') ?? '';
        if (href === paginaActual || (paginaActual === '' && href === 'index.html')) {
            enlace.classList.add('nav-link--activo');
            enlace.setAttribute('aria-current', 'page');
        }
    });
}

/* ── Estilos del dropdown (inyección dinámica) ───────────── */
function _inyectarEstilosDropdown() {
    if (document.getElementById('fisi-ui-global-style')) return;
    const style = document.createElement('style');
    style.id = 'fisi-ui-global-style';
    style.textContent = `
    .nav-usuario-wrapper { position: relative; display: inline-block; }
    .nav-usuario-trigger {
        display: flex; align-items: center; gap: .45rem;
        background: none; border: none; cursor: pointer;
        padding: .4rem .6rem; border-radius: 6px;
        font-family: var(--fuente-fisi,'Inter',sans-serif);
        font-size: .9rem; font-weight: 600;
        color: var(--gris-oscuro,#111); transition: background .18s ease;
    }
    .main-navbar .nav-usuario-trigger { color: #111; }
    .navbar .nav-usuario-trigger { color: #fff; }
    .nav-usuario-trigger:hover,
    .nav-usuario-trigger--abierto { background: rgba(127,0,0,.1); }
    .nav-usuario-avatar {
        display: inline-flex; align-items: center; justify-content: center;
        width: 30px; height: 30px; border-radius: 50%;
        background: var(--rojo-sanmarcos,#7F0000);
        border: 2px solid rgba(255,255,255,.4);
        font-size: .78rem; font-weight: 700; color: #fff;
        text-transform: uppercase; flex-shrink: 0;
    }
    .nav-usuario-chevron { font-size: .75rem; opacity: .75; transition: transform .2s ease; }
    .nav-usuario-trigger--abierto .nav-usuario-chevron { transform: rotate(180deg); }
    .nav-dropdown-menu {
        position: absolute; top: calc(100% + 8px); right: 0;
        background: #fff; border: 1px solid #e5e7eb;
        border-radius: 10px; box-shadow: 0 8px 28px rgba(0,0,0,.14);
        min-width: 200px; list-style: none; margin: 0; padding: .4rem 0;
        z-index: 8000; animation: dropdown-aparecer .18s ease;
    }
    @keyframes dropdown-aparecer {
        from { opacity: 0; transform: translateY(-6px); }
        to   { opacity: 1; transform: translateY(0); }
    }
    .nav-dropdown-header {
        padding: .5rem 1rem .4rem; font-size: .73rem; font-weight: 600;
        color: #9ca3af; text-transform: uppercase; letter-spacing: .05em;
        border-bottom: 1px solid #f3f4f6; margin-bottom: .3rem;
    }
    .nav-dropdown-item {
        display: flex; align-items: center; width: 100%;
        padding: .55rem 1rem; font-family: var(--fuente-fisi,'Inter',sans-serif);
        font-size: .86rem; font-weight: 500; color: #374151;
        text-decoration: none; background: none; border: none;
        cursor: pointer; transition: background .15s ease, color .15s ease; text-align: left;
    }
    .nav-dropdown-item:hover { background: #f9fafb; color: var(--rojo-sanmarcos,#7F0000); }
    .nav-dropdown-separator { border-top: 1px solid #f3f4f6; margin: .3rem 0; }
    .nav-dropdown-logout { color: var(--rojo-alerta,#DC3545) !important; font-weight: 600 !important; }
    .nav-dropdown-logout:hover { background: #fff5f5 !important; }
    .nav-link--activo { color: var(--rojo-sanmarcos,#7F0000) !important; font-weight: 700; }
    `;
    document.head.appendChild(style);
}

function _escaparHTML(texto) {
    const div = document.createElement('div');
    div.textContent = String(texto);
    return div.innerHTML;
}

/* ── Exportado para uso externo ──────────────────────────── */
export function obtenerSesionActiva() {
    return _leerSesion();
}
