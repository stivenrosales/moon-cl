import { describe, expect, it } from "vitest";
import { CODIGOS_PAIS, esCodigoPais, nombrePais, paisesOrdenados } from "./paises";

describe("nombrePais", () => {
  it("traduce un codigo valido a su nombre en espanol", () => {
    expect(nombrePais("PE")).toBe("Perú");
  });

  it("devuelve null para un codigo que no esta en CODIGOS_PAIS", () => {
    expect(nombrePais("ZZ")).toBeNull();
  });

  it("devuelve null para un codigo con formato invalido", () => {
    expect(nombrePais("no-existe")).toBeNull();
  });
});

describe("esCodigoPais", () => {
  it("acepta un codigo real curado en la lista", () => {
    expect(esCodigoPais("PE")).toBe(true);
  });

  it("rechaza un codigo que no es un pais real aunque Intl.DisplayNames lo traduzca", () => {
    expect(esCodigoPais("EU")).toBe(false);
  });

  it("rechaza valores que no son string", () => {
    expect(esCodigoPais(123)).toBe(false);
    expect(esCodigoPais(null)).toBe(false);
    expect(esCodigoPais(undefined)).toBe(false);
  });
});

describe("paisesOrdenados", () => {
  const orden = paisesOrdenados();

  it("pone Peru primero porque el club es peruano", () => {
    expect(orden[0].codigo).toBe("PE");
    expect(orden[0].nombre).toBe("Perú");
  });

  it("ordena el resto alfabeticamente por nombre en espanol", () => {
    const resto = orden.slice(1);
    const nombresOrdenados = [...resto.map((p) => p.nombre)].sort((a, b) =>
      a.localeCompare(b, "es"),
    );
    expect(resto.map((p) => p.nombre)).toEqual(nombresOrdenados);
  });

  it("no repite Peru en el resto de la lista", () => {
    const resto = orden.slice(1);
    expect(resto.some((p) => p.codigo === "PE")).toBe(false);
  });

  it("cubre todos los codigos de CODIGOS_PAIS, sin de mas ni de menos", () => {
    expect(orden.map((p) => p.codigo).sort()).toEqual([...CODIGOS_PAIS].sort());
  });
});

describe("CODIGOS_PAIS", () => {
  it("no contiene codigos que no son paises reales, aunque Intl.DisplayNames los traduzca", () => {
    const noPaises = ["EU", "EZ", "UN", "QO", "ZZ", "XA", "XB", "AC", "CP", "DG", "IC", "TA"];
    for (const codigo of noPaises) {
      expect(CODIGOS_PAIS as readonly string[]).not.toContain(codigo);
    }
  });

  it("no tiene codigos duplicados", () => {
    expect(new Set(CODIGOS_PAIS).size).toBe(CODIGOS_PAIS.length);
  });

  it("incluye PE", () => {
    expect(CODIGOS_PAIS as readonly string[]).toContain("PE");
  });
});
