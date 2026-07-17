import { describe, it, expect } from "vitest";

import { shouldSuppressHeroNudge } from "./hero-nudge";

describe("shouldSuppressHeroNudge", () => {
  it("suprime 'bienvenida' cuando el héroe está en 'sin-empezar' (la card héroe ya ofrece 'Lo voy a leer' para el mismo libro)", () => {
    expect(
      shouldSuppressHeroNudge({ heroEstado: "sin-empezar", nudgeKey: "bienvenida" }),
    ).toBe(true);
  });

  it("NO suprime 'bienvenida' cuando el héroe está en 'sin-libro' (la héroe no ofrece ninguna acción para invitar)", () => {
    expect(
      shouldSuppressHeroNudge({ heroEstado: "sin-libro", nudgeKey: "bienvenida" }),
    ).toBe(false);
  });

  it("NO suprime 'bienvenida' cuando el héroe ya está 'leyendo' (caso raro, pero el nudge no repite nada en ese estado)", () => {
    expect(
      shouldSuppressHeroNudge({ heroEstado: "leyendo", nudgeKey: "bienvenida" }),
    ).toBe(false);
  });

  it("NO suprime otras keys aunque el héroe esté en 'sin-empezar' (solo 'bienvenida' duplica la acción de la héroe)", () => {
    expect(
      shouldSuppressHeroNudge({ heroEstado: "sin-empezar", nudgeKey: "sugerir" }),
    ).toBe(false);
  });
});
