import { CATEGORIAS, STATUS_EVENTO } from "../config.js";

export const eventos = [
  {
    id: 1,
    titulo: "Edición Genética: CRISPR-Cas9 y TALEN",
    categoria: CATEGORIAS.TALLER,
    estado: STATUS_EVENTO.PROGRAMADO,
    fecha_inicio: "2026-05-15",
    hora_inicio: "10:00",
    hora_fin: "14:00",
    descripcion: "Taller introductorio sobre edición genética.",
    expositores: ["Dra. Ana Pérez"],
    capacidad_max: 40
  },
  {
    id: 2,
    titulo: "Machine Learning",
    categoria: CATEGORIAS.CHARLA,
    estado: STATUS_EVENTO.PROGRAMADO,
    fecha_inicio: "2026-05-25",
    hora_inicio: "09:00",
    hora_fin: "11:00"
  }
];