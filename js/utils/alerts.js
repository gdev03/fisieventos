// ==========================================
// ALERTS.JS
// SISTEMA CENTRALIZADO DE MODALES Y ALERTAS
// Integrante 3
// ==========================================



// ==========================================
// 1. ALERTA SIMPLE
// ==========================================
// Muestra una ventana emergente informativa.
// No devuelve valores.
// ==========================================

export function mostrarAlerta(
    titulo,
    mensaje
){

    const modal = document.createElement("div");

    modal.classList.add("modalOverlay");

    modal.innerHTML = `
        <div class="modalWindow">

            <h2>${titulo}</h2>

            <p>${mensaje}</p>

            <button id="btnCerrarModal">
                Aceptar
            </button>

        </div>
    `;

    document.body.appendChild(modal);

    document
        .getElementById("btnCerrarModal")
        .addEventListener("click", () => {

            modal.remove();

        });

}



// ==========================================
// 2. MODAL DE CONFIRMACIÓN
// ==========================================
// Muestra una ventana que permite:
//
// Confirmar
// Cancelar
// No volver a mostrar
//
// Devuelve:
// true  -> confirmar
// false -> cancelar
// ==========================================

export function confirmarAccion(
    titulo,
    mensaje
){

    return new Promise((resolve)=>{

        const modal = document.createElement("div");

        modal.classList.add("modalOverlay");

        modal.innerHTML = `
            <div class="modalWindow">

                <h2>${titulo}</h2>

                <p>${mensaje}</p>

                <label>

                    <input
                        type="checkbox"
                        id="checkOmitir"
                    >

                    No volver a mostrar

                </label>

                <div class="modalButtons">

                    <button id="btnConfirmar">
                        Confirmar
                    </button>

                    <button id="btnCancelar">
                        Cancelar
                    </button>

                </div>

            </div>
        `;

        document.body.appendChild(modal);



        document
            .getElementById("btnConfirmar")
            .onclick = ()=>{

                const check =
                    document.getElementById(
                        "checkOmitir"
                    );

                if(check.checked){

                    localStorage.setItem(
                        "omitirConfirmacion",
                        "true"
                    );

                }

                modal.remove();

                resolve(true);

            };



        document
            .getElementById("btnCancelar")
            .onclick = ()=>{

                modal.remove();

                resolve(false);

            };

    });

}
