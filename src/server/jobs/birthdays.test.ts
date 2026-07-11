import { beforeEach, describe, expect, it, vi } from "vitest";

const findManyMock = vi.fn();

vi.mock("@/lib/db", () => ({
  db: {
    user: {
      findMany: (...args: unknown[]) => findManyMock(...args),
    },
  },
}));

const { emailsSendMock, ResendMock } = vi.hoisted(() => {
  const emailsSendMock = vi.fn().mockResolvedValue({ data: { id: "e1" }, error: null });
  const ResendMock = vi.fn().mockImplementation(function Resend() {
    return { emails: { send: emailsSendMock } };
  });
  return { emailsSendMock, ResendMock };
});

vi.mock("resend", () => ({ Resend: ResendMock }));

vi.mock("@/lib/email", () => ({
  buildBirthdayHtml: vi.fn().mockReturnValue("<html></html>"),
  buildBirthdayText: vi.fn().mockReturnValue("texto"),
}));

import { isBirthdayToday, limaDayMonth, sendBirthdayGreetings } from "@/server/jobs/birthdays";

describe("limaDayMonth (día/mes en America/Lima, UTC-5 sin horario de verano)", () => {
  it("un instante a las 05:00 UTC es medianoche en Lima: el día ya cambió", () => {
    // 2026-07-10T05:00:00Z - 5h = 2026-07-10T00:00:00 hora Lima
    const result = limaDayMonth(new Date("2026-07-10T05:00:00.000Z"));
    expect(result).toEqual({ day: 10, month: 7 });
  });

  it("un instante a las 04:30 UTC todavía es el día anterior en Lima (cuidado con UTC)", () => {
    // 2026-07-10T04:30:00Z - 5h = 2026-07-09T23:30:00 hora Lima
    const result = limaDayMonth(new Date("2026-07-10T04:30:00.000Z"));
    expect(result).toEqual({ day: 9, month: 7 });
  });

  it("mediodía UTC es tarde en Lima del mismo día", () => {
    const result = limaDayMonth(new Date("2026-07-10T12:00:00.000Z"));
    expect(result).toEqual({ day: 10, month: 7 });
  });
});

describe("isBirthdayToday", () => {
  it("coincide cuando día y mes son iguales sin importar el año de nacimiento", () => {
    const birthday = new Date("1990-07-10T00:00:00.000Z");
    const now = new Date("2026-07-10T12:00:00.000Z");
    expect(isBirthdayToday(birthday, now)).toBe(true);
  });

  it("no coincide si el mes difiere", () => {
    const birthday = new Date("1990-08-10T00:00:00.000Z");
    const now = new Date("2026-07-10T12:00:00.000Z");
    expect(isBirthdayToday(birthday, now)).toBe(false);
  });

  it("no coincide si el día difiere", () => {
    const birthday = new Date("1990-07-11T00:00:00.000Z");
    const now = new Date("2026-07-10T12:00:00.000Z");
    expect(isBirthdayToday(birthday, now)).toBe(false);
  });

  it("respeta el corte de zona horaria de Lima cerca de medianoche UTC", () => {
    const birthday = new Date("1990-07-09T00:00:00.000Z");
    // 04:30 UTC todavía es 9 de julio en Lima
    const now = new Date("2026-07-10T04:30:00.000Z");
    expect(isBirthdayToday(birthday, now)).toBe(true);
  });
});

describe("sendBirthdayGreetings", () => {
  beforeEach(() => {
    findManyMock.mockReset();
    emailsSendMock.mockClear();
    process.env.AUTH_RESEND_KEY = "re_test_key";
  });

  it("no envía nada cuando nadie cumple años hoy", async () => {
    findManyMock.mockResolvedValue([
      { id: "u1", name: "Ana", email: "ana@example.com", birthday: new Date("1990-01-01T00:00:00.000Z") },
    ]);

    const result = await sendBirthdayGreetings(new Date("2026-07-10T12:00:00.000Z"));

    expect(result).toEqual({ celebrants: 0, sent: 0 });
    expect(emailsSendMock).not.toHaveBeenCalled();
  });

  it("envía saludo privado solo al cumpleañero, no al resto del club", async () => {
    findManyMock.mockResolvedValue([
      { id: "u1", name: "Ana", email: "ana@example.com", birthday: new Date("1990-07-10T00:00:00.000Z") },
      { id: "u2", name: "Beto", email: "beto@example.com", birthday: new Date("1990-09-01T00:00:00.000Z") },
    ]);

    const result = await sendBirthdayGreetings(new Date("2026-07-10T12:00:00.000Z"));

    expect(result).toEqual({ celebrants: 1, sent: 1 });
    expect(emailsSendMock).toHaveBeenCalledTimes(1);
    expect(emailsSendMock).toHaveBeenCalledWith(
      expect.objectContaining({ to: "ana@example.com" }),
    );
  });

  it("usa new Date() por defecto cuando no se pasa 'now'", async () => {
    findManyMock.mockResolvedValue([]);

    await sendBirthdayGreetings();

    expect(findManyMock).toHaveBeenCalledWith(
      expect.objectContaining({ where: { birthday: { not: null } } }),
    );
  });
});
