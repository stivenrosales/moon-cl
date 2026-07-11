import { beforeEach, describe, expect, it, vi } from "vitest";

const userFindManyMock = vi.fn();
const matchFindManyMock = vi.fn();
const matchCreateMock = vi.fn();
const affinityUserFindManyMock = vi.fn();
const affinityUserBookFindManyMock = vi.fn();
const affinityRatingFindManyMock = vi.fn();

vi.mock("@/lib/db", () => ({
  db: {
    user: {
      findMany: (...args: unknown[]) => userFindManyMock(...args),
    },
    match: {
      findMany: (...args: unknown[]) => matchFindManyMock(...args),
      create: (...args: unknown[]) => matchCreateMock(...args),
    },
    userBook: {
      findMany: (...args: unknown[]) => affinityUserBookFindManyMock(...args),
    },
    rating: {
      findMany: (...args: unknown[]) => affinityRatingFindManyMock(...args),
    },
  },
}));

const { emailsSendMock, batchSendMock, ResendMock } = vi.hoisted(() => {
  const emailsSendMock = vi.fn().mockResolvedValue({ data: { id: "e1" }, error: null });
  const batchSendMock = vi.fn().mockResolvedValue({ data: { data: [] }, error: null });
  const ResendMock = vi.fn().mockImplementation(function Resend() {
    return { emails: { send: emailsSendMock }, batch: { send: batchSendMock } };
  });
  return { emailsSendMock, batchSendMock, ResendMock };
});

vi.mock("resend", () => ({ Resend: ResendMock }));

vi.mock("@/lib/email", () => ({
  buildBookMatchHtml: vi.fn().mockReturnValue("<html></html>"),
  buildBookMatchText: vi.fn().mockReturnValue("texto"),
}));

import {
  currentMatchWeekOf,
  isMondayInLima,
  pairKey,
  pairUsers,
  runBookMatch,
  type ScoredPair,
} from "@/server/jobs/book-match";

describe("isMondayInLima", () => {
  it("reconoce un lunes en hora de pared de Lima", () => {
    // 2026-07-13 es lunes. 15:00 UTC - 5h = 10:00 Lima, mismo día.
    expect(isMondayInLima(new Date("2026-07-13T15:00:00.000Z"))).toBe(true);
  });

  it("cerca de medianoche UTC el día en Lima todavía puede ser domingo", () => {
    // 2026-07-13T04:30:00Z - 5h = 2026-07-12T23:30 Lima → domingo, no lunes.
    expect(isMondayInLima(new Date("2026-07-13T04:30:00.000Z"))).toBe(false);
  });

  it("rechaza cualquier otro día de la semana", () => {
    expect(isMondayInLima(new Date("2026-07-14T15:00:00.000Z"))).toBe(false); // martes
  });
});

describe("currentMatchWeekOf", () => {
  it("si 'now' es lunes, retorna la fecha de ese mismo lunes", () => {
    const result = currentMatchWeekOf(new Date("2026-07-13T15:00:00.000Z"));
    expect(result.toISOString().slice(0, 10)).toBe("2026-07-13");
  });

  it("si 'now' es jueves, retorna el lunes de esa misma semana", () => {
    const result = currentMatchWeekOf(new Date("2026-07-16T15:00:00.000Z")); // jueves
    expect(result.toISOString().slice(0, 10)).toBe("2026-07-13");
  });

  it("si 'now' es domingo (hora Lima), retorna el lunes anterior, no el siguiente", () => {
    const result = currentMatchWeekOf(new Date("2026-07-19T15:00:00.000Z")); // domingo
    expect(result.toISOString().slice(0, 10)).toBe("2026-07-13");
  });
});

describe("pairKey", () => {
  it("normaliza el orden de los dos ids (a,b) === (b,a)", () => {
    expect(pairKey("u1", "u2")).toBe(pairKey("u2", "u1"));
  });
});

describe("pairUsers", () => {
  it("empareja greedy de mayor a menor score, sin repetir usuarios", () => {
    const scores: ScoredPair[] = [
      { userAId: "a", userBId: "b", score: 90 },
      { userAId: "a", userBId: "c", score: 80 },
      { userAId: "b", userBId: "c", score: 70 },
    ];

    const result = pairUsers(scores);

    // a-b (90) se confirma primero; a-c y b-c ya no pueden usarse (a y b tomados)
    expect(result).toEqual([{ userAId: "a", userBId: "b", score: 90 }]);
  });

  it("deja fuera al usuario impar sin forzar una pareja", () => {
    const scores: ScoredPair[] = [
      { userAId: "a", userBId: "b", score: 60 },
      { userAId: "a", userBId: "c", score: 50 },
      { userAId: "b", userBId: "c", score: 40 },
    ];

    const result = pairUsers(scores);

    expect(result).toHaveLength(1);
    expect(result[0]).toEqual({ userAId: "a", userBId: "b", score: 60 });
    // c queda sin pareja esta semana — ningún resultado lo incluye
    expect(result.some((m) => m.userAId === "c" || m.userBId === "c")).toBe(false);
  });

  it("evita repetir una pareja que ya hizo match en las últimas semanas", () => {
    const scores: ScoredPair[] = [
      { userAId: "a", userBId: "b", score: 95 },
      { userAId: "a", userBId: "c", score: 50 },
    ];
    const recentPairs = new Set([pairKey("a", "b")]);

    const result = pairUsers(scores, recentPairs);

    expect(result).toEqual([{ userAId: "a", userBId: "c", score: 50 }]);
  });

  it("retorna arreglo vacío si no hay candidatos", () => {
    expect(pairUsers([])).toEqual([]);
  });
});

