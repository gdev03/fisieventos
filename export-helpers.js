/**
 * ============================================================
 * js/utils/export-helpers.js
 * FISI Events — Utilidades de Exportación Local
 * Integrante 4: Panel de Organización
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
  console.log(`[export-helpers.js] CSV "${nombreArchivo}.csv" descargado.`);
}

/* ============================================================
   descargarReporteEvento
   ============================================================ */
export function descargarReporteEvento(evento, listaInscritos = [], detalleAsistencias = []) {
  // ── BLINDAJE 2: Validación estricta del objeto evento y su ID ──
  if (!evento) {
    throw new Error('[export-helpers.js] Error: El objeto evento es nulo o indefinido.');
  }

  const idEventoActual = parseInt(evento.id || evento.evento_id || evento.eventId);
  
  if (isNaN(idEventoActual)) {
    throw new Error('[export-helpers.js] Error: ID de evento inválido. No se puede cruzar la asistencia.');
  }

  const nombreArchivo = `reporte_${(evento.titulo || evento.nombre || 'evento')
    .replace(/[^a-zA-Z0-9_\- ]/g, '')
    .replace(/\s+/g, '_')
    .toLowerCase()}`;

  const asistenciasDelEvento = detalleAsistencias.filter(
    asis => parseInt(asis.event_id || asis.evento_id || asis.eventId) === idEventoActual
  );

  // Construir filas relacionales
  const filas = listaInscritos.map((alumno, i) => {
    const registroAsistencia = asistenciasDelEvento.find(
      asis => asis.user_id === (alumno.user_id || alumno.userId || alumno.id)
    );

    const asistio = registroAsistencia ? 'Sí' : 'No';
    
    let fechaRegistro = '';
    if (registroAsistencia && registroAsistencia.marcado_en) {
      fechaRegistro = new Date(registroAsistencia.marcado_en).toLocaleString('es-PE');
    }

    return {
      numero:     i + 1,
      nombre:     alumno.nombre || alumno.nombre_completo || 'Sin Nombre',
      codigo:     alumno.codigo || alumno.codigo_estudiante || 'N/A',
      carrera:    alumno.carrera || 'N/A',
      asistio:    asistio,
      marcado_en: fechaRegistro,
    };
  });

  const encabezados = {
    numero:     'N°',
    nombre:     'Nombre Completo',
    codigo:     'Código',
    carrera:    'Carrera',
    asistio:    'Asistió',
    marcado_en: 'Fecha y Hora Real de Registro',
  };

  const presentes = filas.filter(f => f.asistio === 'Sí').length; 
  const inscritos = filas.length;
  const porcentaje = inscritos > 0 ? Math.round((presentes / inscritos) * 100) : 0;

  const meta = [
    `REPORTE DE ASISTENCIA — FISI EVENTS`,
    `Evento:,${_escaparCampo(evento.titulo || evento.nombre || '')}`,
    `Categoría:,${_escaparCampo((evento.categoria || '').toUpperCase())}`,
    `Fecha:,${evento.fecha_inicio || ''}`,
    `Capacidad máxima:,${evento.capacidad_max ?? 'Ilimitada'}`,
    `Total inscritos:,${inscritos}`,
    `Total presentes:,${presentes}`,
    `Porcentaje de asistencia:,${porcentaje}%`,
    `Generado el:,${new Date().toLocaleString('es-PE')}`,
    '', 
  ].join('\n');

  // Si 'filas' está vacío, construirCSV devolverá un string vacío pacíficamente.
  // El reporte se exportará solo con los metadatos (lo cual es correcto para un evento sin alumnos).
  const csvCuerpo = construirCSV(filas, { encabezados });
  const csvCompleto = csvCuerpo ? (meta + '\n' + csvCuerpo) : meta;

  _dispararDescarga(csvCompleto, `${nombreArchivo}.csv`, 'text/csv;charset=utf-8;');
}

/* ============================================================
   construirCSV  (función interna)
   ============================================================ */
function construirCSV(datos, opciones = {}) {
  // ── BLINDAJE 1: Evitar crasheo de Object.keys con arrays vacíos ──
  if (!Array.isArray(datos) || datos.length === 0) {
    return '';
  }

  const { columnas, encabezados = {} } = opciones;
  const cols = columnas || Object.keys(datos[0]);

  const filaEncabezado = cols
    .map(c => _escaparCampo(encabezados[c] || _formatearNombreCol(c)))
    .join(',');

  const filasData = datos.map(fila =>
    cols.map(col => _escaparCampo(fila[col] ?? '')).join(',')
  );

  return [filaEncabezado, ...filasData].join('\n');
}

/* ============================================================
   _escaparCampo  (función interna)
   ============================================================ */
function _escaparCampo(valor) {
  const str = String(valor ?? '');
  if (str.includes(',') || str.includes('"') || str.includes('\n') || str.includes('\r')) {
    return '"' + str.replace(/"/g, '""') + '"';
  }
  return str;
}

/* ============================================================
   _formatearNombreCol  (función interna)
   ============================================================ */
function _formatearNombreCol(campo) {
  return campo.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase());
}

/* ============================================================
   _dispararDescarga  (función interna)
   ============================================================ */
function _dispararDescarga(contenido, nombreArchivo, tipo) {
  const contenidoConBOM = contenido.startsWith('\uFEFF') ? contenido : '\uFEFF' + contenido;
  
  const blob = new Blob([contenidoConBOM], { type: tipo });
  const urlDescarga = URL.createObjectURL(blob);
  
  const enlaceOculto = document.createElement('a');
  enlaceOculto.setAttribute('href', urlDescarga);
  enlaceOculto.setAttribute('download', nombreArchivo);
  enlaceOculto.style.display = 'none';
  
  document.body.appendChild(enlaceOculto);
  enlaceOculto.click();
  
  document.body.removeChild(enlaceOculto);
  URL.revokeObjectURL(urlDescarga);
}
