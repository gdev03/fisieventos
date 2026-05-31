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
export function confirmarAccion(
    titulo,
    mensaje
){

    return new Promise((resolve)=>{

        const modal = document.createElement("div");

        modal.classList.add("modal-overlay");

        modal.innerHTML = `
        <div class="modal-window">

            <h2>${titulo}</h2>

            <p>${mensaje}</p>

            <label>
                <input
                    type="checkbox"
                    id="noMostrar"
                >
                No volver a mostrar
            </label>

            <button id="btnSi">
                Confirmar
            </button>

            <button id="btnNo">
                Cancelar
            </button>

        </div>
        `;

        document.body.appendChild(modal);

        document
            .getElementById("btnSi")
            .onclick = ()=>{

                const check =
                    document.getElementById("noMostrar");

                if(check.checked){

                    localStorage.setItem(
                        "omitirConfirmacion",
                        true
                    );
                }

                modal.remove();

                resolve(true);
            };

        document
            .getElementById("btnNo")
            .onclick = ()=>{

                modal.remove();

                resolve(false);
            };
    });
}
