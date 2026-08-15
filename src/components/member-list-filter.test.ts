import { describe, it, expect } from "vitest";

import { opcionesCiudad, filtrarPorCiudad } from "./member-list-filter";

describe("opcionesCiudad", () => {
  it("arma una opción por cada citySlug único, etiquetada con la ciudad legible", () => {
    const rows = [
      { citySlug: "lima", ciudad: "Lima" },
      { citySlug: "cusco", ciudad: "Cusco" },
    ];
    expect(opcionesCiudad(rows)).toEqual([
      { citySlug: "cusco", ciudad: "Cusco" },
      { citySlug: "lima", ciudad: "Lima" },
    ]);
  });

  it("deduplica filas que comparten citySlug, sin repetir la opción", () => {
    const rows = [
      { citySlug: "lima", ciudad: "Lima" },
      { citySlug: "lima", ciudad: "Lima" },
      { citySlug: "lima", ciudad: "Lima" },
    ];
    expect(opcionesCiudad(rows)).toEqual([{ citySlug: "lima", ciudad: "Lima" }]);
  });

  it("ordena alfabéticamente por el nombre de ciudad, no por el slug", () => {
    const rows = [
      { citySlug: "trujillo", ciudad: "Trujillo" },
      { citySlug: "arequipa", ciudad: "Arequipa" },
      { citySlug: "bogota", ciudad: "Bogotá" },
    ];
    expect(opcionesCiudad(rows).map((o) => o.ciudad)).toEqual(["Arequipa", "Bogotá", "Trujillo"]);
  });

  it("descarta las filas sin citySlug o sin ciudad: no aportan una opción válida", () => {
    const rows = [
      { citySlug: null, ciudad: null },
      { citySlug: "lima", ciudad: "Lima" },
    ];
    expect(opcionesCiudad(rows)).toEqual([{ citySlug: "lima", ciudad: "Lima" }]);
  });

  it("si nadie declaró ciudad, devuelve una lista vacía — el selector no se pinta con esto", () => {
    const rows = [
      { citySlug: null, ciudad: null },
      { citySlug: null, ciudad: null },
    ];
    expect(opcionesCiudad(rows)).toEqual([]);
  });

  it("sin filas devuelve una lista vacía", () => {
    expect(opcionesCiudad([])).toEqual([]);
  });
});

describe("filtrarPorCiudad", () => {
  const rows = [
    { id: "1", citySlug: "lima" },
    { id: "2", citySlug: "cusco" },
    { id: "3", citySlug: "lima" },
    { id: "4", citySlug: null },
  ];

  it("sin selección (null) devuelve todas las filas sin tocar", () => {
    expect(filtrarPorCiudad(rows, null)).toEqual(rows);
  });

  it("con cadena vacía también devuelve todas las filas — mismo criterio que 'sin filtro'", () => {
    expect(filtrarPorCiudad(rows, "")).toEqual(rows);
  });

  it("filtra por citySlug exacto, dejando fuera al resto", () => {
    expect(filtrarPorCiudad(rows, "lima")).toEqual([
      { id: "1", citySlug: "lima" },
      { id: "3", citySlug: "lima" },
    ]);
  });

  it("un citySlug que nadie tiene devuelve una lista vacía, no todas las filas", () => {
    expect(filtrarPorCiudad(rows, "arequipa")).toEqual([]);
  });

  it("nunca hace match contra una fila sin citySlug, ni filtrando por una ciudad real", () => {
    const resultado = filtrarPorCiudad(rows, "lima");
    expect(resultado.some((r) => r.citySlug === null)).toBe(false);
  });
});
