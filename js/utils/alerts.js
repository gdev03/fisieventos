/**
 * ============================================================
 * js/utils/alerts.js
 * FISI Events — Sistema de Alertas (Toasts + Modales)
 * ============================================================
 */

import { STORAGE_KEYS } from '../config.js';

/* ── Inyectar estilos base una sola vez ──────────────────── */
(function inyectarEstilosAlerts() {
    if (document.getElementById('fisi-alerts-style')) return;
    const style = document.createElement('style');
    style.id = 'fisi-alerts-style';
    style.textContent = `
    .fisi-toast {
      position: fixed; bottom: 1.5rem; right: 1.5rem; z-index: 9999;
      min-width: 260px; max-width: 420px; padding: 0.85rem 1.2rem;
      border-radius: 8px; font-family: var(--fuente-fisi,'Inter',sans-serif);
      font-size: 0.9rem; font-weight: 500; color: #fff;
      box-shadow: 0 4px 20px rgba(0,0,0,.25);
      display: flex; align-items: center; gap: .75rem;
      opacity: 0; transform: translateY(12px);
      transition: opacity .28s ease, transform .28s ease;
    }
    .fisi-toast.toast-visible { opacity: 1; transform: translateY(0); }
    .fisi-toast.toast-exit    { opacity: 0; transform: translateY(12px); }
    .fisi-toast.toast-exito   { background: var(--verde-exito,#28A745); }
    .fisi-toast.toast-error   { background: var(--rojo-alerta,#DC3545); }
    .fisi-toast.toast-info    { background: #0d6efd; }
    .fisi-toast.toast-aviso   { background: #e0800a; }
    .fisi-toast__icono        { font-size: 1.15rem; flex-shrink: 0; }
    .fisi-toast__cerrar {
      margin-left: auto; background: none; border: none;
      color: rgba(255,255,255,.8); cursor: pointer; font-size: 1rem;
      line-height: 1; padding: 0 0 0 .5rem; flex-shrink: 0;
    }
    .fisi-toast__cerrar:hover { color: #fff; }
    .fisi-modal-overlay {
      position: fixed; inset: 0; z-index: 10000;
      background: rgba(0,0,0,.55); backdrop-filter: blur(4px);
      display: flex; align-items: center; justify-content: center;
      opacity: 0; transition: opacity .22s ease;
    }
    .fisi-modal-overlay.modal-visible { opacity: 1; }
    .fisi-modal-card {
      background: #fff; border-radius: 12px; padding: 2rem;
      max-width: 440px; width: calc(100% - 2rem);
      box-shadow: 0 12px 40px rgba(0,0,0,.22);
      transform: scale(.92); transition: transform .22s ease;
      font-family: var(--fuente-fisi,'Inter',sans-serif);
    }
    .fisi-modal-overlay.modal-visible .fisi-modal-card { transform: scale(1); }
    .fisi-modal-titulo {
      font-size: 1.1rem; font-weight: 700;
      color: var(--gris-oscuro,#111); margin: 0 0 .5rem 0;
      border-left: 4px solid var(--rojo-sanmarcos,#7F0000);
      padding-left: .6rem;
    }
    .fisi-modal-desc { font-size: .88rem; color: #444; line-height: 1.55; margin: 0 0 1.4rem 0; }
    .fisi-modal-acciones { display: flex; gap: .75rem; justify-content: flex-end; flex-wrap: wrap; }
    .fisi-modal-acciones button {
      font-family: var(--fuente-fisi,'Inter',sans-serif);
      font-size: .85rem; font-weight: 600; border: none;
      border-radius: 6px; padding: .55rem 1.2rem; cursor: pointer;
      transition: opacity .15s ease, transform .12s ease;
    }
    .fisi-modal-acciones button:active { transform: scale(.96); }
    .btn-modal-cancelar { background: #e9ecef; color: #333; }
    .btn-modal-cancelar:hover { background: #dee2e6; }
    .btn-modal-aceptar  { background: var(--rojo-sanmarcos,#7F0000); color: #fff; }
    .btn-modal-aceptar:hover { opacity: .88; }
    .fisi-checkbox-label {
      display: flex; align-items: center; gap: .5rem;
      font-size: .8rem; color: #666; margin-bottom: 1.2rem;
      cursor: pointer; user-select: none;
    }
    .fisi-checkbox-label input[type="checkbox"] {
      accent-color: var(--rojo-sanmarcos,#7F0000); width: 15px; height: 15px; cursor: pointer;
    }
    `;
    document.head.appendChild(style);
})();