describe("runBookMatch", () => {
  beforeEach(() => {
    userFindManyMock.mockReset();
    matchFindManyMock.mockReset();
    matchCreateMock.mockReset();
    affinityUserFindManyMock.mockReset();
    affinityUserBookFindManyMock.mockReset();
    affinityRatingFindManyMock.mockReset();
    emailsSendMock.mockClear();
    batchSendMock.mockClear();
    process.env.AUTH_RESEND_KEY = "re_test_key";
  });

  const MONDAY = new Date("2026-07-13T15:00:00.000Z");
  const NOT_MONDAY = new Date("2026-07-14T15:00:00.000Z");

  it("no corre ningún día que no sea lunes en America/Lima", async () => {
    const result = await runBookMatch(NOT_MONDAY);

    expect(result.skipped).toBe(true);
    expect(userFindManyMock).not.toHaveBeenCalled();
  });

  it("no empareja a nadie si hay menos de dos personas con isMatchOptIn", async () => {
    userFindManyMock.mockImplementation(async ({ where }: { where?: { isMatchOptIn?: boolean } } = {}) => {
      if (where?.isMatchOptIn) return [{ id: "a", name: "Ana", email: "ana@example.com" }];
      return [];
    });

    const result = await runBookMatch(MONDAY);

    expect(result.skipped).toBe(true);
    expect(matchCreateMock).not.toHaveBeenCalled();
  });

  it("empareja a los opt-in por afinidad, guarda el Match y envía correo a ambos", async () => {
    userFindManyMock.mockImplementation(async ({ where, select }: { where?: { isMatchOptIn?: boolean; id?: { in: string[] } }; select?: unknown } = {}) => {
      if (where?.isMatchOptIn) {
        return [
          { id: "a", name: "Ana", email: "ana@example.com" },
          { id: "b", name: "Beto", email: "beto@example.com" },
        ];
      }
      // loadAffinityData pide favoriteGenres de los mismos ids
      if (where?.id?.in) {
        return where.id.in.map((id: string) => ({ id, favoriteGenres: ["Novela"] }));
      }
      return [];
    });
    affinityUserBookFindManyMock.mockResolvedValue([
      { userId: "a", bookId: "b1" },
      { userId: "b", bookId: "b1" },
    ]);
    affinityRatingFindManyMock.mockResolvedValue([]);
    matchFindManyMock.mockResolvedValue([]); // sin parejas recientes
    matchCreateMock.mockResolvedValue({ id: "m1" });

    const result = await runBookMatch(MONDAY);

    expect(result.skipped).toBe(false);
    if (!result.skipped) {
      expect(result.matched).toBe(1);
      expect(result.emailsSent).toBe(2);
    }
    expect(matchCreateMock).toHaveBeenCalledWith({
      data: { userAId: "a", userBId: "b", weekOf: expect.any(Date), score: expect.any(Number) },
    });
    expect(batchSendMock).toHaveBeenCalledTimes(1);
    const payload = batchSendMock.mock.calls[0][0] as Array<{ to: string }>;
    expect(payload.map((p) => p.to).sort()).toEqual(["ana@example.com", "beto@example.com"]);
  });

  it("no empareja pares sin ninguna señal de afinidad (computeAffinity null)", async () => {
    userFindManyMock.mockImplementation(async ({ where }: { where?: { isMatchOptIn?: boolean; id?: { in: string[] } } } = {}) => {
      if (where?.isMatchOptIn) {
        return [
          { id: "a", name: "Ana", email: "ana@example.com" },
          { id: "b", name: "Beto", email: "beto@example.com" },
        ];
      }
      if (where?.id?.in) return where.id.in.map((id: string) => ({ id, favoriteGenres: [] }));
      return [];
    });
    affinityUserBookFindManyMock.mockResolvedValue([]); // nadie tiene libros ni géneros: sin señal
    affinityRatingFindManyMock.mockResolvedValue([]);
    matchFindManyMock.mockResolvedValue([]);

    const result = await runBookMatch(MONDAY);

    expect(result.skipped).toBe(false);
    if (!result.skipped) expect(result.matched).toBe(0);
    expect(matchCreateMock).not.toHaveBeenCalled();
    expect(emailsSendMock).not.toHaveBeenCalled();
    expect(batchSendMock).not.toHaveBeenCalled();
  });

  it("excluye parejas que ya hicieron match en las últimas 4 semanas", async () => {
    userFindManyMock.mockImplementation(async ({ where }: { where?: { isMatchOptIn?: boolean; id?: { in: string[] } } } = {}) => {
      if (where?.isMatchOptIn) {
        return [
          { id: "a", name: "Ana", email: "ana@example.com" },
          { id: "b", name: "Beto", email: "beto@example.com" },
        ];
      }
      if (where?.id?.in) return where.id.in.map((id: string) => ({ id, favoriteGenres: ["Novela"] }));
      return [];
    });
    affinityUserBookFindManyMock.mockResolvedValue([
      { userId: "a", bookId: "b1" },
      { userId: "b", bookId: "b1" },
    ]);
    affinityRatingFindManyMock.mockResolvedValue([]);
    matchFindManyMock.mockResolvedValue([{ userAId: "a", userBId: "b" }]);

    const result = await runBookMatch(MONDAY);

    expect(result.skipped).toBe(false);
    if (!result.skipped) expect(result.matched).toBe(0);
    expect(matchCreateMock).not.toHaveBeenCalled();
  });
});
