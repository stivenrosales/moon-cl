import { describe, it, expect } from "vitest";

import { contarSociasPorPais } from "./socias-por-pais";

describe("contarSociasPorPais", () => {
  it("cuenta las socias por país y traduce el código a español", () => {
    const users = [{ countryCode: "PE" }, { countryCode: "PE" }, { countryCode: "CO" }];
    const resultado = contarSociasPorPais(users);
    expect(resultado.paises).toEqual([
      { codigo: "PE", nombre: "Perú", cantidad: 2 },
      { codigo: "CO", nombre: "Colombia", cantidad: 1 },
    ]);
  });

  it("cuenta aparte a las que no declararon país, sin mezclarlas con ningún código", () => {
    const users = [{ countryCode: "PE" }, { countryCode: null }, { countryCode: null }];
    const resultado = contarSociasPorPais(users);
    expect(resultado.sinEspecificar).toBe(2);
    expect(resultado.paises).toEqual([{ codigo: "PE", nombre: "Perú", cantidad: 1 }]);
  });

  it("ordena de mayor a menor cantidad", () => {
    const users = [
      { countryCode: "CO" },
      { countryCode: "PE" },
      { countryCode: "PE" },
      { countryCode: "PE" },
    ];
    const resultado = contarSociasPorPais(users);
    expect(resultado.paises.map((p) => p.codigo)).toEqual(["PE", "CO"]);
  });

  it("ante un empate en cantidad, desempata alfabéticamente por nombre en español", () => {
    const users = [{ countryCode: "CO" }, { countryCode: "AR" }];
    const resultado = contarSociasPorPais(users);
    // Argentina antes que Colombia alfabéticamente, aunque ambas tengan 1.
    expect(resultado.paises.map((p) => p.nombre)).toEqual(["Argentina", "Colombia"]);
  });

  it("sin usuarias devuelve ambas listas vacías", () => {
    const resultado = contarSociasPorPais([]);
    expect(resultado.paises).toEqual([]);
    expect(resultado.sinEspecificar).toBe(0);
  });

  it("todas sin país: paises vacío y sinEspecificar con el total", () => {
    const users = [{ countryCode: null }, { countryCode: null }];
    const resultado = contarSociasPorPais(users);
    expect(resultado.paises).toEqual([]);
    expect(resultado.sinEspecificar).toBe(2);
  });

  it("un código que no está en el catálogo curado no revienta: usa el propio código como nombre", () => {
    const users = [{ countryCode: "ZZ" }];
    const resultado = contarSociasPorPais(users);
    expect(resultado.paises).toEqual([{ codigo: "ZZ", nombre: "ZZ", cantidad: 1 }]);
  });
});
