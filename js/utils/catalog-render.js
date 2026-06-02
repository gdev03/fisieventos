/**
 * ============================================================
 * js/utils/catalog-render.js
 * FISI Events — Renderizador del Catálogo de Eventos
 * ============================================================
 */

import { obtenerTodosLosEventos } from '../modules/events.js';

document.addEventListener('DOMContentLoaded', async () => {
    const container    = document.getElementById('events-container');
    const searchInput  = document.getElementById('search-input');
    const filterButtons = document.querySelectorAll('.filter-btn');
    if (!container) return;

    // Estado
    let categoriaActiva = 'todos';
    let textoBusqueda   = '';
    let todosLosEventos = [];

    // Mostrar spinner mientras carga
    container.innerHTML = `
        <div style="grid-column:1/-1;text-align:center;padding:3rem;color:#555;">
            <div class="spinner" style="margin:0 auto 1rem;"></div>
            <p>Cargando eventos...</p>
        </div>`;

    try {
        todosLosEventos = await obtenerTodosLosEventos();
    } catch (e) {
        console.warn('[catalog-render] Error cargando eventos:', e.message);
        todosLosEventos = [];
    }

    // Si no hay eventos en la BDD, insertar datos demo
    if (todosLosEventos.length === 0) {
        todosLosEventos = _eventosDemo();
    }

    aplicarFiltros();

    /* ── Búsqueda ──────────────────────────────────────────── */
    if (searchInput) {
        searchInput.addEventListener('input', (e) => {
            textoBusqueda = e.target.value;
            aplicarFiltros();
        });
    }

    /* ── Filtros por categoría ─────────────────────────────── */
    filterButtons.forEach(btn => {
        btn.addEventListener('click', () => {
            filterButtons.forEach(b => b.classList.remove('active'));
            btn.classList.add('active');
            categoriaActiva = btn.dataset.category || 'todos';
            aplicarFiltros();
        });
    });

    function aplicarFiltros() {
        const filtrados = todosLosEventos.filter(ev => {
            const cat    = (ev.categoria || ev.category || '').toLowerCase();
            const titulo = (ev.titulo    || ev.title    || '').toLowerCase();
            const ok_cat = categoriaActiva === 'todos' || cat === categoriaActiva;
            const ok_txt = titulo.includes(textoBusqueda.toLowerCase());
            return ok_cat && ok_txt;
        });
        renderEventos(filtrados);
    }

    function renderEventos(lista) {
        if (lista.length === 0) {
            container.innerHTML = `
                <div style="grid-column:1/-1;text-align:center;padding:3rem;color:#888;">
                    <p style="font-size:1.1rem;">No se encontraron eventos que coincidan con tu búsqueda.</p>
                </div>`;
            return;
        }

        container.innerHTML = lista.map(ev => {
            const id       = ev.id || ev.eventId;
            const titulo   = ev.titulo    || ev.title    || 'Sin título';
            const categoria = (ev.categoria || ev.category || 'charla').toLowerCase();
            const fecha    = ev.fecha_inicio || ev.startDate || '';
            const horaIni  = ev.hora_inicio  || ev.startTime || '';
            const horaFin  = ev.hora_fin     || ev.endTime   || '';
            const horario  = horaIni ? `${horaIni}${horaFin ? ' - ' + horaFin : ''}` : 'Horario por confirmar';

            return `
                <article class="event-card">
                    <span class="event-badge badge-${categoria}">${categoria}</span>
                    <h2 class="event-title">${_escapeHtml(titulo)}</h2>
                    <div class="event-details">
                        <p>📅 ${fecha || 'Fecha por confirmar'}</p>
                        <p>⏰ ${horario}</p>
                    </div>
                    <a href="evento-detalle.html?id=${id}" class="btn-ver-mas">Ver más</a>
                </article>
            `;
        }).join('');
    }

    function _escapeHtml(texto) {
        return String(texto || '').replace(/[&<>"']/g, m => ({
            '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#039;'
        })[m]);
    }

    function _eventosDemo() {
        return [
            {
                id: 1, titulo: 'Taller de Inteligencia Artificial Aplicada',
                categoria: 'taller', fecha_inicio: '2026-06-15',
                hora_inicio: '09:00', hora_fin: '12:00',
            },
            {
                id: 2, titulo: 'Charla: Seguridad en Aplicaciones Web',
                categoria: 'charla', fecha_inicio: '2026-06-20',
                hora_inicio: '15:00', hora_fin: '17:00',
            },
            {
                id: 3, titulo: 'Seminario de Cloud Computing con AWS',
                categoria: 'seminario', fecha_inicio: '2026-07-01',
                hora_inicio: '10:00', hora_fin: '13:00',
            },
            {
                id: 4, titulo: 'Congreso de Sistemas Distribuidos FISI 2026',
                categoria: 'congreso', fecha_inicio: '2026-07-10',
                hora_inicio: '08:00', hora_fin: '18:00',
            },
        ];
    }
});
