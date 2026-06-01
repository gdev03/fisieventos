import { eventos } from "../modules/events.js";

document.addEventListener("DOMContentLoaded", () => {
  const container = document.getElementById("events-container");
  const searchInput = document.getElementById("search-input");
  const filterButtons = document.querySelectorAll(".filter-btn");

  let categoriaActiva = "todos";
  let textoBusqueda = "";

  function renderEventos(lista) {
    container.innerHTML = lista.map(evento => `
      <article class="event-card">
        <span class="event-badge badge-${evento.categoria}">${evento.categoria}</span>
        <h2 class="event-title">${evento.titulo}</h2>
        <div class="event-details">
          <p>📅 ${evento.fecha_inicio}</p>
          <p>⏰ ${evento.hora_inicio} - ${evento.hora_fin}</p>
        </div>
        <a href="evento-detalle.html?id=${evento.id}" class="btn-ver-mas">Ver más</a>
      </article>
    `).join("");
  }

  function aplicarFiltros() {
    const filtrados = eventos.filter(evento => {
      const coincideCategoria =
        categoriaActiva === "todos" || evento.categoria === categoriaActiva;

      const coincideTexto =
        evento.titulo.toLowerCase().includes(textoBusqueda.toLowerCase());

      return coincideCategoria && coincideTexto;
    });

    renderEventos(filtrados);
  }

  searchInput.addEventListener("input", (e) => {
    textoBusqueda = e.target.value;
    aplicarFiltros();
  });

  filterButtons.forEach(btn => {
    btn.addEventListener("click", () => {
      categoriaActiva = btn.dataset.category;
      aplicarFiltros();
    });
  });

  renderEventos(eventos);
});