import { afterAll, describe, expect, it } from "vitest";
import { nombresDeMeses } from "@/lib/months";

const MESES_ES = [
  "enero",
  "febrero",
  "marzo",
  "abril",
  "mayo",
  "junio",
  "julio",
  "agosto",
  "septiembre",
  "octubre",
  "noviembre",
  "diciembre",
];

describe("nombresDeMeses", () => {
  const tzOriginal = process.env.TZ;

  afterAll(() => {
    process.env.TZ = tzOriginal;
  });

  it("devuelve los doce meses en orden, con el nombre que corresponde a su índice", () => {
    expect(nombresDeMeses()).toEqual(MESES_ES);
  });

  // El bug que motivó este módulo: la lista se armaba con
  // Date.UTC(2000, i, 1) —medianoche UTC del día 1— formateado SIN timeZone,
  // así que tomaba la del navegador. Con cualquier offset negativo (toda
  // América) esa medianoche cae en el último día del mes ANTERIOR y las
  // etiquetas quedan corridas un lugar: el índice 3 decía "marzo". Elegir
  // "Marzo" en el perfil guardaba Date.UTC(2000, 3, d), o sea abril.
  // El servidor corre en UTC, así que el bug era invisible en CI y solo lo
  // veían las usuarias — que en un club peruano son todas.
  it("no se corre un mes en una zona horaria con offset negativo", () => {
    process.env.TZ = "America/Lima";
    expect(nombresDeMeses()).toEqual(MESES_ES);
  });

  it("no se corre un mes en una zona horaria con offset positivo", () => {
    process.env.TZ = "Asia/Tokyo";
    expect(nombresDeMeses()).toEqual(MESES_ES);
  });
});
