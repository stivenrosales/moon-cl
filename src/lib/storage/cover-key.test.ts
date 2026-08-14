import { describe, it, expect } from "vitest";

import { construirKeyPortada } from "./cover-key";

describe("construirKeyPortada", () => {
  it("arma la key con el prefijo covers/ y el timestamp", () => {
    expect(construirKeyPortada("portada.png", 1000)).toBe("covers/1000-portada.png");
  });

  it("sanitiza espacios y acentos del nombre de archivo", () => {
    expect(construirKeyPortada("mi portada é.png", 1000)).toBe("covers/1000-mi-portada--.png");
  });

  it("sanitiza caracteres que no son seguros en una key S3", () => {
    expect(construirKeyPortada("portada/rara?.png", 1000)).toBe("covers/1000-portada-rara-.png");
  });

  it("conserva puntos y guiones porque son válidos en una key S3", () => {
    expect(construirKeyPortada("mi-portada.final.png", 1000)).toBe("covers/1000-mi-portada.final.png");
  });

  it("usa Date.now() cuando no se pasa un timestamp explícito", () => {
    const key = construirKeyPortada("portada.png");
    expect(key).toMatch(/^covers\/\d+-portada\.png$/);
  });

  it("dos subidas del mismo archivo en distinto instante generan keys distintas", () => {
    const keyA = construirKeyPortada("portada.png", 1000);
    const keyB = construirKeyPortada("portada.png", 2000);
    expect(keyA).not.toBe(keyB);
  });
});
