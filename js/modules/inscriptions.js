// ==========================================
// INSCRIPTIONS.JS
// GESTIÓN DE INSCRIPCIONES DE ALUMNOS
// Integrante 3
// ==========================================



// ==========================================
// 1. IMPORTACIONES
// ==========================================

import { supabase }
from "../config.js";

import {
    mostrarAlerta,
    confirmarAccion
}
from "../utils/alerts.js";



// ==========================================
// 2. OBTENER ID DEL EVENTO ACTUAL
// ==========================================

const parametros =
    new URLSearchParams(
        window.location.search
    );

const eventoId =
    Number(
        parametros.get("id")
    );



// ==========================================
// 3. DETECTAR CRUCE DE HORARIOS
// ==========================================
// Retorna:
//
// true  -> existe conflicto
// false -> no existe conflicto
// ==========================================

function existeCruceHorario(
    nuevoInicio,
    nuevoFin,
    inicioExistente,
    finExistente
){

    return (

        nuevoInicio < finExistente &&
        inicioExistente < nuevoFin

    );

}



// ==========================================
// 4. VERIFICAR AFORO DISPONIBLE
// ==========================================

async function verificarAforo(
    eventoId
){

    const { count } =
        await supabase
            .from("inscripciones")
            .select("*",{
                count:"exact",
                head:true
            })
            .eq("event_id", eventoId);



    const { data:evento } =
        await supabase
            .from("eventos")
            .select("capacidad_max")
            .eq("id", eventoId)
            .single();



    if(

        evento.capacidad_max !== null &&
        count >= evento.capacidad_max

    ){

        return false;

    }

    return true;

}



// ==========================================
// 5. VALIDAR CRUCE DE HORARIOS
// ==========================================

async function verificarCruceHorario(
    usuarioId,
    eventoActual
){

    const { data } =
        await supabase
            .from("inscripciones")
            .select(`
                eventos(
                    fecha_inicio,
                    hora_inicio,
                    hora_fin
                )
            `)
            .eq(
                "user_id",
                usuarioId
            );



    for(const registro of data){

        const evento =
            registro.eventos;



        if(

            evento.fecha_inicio ===
            eventoActual.fecha_inicio

        ){

            if(

                existeCruceHorario(

                    eventoActual.hora_inicio,
                    eventoActual.hora_fin,

                    evento.hora_inicio,
                    evento.hora_fin

                )

            ){

                return true;

            }

        }

    }

    return false;

}



// ==========================================
// 6. ACTUALIZAR BOTÓN DE INSCRIPCIÓN
// ==========================================

function actualizarBoton(
    inscrito
){

    const boton =
        document.getElementById(
            "btnInscripcion"
        );



    if(inscrito){

        boton.textContent =
            "Cancelar Inscripción";

        boton.classList.add(
            "btnCancelar"
        );

    }
    else{

        boton.textContent =
            "Registrarse";

        boton.classList.remove(
            "btnCancelar"
        );

    }

}



// ==========================================
// 7. REGISTRAR INSCRIPCIÓN
// ==========================================

export async function inscribirse(
    usuarioId
){

    const aforoDisponible =
        await verificarAforo(
            eventoId
        );



    if(!aforoDisponible){

        mostrarAlerta(
            "Evento lleno",
            "No existen vacantes disponibles."
        );

        return;

    }



    const { data:evento } =
        await supabase
            .from("eventos")
            .select("*")
            .eq("id", eventoId)
            .single();



    const existeChoque =
        await verificarCruceHorario(
            usuarioId,
            evento
        );



    if(existeChoque){

        const continuar =
            await confirmarAccion(

                "Cruce de horarios",

                "Ya tienes un evento registrado en ese horario."

            );



        if(!continuar){

            return;

        }

    }



    const { error } =
        await supabase
            .from("inscripciones")
            .insert([
                {
                    user_id: usuarioId,
                    event_id: eventoId
                }
            ]);



    if(error){

        mostrarAlerta(
            "Error",
            error.message
        );

        return;

    }



    actualizarBoton(true);

}
