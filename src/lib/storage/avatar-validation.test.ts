import { describe, it, expect } from "vitest";

import { TAMANO_MAXIMO_AVATAR_BYTES, validarArchivoAvatar } from "./avatar-validation";

describe("validarArchivoAvatar", () => {
  it("acepta JPEG dentro del tamaño permitido", () => {
    expect(validarArchivoAvatar({ contentType: "image/jpeg", size: 1024 })).toEqual({ valido: true });
  });

  it("acepta PNG dentro del tamaño permitido", () => {
    expect(validarArchivoAvatar({ contentType: "image/png", size: 1024 })).toEqual({ valido: true });
  });

  it("acepta WEBP dentro del tamaño permitido", () => {
    expect(validarArchivoAvatar({ contentType: "image/webp", size: 1024 })).toEqual({ valido: true });
  });

  it("acepta un archivo exactamente en el límite de tamaño", () => {
    expect(
      validarArchivoAvatar({ contentType: "image/png", size: TAMANO_MAXIMO_AVATAR_BYTES }),
    ).toEqual({ valido: true });
  });

  it("rechaza un tipo MIME no permitido", () => {
    const resultado = validarArchivoAvatar({ contentType: "image/gif", size: 1024 });
    expect(resultado.valido).toBe(false);
    if (!resultado.valido) {
      expect(resultado.razon).toMatch(/no permitido/);
    }
  });

  it("rechaza tipos que no son de imagen (p.ej. un script disfrazado)", () => {
    const resultado = validarArchivoAvatar({
      contentType: "application/javascript",
      size: 1024,
    });
    expect(resultado.valido).toBe(false);
  });

  it("rechaza un archivo que supera el máximo de 4MB", () => {
    const resultado = validarArchivoAvatar({
      contentType: "image/png",
      size: TAMANO_MAXIMO_AVATAR_BYTES + 1,
    });
    expect(resultado.valido).toBe(false);
    if (!resultado.valido) {
      expect(resultado.razon).toMatch(/4MB/);
    }
  });

  it("rechaza un archivo vacío", () => {
    const resultado = validarArchivoAvatar({ contentType: "image/png", size: 0 });
    expect(resultado.valido).toBe(false);
  });

  it("rechaza un tamaño negativo (input corrupto o manipulado)", () => {
    const resultado = validarArchivoAvatar({ contentType: "image/png", size: -1 });
    expect(resultado.valido).toBe(false);
  });
});
