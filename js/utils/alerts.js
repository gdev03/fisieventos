export function mostrarAlerta(
    titulo,
    mensaje,
    tipo = "info"
){

    const modal = document.createElement("div");

    modal.classList.add("modal-overlay");

    modal.innerHTML = `
        <div class="modal-window">

            <h2>${titulo}</h2>

            <p>${mensaje}</p>

            <button id="btnCerrar">
                Aceptar
            </button>

        </div>
    `;

    document.body.appendChild(modal);

    document
        .getElementById("btnCerrar")
        .addEventListener("click", () => {
            modal.remove();
        });

}
