/**
 * ============================================================
 * js/utils/export-helpers.js
 * FISI Events — Utilidades de Exportación Local (CSV)
 * ============================================================
 */

/* ============================================================
   descargarCSV
   ============================================================ */
export function descargarCSV(nombreArchivo, datosJSON, opciones = {}) {
    if (!Array.isArray(datosJSON) || datosJSON.length === 0) {
        console.warn('[export-helpers.js] No hay datos para exportar.');
        return;
    }
    const csv = construirCSV(datosJSON, opciones);
    _dispararDescarga(csv, `${nombreArchivo}.csv`, 'text/csv;charset=utf-8;');
}

/* ============================================================
   descargarReporteEvento
   ============================================================ */
export function descargarReporteEvento(evento, listaInscritos = [], detalleAsistencias = []) {
    if (!evento) throw new Error('[export-helpers.js] Objeto evento es nulo.');

    const idEventoActual = parseInt(evento.id || evento.evento_id || evento.eventId);
    if (isNaN(idEventoActual)) throw new Error('[export-helpers.js] ID de evento inválido.');

    const nombreArchivo = `reporte_${(evento.titulo || evento.title || 'evento')
        .replace(/[^a-zA-Z0-9_\- ]/g, '')
        .replace(/\s+/g, '_')
        .toLowerCase()}`;

    const asistenciasDelEvento = detalleAsistencias.filter(
        asis => parseInt(asis.event_id || asis.evento_id || asis.eventId) === idEventoActual
    );

    const filas = listaInscritos.map((alumno, i) => {
        const registroAsistencia = asistenciasDelEvento.find(
            asis => asis.user_id === (alumno.user_id || alumno.userId || alumno.id)
        );
        const asistio = registroAsistencia ? 'Sí' : 'No';
        let fechaRegistro = '';
        if (registroAsistencia?.marcado_en) {
            fechaRegistro = new Date(registroAsistencia.marcado_en).toLocaleString('es-PE');
        }
        return {
            numero:     i + 1,
            nombre:     alumno.nombres || alumno.nombre_completo || 'Sin Nombre',
            codigo:     alumno.codigo_estudiante || alumno.codigo || 'N/A',
            carrera:    alumno.carrera || 'N/A',
            asistio,
            marcado_en: fechaRegistro,
        };
    });

    const encabezados = {
        numero: 'N°', nombre: 'Nombre Completo', codigo: 'Código',
        carrera: 'Carrera', asistio: 'Asistió', marcado_en: 'Fecha y Hora de Registro',
    };

    const presentes   = filas.filter(f => f.asistio === 'Sí').length;
    const inscritos   = filas.length;
    const porcentaje  = inscritos > 0 ? Math.round((presentes / inscritos) * 100) : 0;

    const meta = [
        `REPORTE DE ASISTENCIA — FISI EVENTS`,
        `Evento:,${_escaparCampo(evento.titulo || evento.title || '')}`,
        `Categoría:,${_escaparCampo((evento.categoria || evento.category || '').toUpperCase())}`,
        `Fecha:,${evento.fecha_inicio || evento.startDate || ''}`,
        `Capacidad máxima:,${evento.capacidad_max ?? evento.maxCapacity ?? 'Ilimitada'}`,
        `Total inscritos:,${inscritos}`,
        `Total presentes:,${presentes}`,
        `Porcentaje de asistencia:,${porcentaje}%`,
        `Generado el:,${new Date().toLocaleString('es-PE')}`,
        '',
    ].join('\n');

    const csvCuerpo  = construirCSV(filas, { encabezados });
    const csvCompleto = csvCuerpo ? (meta + '\n' + csvCuerpo) : meta;
    _dispararDescarga(csvCompleto, `${nombreArchivo}.csv`, 'text/csv;charset=utf-8;');
}

/* ── Funciones internas ──────────────────────────────────── */
function construirCSV(datos, opciones = {}) {
    if (!Array.isArray(datos) || datos.length === 0) return '';
    const { columnas, encabezados = {} } = opciones;
    const cols = columnas || Object.keys(datos[0]);
    const filaEncabezado = cols.map(c => _escaparCampo(encabezados[c] || _formatearNombreCol(c))).join(',');
    const filasData = datos.map(fila => cols.map(col => _escaparCampo(fila[col] ?? '')).join(','));
    return [filaEncabezado, ...filasData].join('\n');
}

function _escaparCampo(valor) {
    const str = String(valor ?? '');
    if (str.includes(',') || str.includes('"') || str.includes('\n') || str.includes('\r')) {
        return '"' + str.replace(/"/g, '""') + '"';
    }
    return str;
}

function _formatearNombreCol(campo) {
    return campo.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase());
}

function _dispararDescarga(contenido, nombreArchivo, tipo) {
    const contenidoConBOM = contenido.startsWith('\uFEFF') ? contenido : '\uFEFF' + contenido;
    const blob = new Blob([contenidoConBOM], { type: tipo });
    const url  = URL.createObjectURL(blob);
    const enlace = document.createElement('a');
    enlace.setAttribute('href', url);
    enlace.setAttribute('download', nombreArchivo);
    enlace.style.display = 'none';
    document.body.appendChild(enlace);
    enlace.click();
    document.body.removeChild(enlace);
    URL.revokeObjectURL(url);
}
