/**
 * ============================================================
 * js/utils/calendar-render.js
 * FISI Events — Renderizador del Calendario Mensual
 * ============================================================
 */

import { obtenerTodosLosEventos } from '../modules/events.js';

document.addEventListener('DOMContentLoaded', async () => {
    const calendarGrid  = document.getElementById('calendar-grid');
    const calendarTitle = document.getElementById('calendar-month-year');
    if (!calendarGrid || !calendarTitle) return;

    const today = new Date();
    const year  = today.getFullYear();
    const month = today.getMonth();

    // Obtener eventos de la base de datos (o localStorage)
    let eventos = [];
    try {
        eventos = await obtenerTodosLosEventos();
    } catch (e) {
        console.warn('[calendar-render] No se pudieron cargar eventos:', e.message);
    }

    renderWeekdays();
    renderCalendar(year, month, eventos);

    function renderWeekdays() {
        const parent = calendarGrid.parentElement;
        if (parent.querySelector('.calendar-weekdays')) return;
        const weekdays = document.createElement('div');
        weekdays.className = 'calendar-weekdays';
        weekdays.innerHTML = `
            <div>L</div><div>M</div><div>M</div>
            <div>J</div><div>V</div><div>S</div><div>D</div>
        `;
        parent.insertBefore(weekdays, calendarGrid);
    }

    function renderCalendar(year, month, eventos) {
        calendarGrid.innerHTML = '';

        const monthName = new Intl.DateTimeFormat('es-ES', {
            month: 'long', year: 'numeric'
        }).format(new Date(year, month, 1));
        calendarTitle.textContent = monthName.charAt(0).toUpperCase() + monthName.slice(1);

        const daysInMonth   = new Date(year, month + 1, 0).getDate();
        const firstDayIndex = (new Date(year, month, 1).getDay() + 6) % 7; // Lunes = 0
        const totalCells    = 42; // 6 semanas × 7 días

        for (let i = 0; i < totalCells; i++) {
            const cell      = document.createElement('div');
            cell.className  = 'calendar-day';
            const dayNumber = i - firstDayIndex + 1;

            if (dayNumber < 1 || dayNumber > daysInMonth) {
                cell.classList.add('empty-day');
                cell.innerHTML = '&nbsp;';
            } else {
                cell.textContent = dayNumber;
                const currentDate = `${year}-${pad(month + 1)}-${pad(dayNumber)}`;

                const eventosDelDia = eventos.filter(ev => {
                    const fechaEv = ev.fecha_inicio || ev.startDate || '';
                    return fechaEv === currentDate;
                });

                if (eventosDelDia.length > 0) {
                    cell.classList.add('has-event');
                    cell.dataset.count = eventosDelDia.length;
                    cell.title = eventosDelDia.map(e => e.titulo || e.title).join('\n');
                    cell.style.cursor = 'pointer';
                    cell.addEventListener('click', () => {
                        // Scroll/filtrar al catálogo si es posible
                        const section = document.getElementById('events-container');
                        if (section) section.scrollIntoView({ behavior: 'smooth' });
                    });
                }

                if (
                    dayNumber === today.getDate() &&
                    month === today.getMonth() &&
                    year === today.getFullYear()
                ) {
                    cell.classList.add('today');
                }
            }
            calendarGrid.appendChild(cell);
        }
    }

    function pad(number) {
        return String(number).padStart(2, '0');
    }
});