/* ============================================================
   mostrarAlertaFlotante (Toast)
   ============================================================ */
export function mostrarAlertaFlotante(mensaje, tipo = 'info') {
    const iconos = { exito: '✔', error: '✖', info: 'ℹ', aviso: '⚠' };
    const toast  = document.createElement('div');
    toast.className = `fisi-toast toast-${tipo}`;
    toast.setAttribute('role', 'alert');
    toast.setAttribute('aria-live', 'assertive');

    const icono = document.createElement('span');
    icono.className   = 'fisi-toast__icono';
    icono.textContent = iconos[tipo] ?? 'ℹ';

    const texto = document.createElement('span');
    texto.textContent = mensaje;

    const cerrar = document.createElement('button');
    cerrar.className   = 'fisi-toast__cerrar';
    cerrar.setAttribute('aria-label', 'Cerrar notificación');
    cerrar.textContent = '✕';

    toast.appendChild(icono);
    toast.appendChild(texto);
    toast.appendChild(cerrar);
    document.body.appendChild(toast);

    void toast.offsetHeight;
    toast.classList.add('toast-visible');

    const destruir = () => {
        toast.classList.remove('toast-visible');
        toast.classList.add('toast-exit');
        toast.addEventListener('transitionend', () => toast.remove(), { once: true });
    };

    const timerId = setTimeout(destruir, 4000);
    cerrar.addEventListener('click', () => { clearTimeout(timerId); destruir(); }, { once: true });
}

/* ============================================================
   mostrarModalConfirmacion
   ============================================================ */
export function mostrarModalConfirmacion(titulo, descripcion) {
    return new Promise((resolve) => {
        const overlay = _crearOverlay();
        const card    = _crearCard();

        const tituloEl = document.createElement('h3');
        tituloEl.className   = 'fisi-modal-titulo';
        tituloEl.textContent = titulo;

        const descEl = document.createElement('p');
        descEl.className   = 'fisi-modal-desc';
        descEl.textContent = descripcion;

        const acciones    = document.createElement('div');
        acciones.className = 'fisi-modal-acciones';

        const btnCancelar = document.createElement('button');
        btnCancelar.className   = 'btn-modal-cancelar';
        btnCancelar.textContent = 'Cancelar';

        const btnAceptar  = document.createElement('button');
        btnAceptar.className   = 'btn-modal-aceptar';
        btnAceptar.textContent = 'Aceptar';

        acciones.appendChild(btnCancelar);
        acciones.appendChild(btnAceptar);
        card.appendChild(tituloEl);
        card.appendChild(descEl);
        card.appendChild(acciones);
        overlay.appendChild(card);
        document.body.appendChild(overlay);

        void overlay.offsetHeight;
        overlay.classList.add('modal-visible');

        const cerrar = (res) => {
            overlay.classList.remove('modal-visible');
            overlay.addEventListener('transitionend', () => overlay.remove(), { once: true });
            resolve(res);
        };

        btnCancelar.addEventListener('click', () => cerrar(false));
        btnAceptar.addEventListener('click',  () => cerrar(true));

        const onKeydown = (e) => {
            if (e.key === 'Escape') { document.removeEventListener('keydown', onKeydown); cerrar(false); }
        };
        document.addEventListener('keydown', onKeydown);
        overlay.addEventListener('click', (e) => { if (e.target === overlay) cerrar(false); });
    });
}

