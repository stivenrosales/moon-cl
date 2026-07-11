// TZ fija para que "Hoy"/"Ayer" y el cálculo de día local sean
// deterministas sin importar la zona horaria de la máquina que corre los
// tests (dayLabel/groupMessagesByDay usan Date en hora LOCAL a propósito,
// ver comentario en message-thread.ts).
process.env.TZ = "UTC";

import { describe, expect, it } from "vitest";
import { dayLabel, groupMessagesByDay } from "@/lib/message-thread";

const NOW = new Date("2026-07-10T18:00:00.000Z");

describe("dayLabel", () => {
  it('devuelve "Hoy" para la misma fecha que `now`', () => {
    expect(dayLabel(new Date("2026-07-10T09:00:00.000Z"), NOW)).toBe("Hoy");
  });

  it('devuelve "Ayer" para el día calendario anterior', () => {
    expect(dayLabel(new Date("2026-07-09T23:00:00.000Z"), NOW)).toBe("Ayer");
  });

  it("devuelve la fecha corta sin año cuando es del año actual", () => {
    expect(dayLabel(new Date("2026-01-05T12:00:00.000Z"), NOW)).toBe("5 de enero");
  });

  it("incluye el año cuando la fecha es de un año distinto al actual", () => {
    expect(dayLabel(new Date("2025-12-24T12:00:00.000Z"), NOW)).toBe("24 de diciembre de 2025");
  });
});

describe("groupMessagesByDay", () => {
  function msg(id: string, createdAt: string) {
    return { id, createdAt: new Date(createdAt) };
  }

  it("agrupa mensajes consecutivos del mismo día en un solo bloque", () => {
    const messages = [
      msg("m1", "2026-07-10T09:00:00.000Z"),
      msg("m2", "2026-07-10T10:00:00.000Z"),
      msg("m3", "2026-07-10T11:00:00.000Z"),
    ];

    const groups = groupMessagesByDay(messages, NOW);

    expect(groups).toHaveLength(1);
    expect(groups[0].label).toBe("Hoy");
    expect(groups[0].messages).toHaveLength(3);
  });

  it("crea un nuevo bloque cuando cambia el día", () => {
    const messages = [
      msg("m1", "2026-07-09T09:00:00.000Z"),
      msg("m2", "2026-07-10T09:00:00.000Z"),
    ];

    const groups = groupMessagesByDay(messages, NOW);

    expect(groups.map((g) => g.label)).toEqual(["Ayer", "Hoy"]);
    expect(groups[0].messages.map((m) => m.id)).toEqual(["m1"]);
    expect(groups[1].messages.map((m) => m.id)).toEqual(["m2"]);
  });

  it("acepta createdAt como string ISO", () => {
    const messages = [{ id: "m1", createdAt: "2026-07-10T09:00:00.000Z" }];

    const groups = groupMessagesByDay(messages, NOW);

    expect(groups[0].label).toBe("Hoy");
  });

  it("retorna una lista vacía cuando no hay mensajes", () => {
    expect(groupMessagesByDay([], NOW)).toEqual([]);
  });

  it("abre un bloque nuevo por cada cambio de etiqueta, sin re-fusionar uno ya cerrado", () => {
    const messages = [
      msg("m1", "2026-07-10T09:00:00.000Z"),
      msg("m2", "2026-07-09T09:00:00.000Z"),
      msg("m3", "2026-07-10T11:00:00.000Z"),
    ];

    const groups = groupMessagesByDay(messages, NOW);

    expect(groups.map((g) => g.label)).toEqual(["Hoy", "Ayer", "Hoy"]);
  });
});
