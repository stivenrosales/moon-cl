import { describe, expect, it, vi } from "vitest";
import { buildUrgency, loadUrgency, type UrgencyClient } from "@/server/services/urgency-queue";

const NOW = new Date("2026-07-16T12:00:00Z");

describe("buildUrgency", () => {
  it("prioriza por fecha límite más cercana: la reunión de mañana va antes que la ronda que cierra en 3 días", () => {
    const result = buildUrgency({
      now: NOW,
      openRound: { id: "r1", endsAt: new Date("2026-07-19T12:00:00Z") },
      nextMeeting: { id: "m1", startsAt: new Date("2026-07-17T12:00:00Z") },
    });

    expect(result.slots.map((s) => s.tipo)).toEqual(["reunion", "ronda"]);
  });

  it("respeta el orden aunque los candidatos lleguen invertidos (ronda más cercana que la reunión)", () => {
    const result = buildUrgency({
      now: NOW,
      openRound: { id: "r1", endsAt: new Date("2026-07-17T12:00:00Z") },
      nextMeeting: { id: "m1", startsAt: new Date("2026-07-19T12:00:00Z") },
    });

    expect(result.slots.map((s) => s.tipo)).toEqual(["ronda", "reunion"]);
  });

  it("nunca devuelve más de 2 slots aunque haya más candidatos con fecha", () => {
    const result = buildUrgency({
      now: NOW,
      openRound: { id: "r1", endsAt: new Date("2026-07-17T12:00:00Z") },
      nextMeeting: { id: "m1", startsAt: new Date("2026-07-18T12:00:00Z") },
    });

    expect(result.slots.length).toBeLessThanOrEqual(2);
    expect(result.slots).toHaveLength(2);
  });

  it("un resultado de trivia reciente no compite por slot: no desplaza a la ronda ni a la reunión", () => {
    const result = buildUrgency({
      now: NOW,
      openRound: { id: "r1", endsAt: new Date("2026-07-19T12:00:00Z") },
      nextMeeting: { id: "m1", startsAt: new Date("2026-07-17T12:00:00Z") },
      triviaResult: { activityId: "k1", playedAt: new Date("2026-07-16T00:00:00Z") }, // hace 12h
    });

    expect(result.slots).toHaveLength(2);
    expect(result.slots.map((s) => s.tipo)).toEqual(["reunion", "ronda"]);
    expect(result.franja).toBeDefined();
    expect(result.franja?.activityId).toBe("k1");
  });

  it("la trivia dentro de la ventana de 48h produce franja con su fecha de expiración (playedAt + 48h)", () => {
    const playedAt = new Date("2026-07-15T13:00:00Z"); // hace 23h respecto a NOW
    const result = buildUrgency({ now: NOW, triviaResult: { activityId: "k1", playedAt } });

    expect(result.franja).toEqual({
      tipo: "trivia",
      activityId: "k1",
      playedAt,
      expiresAt: new Date("2026-07-17T13:00:00Z"),
    });
  });

  it("la trivia fuera de la ventana de 48h (más vieja) NO produce franja", () => {
    const playedAt = new Date("2026-07-14T00:00:00Z"); // hace 60h respecto a NOW
    const result = buildUrgency({ now: NOW, triviaResult: { activityId: "k1", playedAt } });

    expect(result.franja).toBeUndefined();
  });

  it("exactamente en el borde de 48h ya NO produce franja (ventana [playedAt, playedAt+48h))", () => {
    const playedAt = new Date(NOW.getTime() - 48 * 60 * 60 * 1000);
    const result = buildUrgency({ now: NOW, triviaResult: { activityId: "k1", playedAt } });

    expect(result.franja).toBeUndefined();
  });

  it("sin ronda abierta, sin reunión próxima y sin trivia reciente: devuelve un slot de reposo con recomendación de 'Quiero leer'", () => {
    const result = buildUrgency({
      now: NOW,
      wantToReadBook: { id: "b1", title: "Cien años de soledad" },
    });

    expect(result.slots).toEqual([
      { tipo: "reposo", libro: { id: "b1", title: "Cien años de soledad" } },
    ]);
    expect(result.franja).toBeUndefined();
  });

  it("el reposo también aparece si no hay libro en 'Quiero leer' (libro: null, nunca vacío)", () => {
    const result = buildUrgency({ now: NOW });

    expect(result.slots).toEqual([{ tipo: "reposo", libro: null }]);
  });

  it("la franja de trivia puede coexistir con el reposo cuando no hay ronda ni reunión", () => {
    const result = buildUrgency({
      now: NOW,
      triviaResult: { activityId: "k1", playedAt: new Date("2026-07-16T00:00:00Z") },
      wantToReadBook: { id: "b1", title: "Rayuela" },
    });

    expect(result.slots).toEqual([{ tipo: "reposo", libro: { id: "b1", title: "Rayuela" } }]);
    expect(result.franja?.activityId).toBe("k1");
  });
});

