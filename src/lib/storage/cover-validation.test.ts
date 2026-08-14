import { describe, it, expect } from "vitest";

import { TAMANO_MAXIMO_PORTADA_BYTES, validarArchivoPortada } from "./cover-validation";

describe("validarArchivoPortada", () => {
  it("acepta JPEG dentro del tamaño permitido", () => {
    expect(validarArchivoPortada({ contentType: "image/jpeg", size: 1024 })).toEqual({ valido: true });
  });

  it("acepta PNG dentro del tamaño permitido", () => {
    expect(validarArchivoPortada({ contentType: "image/png", size: 1024 })).toEqual({ valido: true });
  });

  it("acepta WEBP dentro del tamaño permitido", () => {
    expect(validarArchivoPortada({ contentType: "image/webp", size: 1024 })).toEqual({ valido: true });
  });

  it("acepta un archivo exactamente en el límite de tamaño", () => {
    expect(
      validarArchivoPortada({ contentType: "image/png", size: TAMANO_MAXIMO_PORTADA_BYTES }),
    ).toEqual({ valido: true });
  });

  it("rechaza un tipo MIME no permitido", () => {
    const resultado = validarArchivoPortada({ contentType: "image/gif", size: 1024 });
    expect(resultado.valido).toBe(false);
    if (!resultado.valido) {
      expect(resultado.razon).toMatch(/no permitido/);
    }
  });

  it("rechaza tipos que no son de imagen (p.ej. un script disfrazado)", () => {
    const resultado = validarArchivoPortada({
      contentType: "application/javascript",
      size: 1024,
    });
    expect(resultado.valido).toBe(false);
  });

  it("rechaza un archivo que supera el máximo de 2MB", () => {
    const resultado = validarArchivoPortada({
      contentType: "image/png",
      size: TAMANO_MAXIMO_PORTADA_BYTES + 1,
    });
    expect(resultado.valido).toBe(false);
    if (!resultado.valido) {
      expect(resultado.razon).toMatch(/2MB/);
    }
  });

  it("rechaza un archivo vacío", () => {
    const resultado = validarArchivoPortada({ contentType: "image/png", size: 0 });
    expect(resultado.valido).toBe(false);
  });

  it("rechaza un tamaño negativo (input corrupto o manipulado)", () => {
    const resultado = validarArchivoPortada({ contentType: "image/png", size: -1 });
    expect(resultado.valido).toBe(false);
  });
});
