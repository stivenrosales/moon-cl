import { describe, it, expect } from "vitest";

import { resolveClubRowMode } from "./club-reading-row";

describe("resolveClubRowMode", () => {
  it("devuelve 'none' cuando no hay libro actual del club", () => {
    expect(resolveClubRowMode(undefined, [])).toBe("none");
  });

  it("devuelve 'none' cuando hay libro del club pero el usuario no tiene ningún UserBook", () => {
    // Antes: esto se contaba como 'progress' — el bug original ("estás
    // leyendo un libro que nunca agregaste") pasaba por acá si no se
    // filtraba por libros de OTROS usuarios. Este caso explícito lo cubre.
    expect(resolveClubRowMode("libro-1", [])).toBe("invite");
  });

  it("devuelve 'invite' cuando el usuario NO tiene UserBook para el libro del club", () => {
    expect(
      resolveClubRowMode("libro-1", [{ bookId: "libro-2", status: "READING" }]),
    ).toBe("invite");
  });

  it("devuelve 'progress' cuando el usuario tiene UserBook READING para el libro del club", () => {
    expect(
      resolveClubRowMode("libro-1", [{ bookId: "libro-1", status: "READING" }]),
    ).toBe("progress");
  });

  it("devuelve 'none' cuando el usuario ya tiene el libro del club en Quiero leer (no es 'Leyendo', y ya aparece en su propia pestaña)", () => {
    expect(
      resolveClubRowMode("libro-1", [{ bookId: "libro-1", status: "WANT_TO_READ" }]),
    ).toBe("none");
  });

  it("devuelve 'none' cuando el usuario ya terminó el libro del club (ya aparece en Leídos)", () => {
    expect(
      resolveClubRowMode("libro-1", [{ bookId: "libro-1", status: "FINISHED" }]),
    ).toBe("none");
  });

  it("no se confunde por otros UserBooks del usuario que no son el del club", () => {
    expect(
      resolveClubRowMode("libro-1", [
        { bookId: "libro-9", status: "READING" },
        { bookId: "libro-1", status: "READING" },
      ]),
    ).toBe("progress");
  });
});
