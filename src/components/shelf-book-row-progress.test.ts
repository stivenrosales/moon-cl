import { describe, it, expect } from "vitest";

import { resolverFilaProgreso } from "./shelf-book-row-progress";

describe("resolverFilaProgreso", () => {
  it("nunca marcó avance (currentPage null) no muestra 'pág. 0' ni pinta la barra", () => {
    const resultado = resolverFilaProgreso(null, null, 320);
    expect(resultado.tipo).toBe("sin-marcar");
    expect(resultado.mostrarBarra).toBe(false);
    // Bug original: `item.currentPage ?? 0` mostraba "pág. 0/320" acá aunque
    // la usuaria nunca hubiera tocado el diálogo de avance.
    expect(resultado.texto).not.toContain("pág. 0");
    expect(resultado.texto).not.toContain("0%");
  });

  it("marcó explícitamente la página 0 (portada o prólogo) muestra el detalle de página sin porcentaje", () => {
    const resultado = resolverFilaProgreso(0, null, 320);
    expect(resultado.tipo).toBe("arranque");
    expect(resultado.mostrarBarra).toBe(false);
    expect(resultado.texto).toContain("pág. 0/320");
    // Ninguna barra en 0%: no es una promesa vacía, pero tampoco se anuncia
    // un porcentaje que sugiera avance medible.
    expect(resultado.texto).not.toContain("%");
  });

  it("página 0 con capítulo marcado incluye el capítulo en el detalle de arranque", () => {
    const resultado = resolverFilaProgreso(0, 3, 320);
    expect(resultado.tipo).toBe("arranque");
    if (resultado.tipo !== "arranque") throw new Error("tipo inesperado");
    expect(resultado.texto).toContain("pág. 0/320");
    expect(resultado.texto).toContain("cap. 3");
  });

  it("página 0 sin pageCount ni capítulo cae al texto de arranque genérico", () => {
    const resultado = resolverFilaProgreso(0, null, null);
    expect(resultado.tipo).toBe("arranque");
    expect(resultado.mostrarBarra).toBe(false);
    expect(resultado.texto.length).toBeGreaterThan(0);
  });

  it("el texto de 'sin-marcar' y el de 'arranque' (página 0) nunca son iguales", () => {
    const sinMarcar = resolverFilaProgreso(null, null, null);
    const arranque = resolverFilaProgreso(0, null, null);
    expect(sinMarcar.texto).not.toBe(arranque.texto);
  });

  it("avance real calcula el porcentaje, arma el detalle de página/capítulo y pinta la barra", () => {
    const resultado = resolverFilaProgreso(45, 5, 320);
    expect(resultado.tipo).toBe("con-progreso");
    if (resultado.tipo !== "con-progreso") throw new Error("tipo inesperado");
    expect(resultado.mostrarBarra).toBe(true);
    expect(resultado.pct).toBe(14); // Math.round(45/320*100)
    expect(resultado.texto).toBe("14% · pág. 45/320 · cap. 5");
  });

  it("avance real sin pageCount igual pinta la barra y omite el detalle de página", () => {
    const resultado = resolverFilaProgreso(45, null, null);
    expect(resultado.tipo).toBe("con-progreso");
    if (resultado.tipo !== "con-progreso") throw new Error("tipo inesperado");
    expect(resultado.texto).not.toContain("pág.");
  });
});
