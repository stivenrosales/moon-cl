import { describe, it, expect } from "vitest";

import { resolverAvanceCopy } from "./reading-progress-copy";

describe("resolverAvanceCopy", () => {
  it("devuelve 'sin-marcar' cuando miPagina es null (nunca marcó avance)", () => {
    const resultado = resolverAvanceCopy(null);
    expect(resultado.tipo).toBe("sin-marcar");
    if (resultado.tipo !== "sin-marcar") throw new Error("tipo inesperado");
    expect(resultado.texto).toBe("Aún no has marcado tu avance.");
  });

  it("devuelve 'arranque' cuando miPagina es 0 (marcó avance real en la página 0)", () => {
    // Bug original: 0 es falsy en JS, así que `hero.miPagina ? ... : ...`
    // colapsaba este caso con el de null y mostraba el mismo copy de "nunca
    // marcó nada" para alguien que SÍ guardó su avance.
    const resultado = resolverAvanceCopy(0);
    expect(resultado.tipo).toBe("arranque");
    if (resultado.tipo !== "arranque") throw new Error("tipo inesperado");
    expect(resultado.texto).not.toBe("Aún no has marcado tu avance.");
  });

  it("el copy de arranque no suena a error ni repite el texto de 'sin-marcar'", () => {
    const resultado = resolverAvanceCopy(0);
    if (resultado.tipo !== "arranque") throw new Error("tipo inesperado");
    expect(resultado.texto.toLowerCase()).not.toContain("aún no has marcado");
  });

  it("devuelve 'con-progreso' (sin texto propio) cuando miPagina es mayor a 0", () => {
    const resultado = resolverAvanceCopy(120);
    expect(resultado.tipo).toBe("con-progreso");
  });

  it("devuelve 'con-progreso' para cualquier página positiva, no solo un caso puntual", () => {
    expect(resolverAvanceCopy(1).tipo).toBe("con-progreso");
    expect(resolverAvanceCopy(9999).tipo).toBe("con-progreso");
  });
});
