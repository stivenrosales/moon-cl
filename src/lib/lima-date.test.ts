import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { fechaDiscretaLima, inicioDeAnioLima, limaYear } from "@/lib/lima-date";

// El contenedor de producción corre en UTC (ningún Dockerfile/compose/workflow
// fija TZ) y el CI corre igual. Fijamos TZ=UTC a propósito en cada test para
// reproducir ese entorno real — con TZ=America/Lima en la máquina local el
// bug original (Intl sin timeZone) queda invisible.
function conTZ(tz: string, fn: () => void) {
  const original = process.env.TZ;
  beforeEach(() => {
    process.env.TZ = tz;
  });
  afterEach(() => {
    process.env.TZ = original;
  });
  fn();
}

describe("fechaDiscretaLima", () => {
  conTZ("UTC", () => {
    it("a las 20:00 hora Lima muestra el día de HOY en Lima, no el de mañana en UTC", () => {
      // 2026-07-13 es lunes (mismo ancla que book-match.test.ts). 01:00 UTC
      // del 13 de julio es 20:00 del 12 de julio en Lima (domingo) — la
      // ventana exacta (19:00–23:59 hora Lima) donde /hoy mostraba "mañana".
      const date = new Date("2026-07-13T01:00:00.000Z");
      expect(fechaDiscretaLima(date)).toBe("Domingo 12 de julio · 20:00");
    });

    it("fuera de la ventana del bug (media mañana en Lima) coincide con el día real", () => {
      const date = new Date("2026-07-13T15:00:00.000Z"); // 10:00 Lima, mismo día
      expect(fechaDiscretaLima(date)).toBe("Lunes 13 de julio · 10:00");
    });
  });
});

describe("limaYear", () => {
  conTZ("UTC", () => {
    it("31 de diciembre a las 20:00 hora Lima todavía es el año que termina, no el que empieza", () => {
      // 20:00 Lima del 31 dic 2026 = 01:00 UTC del 1 ene 2027 — la ventana
      // donde getFullYear() sin timeZone ya "vio" el año nuevo en UTC.
      const date = new Date("2027-01-01T01:00:00.000Z");
      expect(limaYear(date)).toBe(2026);
    });

    it("en horario que no cruza medianoche UTC, el año coincide con el de UTC", () => {
      const date = new Date("2026-06-15T15:00:00.000Z");
      expect(limaYear(date)).toBe(2026);
    });
  });
});

describe("inicioDeAnioLima", () => {
  conTZ("UTC", () => {
    it("devuelve la medianoche del 1 de enero EN LIMA (05:00 UTC), no en UTC", () => {
      // Mismo instante que el caso límite de limaYear: 31 dic 20:00 Lima.
      const date = new Date("2027-01-01T01:00:00.000Z");
      expect(inicioDeAnioLima(date).toISOString()).toBe("2026-01-01T05:00:00.000Z");
    });

    it("en horario normal, el corte cae en el 1 de enero del año en curso", () => {
      const date = new Date("2026-06-15T15:00:00.000Z");
      expect(inicioDeAnioLima(date).toISOString()).toBe("2026-01-01T05:00:00.000Z");
    });
  });
});