/* ============================================================
   verificarYConfirmarChoqueHorario
   ============================================================ */
export function verificarYConfirmarChoqueHorario(tituloNuevo, fecha, inicio, fin) {
    const omitir = localStorage.getItem(STORAGE_KEYS.OMITIR_AVISO_CRUCE);
    if (omitir === 'true') return Promise.resolve(true);

    return new Promise((resolve) => {
        const overlay = _crearOverlay();
        const card    = _crearCard();

        const tituloEl = document.createElement('h3');
        tituloEl.className   = 'fisi-modal-titulo';
        tituloEl.textContent = '⚠ Conflicto de Horario Detectado';

        const descEl = document.createElement('p');
        descEl.className = 'fisi-modal-desc';
        descEl.innerHTML = `
            El evento <strong>"${_escapar(tituloNuevo)}"</strong>
            (${_escapar(fecha)}, ${_escapar(inicio)} – ${_escapar(fin)})
            se superpone con una actividad a la que ya estás inscrito.<br><br>
            Si deseas inscribirte de todas formas, haz clic en <strong>Continuar</strong>.
        `;

        const checkLabel  = document.createElement('label');
        checkLabel.className = 'fisi-checkbox-label';

        const checkbox    = document.createElement('input');
        checkbox.type     = 'checkbox';
        checkbox.id       = 'fisi-omitir-aviso-cruce';

        const checkTexto  = document.createElement('span');
        checkTexto.textContent = 'No volver a mostrar este aviso en futuras inscripciones';

        checkLabel.appendChild(checkbox);
        checkLabel.appendChild(checkTexto);

        const acciones    = document.createElement('div');
        acciones.className = 'fisi-modal-acciones';

        const btnCancelar  = document.createElement('button');
        btnCancelar.className   = 'btn-modal-cancelar';
        btnCancelar.textContent = 'Cancelar';

        const btnContinuar = document.createElement('button');
        btnContinuar.className   = 'btn-modal-aceptar';
        btnContinuar.textContent = 'Continuar de todas formas';

        acciones.appendChild(btnCancelar);
        acciones.appendChild(btnContinuar);

        card.appendChild(tituloEl);
        card.appendChild(descEl);
        card.appendChild(checkLabel);
        card.appendChild(acciones);
        overlay.appendChild(card);
        document.body.appendChild(overlay);

        void overlay.offsetHeight;
        overlay.classList.add('modal-visible');

        const cerrar = (res) => {
            if (res && checkbox.checked) {
                localStorage.setItem(STORAGE_KEYS.OMITIR_AVISO_CRUCE, 'true');
            }
            overlay.classList.remove('modal-visible');
            overlay.addEventListener('transitionend', () => overlay.remove(), { once: true });
            resolve(res);
        };

        btnCancelar.addEventListener('click',  () => cerrar(false));
        btnContinuar.addEventListener('click', () => cerrar(true));

        const onKeydown = (e) => {
            if (e.key === 'Escape') { document.removeEventListener('keydown', onKeydown); cerrar(false); }
        };
        document.addEventListener('keydown', onKeydown);
        overlay.addEventListener('click', (e) => { if (e.target === overlay) cerrar(false); });
    });
}

/* ── Helpers privados ─────────────────────────────────────── */
function _crearOverlay() {
    const el = document.createElement('div');
    el.className = 'fisi-modal-overlay';
    el.setAttribute('role', 'dialog');
    el.setAttribute('aria-modal', 'true');
    return el;
}

function _crearCard() {
    const el = document.createElement('div');
    el.className = 'fisi-modal-card';
    return el;
}

function _escapar(texto) {
    const div = document.createElement('div');
    div.textContent = String(texto);
    return div.innerHTML;
}
