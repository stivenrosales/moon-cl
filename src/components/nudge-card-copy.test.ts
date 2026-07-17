import { describe, expect, it } from "vitest";
import { resolveNudgeAction, resolveNudgeCopy } from "@/components/nudge-card-copy";
import { routes } from "@/lib/routes";

describe("resolveNudgeCopy", () => {
  it("bienvenida interpola el libro del club y usa hand-script cuando hay libroId", () => {
    const copy = resolveNudgeCopy("bienvenida", { libro: "Cien años de soledad", libroId: "book-1" });
    expect(copy).toEqual({
      kicker: "BIENVENIDA AL CLUB",
      title: "Empieza por un libro",
      titleScript: true,
      body: "El club está leyendo Cien años de soledad. Ponlo en tu estantería y te vamos siguiendo el paso.",
      cta: "Lo voy a leer",
    });
  });

  it("bienvenida sin libroId NO promete 'Lo voy a leer' (no hay UserBook que crear): cae a un CTA honesto", () => {
    // Bug 1: si el CTA promete start-reading sin libroId, nudge-card.tsx marca
    // éxito y actedAt sin haber creado ningún UserBook. El copy no puede
    // ofrecer esa acción cuando no hay libro resuelto.
    const copy = resolveNudgeCopy("bienvenida");
    expect(copy.cta).not.toBe("Lo voy a leer");
    expect(copy.cta).toBe("Ver el club");
    expect(copy.body).not.toContain("Ponlo en tu estantería");
  });

  it("bienvenida con título de libro pero sin libroId también cae al CTA honesto (el id es lo que importa, no el título)", () => {
    const copy = resolveNudgeCopy("bienvenida", { libro: "Cien años de soledad" });
    expect(copy.cta).toBe("Ver el club");
  });

  it("primer-progreso no depende de contexto", () => {
    expect(resolveNudgeCopy("primer-progreso")).toEqual({
      kicker: "UN NÚMERO Y YA",
      title: "Cuéntanos por dónde vas",
      titleScript: false,
      body: "La página y el capítulo son lo que mueve todo: tu barra, tu racha, y las salas del foro que se te abren.",
      cta: "Marcar mi avance",
    });
  });

  it("primer-rating usa hand-script y no depende de contexto para el copy", () => {
    const copy = resolveNudgeCopy("primer-rating");
    expect(copy.titleScript).toBe(true);
    expect(copy.title).toBe("¿Qué te pareció?");
    expect(copy.cta).toBe("Calificarlo");
  });

  it("book-match no depende de contexto", () => {
    const copy = resolveNudgeCopy("book-match");
    expect(copy.kicker).toBe("YA SABEMOS QUÉ TE GUSTA");
    expect(copy.cta).toBe("Activar Book Match");
  });

  it("primer-mensaje interpola persona y libro en común", () => {
    const copy = resolveNudgeCopy("primer-mensaje", {
      persona: "Camila",
      libroEnComun: "Rayuela",
    });
    expect(copy.title).toBe("Escríbele a Camila");
    expect(copy.body).toBe("Los dos leyeron Rayuela. Eso ya es tema de conversación.");
  });

  it("primer-mensaje cae a fallback genérico sin contexto", () => {
    const copy = resolveNudgeCopy("primer-mensaje");
    expect(copy.title).toBe("Escríbele a esa persona");
    expect(copy.body).toBe("Los dos leyeron el mismo libro. Eso ya es tema de conversación.");
  });

  it("sugerir no tiene kicker ni título — va inline", () => {
    const copy = resolveNudgeCopy("sugerir");
    expect(copy.kicker).toBeNull();
    expect(copy.title).toBeNull();
    expect(copy.body).toBe("Todavía no sugieres nada. Un libro tuyo puede terminar en la mesa de todos.");
    expect(copy.cta).toBe("Sugerir un libro");
  });
});

describe("resolveNudgeAction", () => {
  it("bienvenida crea el UserBook inline (no navega)", () => {
    expect(resolveNudgeAction("bienvenida", { libroId: "book-1" })).toEqual({
      type: "start-reading",
      libroId: "book-1",
    });
  });

  it("bienvenida sin libroId no puede prometer start-reading: navega a /leer?vista=club en su lugar", () => {
    // Bug 1: sin libroId no hay UserBook que crear. resolveNudgeAction jamás
    // debe devolver start-reading sin un id real.
    expect(resolveNudgeAction("bienvenida")).toEqual({
      type: "navigate",
      href: routes.leer({ vista: "club" }),
    });
  });

  it("primer-progreso navega a /hoy", () => {
    expect(resolveNudgeAction("primer-progreso")).toEqual({
      type: "navigate",
      href: routes.hoy(),
    });
  });

  it("primer-rating navega al libro terminado cuando hay id", () => {
    expect(resolveNudgeAction("primer-rating", { libroTerminadoId: "book-2" })).toEqual({
      type: "navigate",
      href: routes.libro("book-2"),
    });
  });

  it("primer-rating cae a /leer si no hay libro resuelto", () => {
    expect(resolveNudgeAction("primer-rating")).toEqual({
      type: "navigate",
      href: routes.leer(),
    });
  });

  it("book-match activa el opt-in inline (no navega)", () => {
    expect(resolveNudgeAction("book-match")).toEqual({ type: "toggle-match" });
  });

  it("primer-mensaje navega al chat con la persona cuando hay id", () => {
    expect(resolveNudgeAction("primer-mensaje", { personaId: "user-9" })).toEqual({
      type: "navigate",
      href: routes.mensajeCon("user-9"),
    });
  });

  it("primer-mensaje cae a /club?vista=personas sin id", () => {
    expect(resolveNudgeAction("primer-mensaje")).toEqual({
      type: "navigate",
      href: routes.club({ vista: "personas" }),
    });
  });

  it("sugerir navega a la ronda abierta cuando hay id", () => {
    expect(resolveNudgeAction("sugerir", { roundId: "round-1" })).toEqual({
      type: "navigate",
      href: routes.ronda("round-1"),
    });
  });

  it("sugerir cae a /agenda?vista=votaciones sin ronda resuelta", () => {
    expect(resolveNudgeAction("sugerir")).toEqual({
      type: "navigate",
      href: routes.agenda({ vista: "votaciones" }),
    });
  });
});