function createFakeClient(overrides: {
  roundFindFirst?: ReturnType<typeof vi.fn>;
  meetingFindFirst?: ReturnType<typeof vi.fn>;
  kahootScoreFindFirst?: ReturnType<typeof vi.fn>;
  userBookFindFirst?: ReturnType<typeof vi.fn>;
} = {}): UrgencyClient {
  return {
    round: { findFirst: overrides.roundFindFirst ?? vi.fn().mockResolvedValue(null) },
    meeting: { findFirst: overrides.meetingFindFirst ?? vi.fn().mockResolvedValue(null) },
    kahootScore: { findFirst: overrides.kahootScoreFindFirst ?? vi.fn().mockResolvedValue(null) },
    userBook: { findFirst: overrides.userBookFindFirst ?? vi.fn().mockResolvedValue(null) },
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
  } as any;
}

describe("loadUrgency", () => {
  it("mapea la ronda OPEN más próxima a cerrar, la próxima reunión y delega en buildUrgency", async () => {
    const roundFindFirst = vi.fn().mockResolvedValue({ id: "r1", endsAt: new Date("2026-07-19T12:00:00Z") });
    const meetingFindFirst = vi.fn().mockResolvedValue({ id: "m1", startsAt: new Date("2026-07-17T12:00:00Z") });
    const client = createFakeClient({ roundFindFirst, meetingFindFirst });

    const result = await loadUrgency("u1", client, NOW);

    expect(roundFindFirst).toHaveBeenCalledWith({
      where: { status: "OPEN" },
      orderBy: { endsAt: "asc" },
      select: { id: true, endsAt: true },
    });
    expect(meetingFindFirst).toHaveBeenCalledWith({
      where: { startsAt: { gte: NOW } },
      orderBy: { startsAt: "asc" },
      select: { id: true, startsAt: true },
    });
    expect(result.slots.map((s) => s.tipo)).toEqual(["reunion", "ronda"]);
  });

  it("mapea el último KahootScore del usuario (por playedAt de su actividad) a triviaResult", async () => {
    const kahootScoreFindFirst = vi.fn().mockResolvedValue({
      activityId: "k1",
      activity: { playedAt: new Date("2026-07-16T00:00:00Z") },
    });
    const client = createFakeClient({ kahootScoreFindFirst });

    const result = await loadUrgency("u1", client, NOW);

    expect(kahootScoreFindFirst).toHaveBeenCalledWith({
      where: { userId: "u1" },
      orderBy: { activity: { playedAt: "desc" } },
      select: { activityId: true, activity: { select: { playedAt: true } } },
    });
    expect(result.franja?.activityId).toBe("k1");
  });

  it("mapea el libro más reciente de la estantería 'Quiero leer' (WANT_TO_READ) para el reposo", async () => {
    const userBookFindFirst = vi.fn().mockResolvedValue({ book: { id: "b1", title: "Rayuela" } });
    const client = createFakeClient({ userBookFindFirst });

    const result = await loadUrgency("u1", client, NOW);

    expect(userBookFindFirst).toHaveBeenCalledWith({
      where: { userId: "u1", status: "WANT_TO_READ" },
      orderBy: { createdAt: "desc" },
      select: { book: { select: { id: true, title: true } } },
    });
    expect(result.slots).toEqual([{ tipo: "reposo", libro: { id: "b1", title: "Rayuela" } }]);
  });
});
