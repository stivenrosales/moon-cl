import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { formatDate, formatDateTime, formatTime } from "@/lib/utils";

// Mismo patrón que lima-date.test.ts: producción y CI corren en UTC (ningún
// Dockerfile/compose/workflow fija TZ), así que Intl.DateTimeFormat SIN
// timeZone explícito usa el huso del proceso en vez de America/Lima — el bug
// queda invisible en una máquina local que ya tenga TZ=America/Lima seteado.
// Por eso cada caso corre bajo AMBOS husos y exige el MISMO resultado: si
// difieren, el bug sigue vivo.
function paraCadaTZ(fn: () => void) {
  for (const tz of ["America/Lima", "UTC"]) {
    describe(`con TZ=${tz}`, () => {
      const original = process.env.TZ;
      beforeEach(() => {
        process.env.TZ = tz;
      });
      afterEach(() => {
        process.env.TZ = original;
      });
      fn();
    });
  }
}

describe("formatDate", () => {
  paraCadaTZ(() => {
    it("a las 20:00 hora Lima muestra el día de HOY en Lima, no el de mañana en UTC", () => {
      // 2026-07-13 01:00 UTC es 2026-07-12 20:00 en Lima (domingo) — la
      // ventana exacta (19:00-23:59 hora Lima) donde el helper adelantaba
      // la fecha al día siguiente.
      const date = new Date("2026-07-13T01:00:00.000Z");
      expect(formatDate(date)).toBe("12 de julio de 2026");
    });

    it("fuera de la ventana del bug (media mañana en Lima) coincide con el día real", () => {
      const date = new Date("2026-07-13T15:00:00.000Z"); // 10:00 Lima, mismo día
      expect(formatDate(date)).toBe("13 de julio de 2026");
    });

    it("el cumpleaños sigue respetando timeZone UTC explícito (birthday es @db.Date, no un instante)", () => {
      // birthday llega como medianoche UTC (columna @db.Date de Prisma). Si
      // el default nuevo (Lima) pisara el override explícito, esto
      // mostraría "14 de junio" en vez del "15 de junio" real del calendario.
      const birthday = new Date("1990-06-15T00:00:00.000Z");
      expect(formatDate(birthday, { year: undefined, timeZone: "UTC" })).toBe("15 de junio");
    });
  });
});

describe("formatDateTime", () => {
  paraCadaTZ(() => {
    it("a las 20:00 hora Lima muestra el día de HOY en Lima, no el de mañana en UTC", () => {
      const date = new Date("2026-07-13T01:00:00.000Z");
      expect(formatDateTime(date)).toBe("12 jul 2026, 20:00");
    });

    it("fuera de la ventana del bug coincide con el día y la hora reales", () => {
      const date = new Date("2026-07-13T15:00:00.000Z");
      expect(formatDateTime(date)).toBe("13 jul 2026, 10:00");
    });
  });
});

describe("formatTime", () => {
  paraCadaTZ(() => {
    it("a las 20:00 hora Lima muestra 20:00, no 01:00 (la hora UTC del mismo instante)", () => {
      const date = new Date("2026-07-13T01:00:00.000Z");
      expect(formatTime(date)).toBe("20:00");
    });

    it("fuera de la ventana del bug coincide con la hora real", () => {
      const date = new Date("2026-07-13T15:00:00.000Z"); // 10:00 Lima
      expect(formatTime(date)).toBe("10:00");
    });
  });
});
