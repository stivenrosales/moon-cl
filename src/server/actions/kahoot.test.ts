import { beforeEach, describe, expect, it, vi } from "vitest";

const createMock = vi.fn();
const createManyMock = vi.fn();
const deleteMock = vi.fn();
const upsertMock = vi.fn();
const transactionMock = vi.fn();
const requireModeratorMock = vi.fn();
const requireAdminMock = vi.fn();
const revalidatePathMock = vi.fn();

vi.mock("@/lib/db", () => ({
  db: {
    $transaction: (...args: unknown[]) => transactionMock(...args),
    kahootActivity: {
      delete: (...args: unknown[]) => deleteMock(...args),
    },
    kahootScore: {
      upsert: (...args: unknown[]) => upsertMock(...args),
    },
  },
}));

vi.mock("@/server/auth-helpers", () => ({
  requireModerator: (...args: unknown[]) => requireModeratorMock(...args),
  requireAdmin: (...args: unknown[]) => requireAdminMock(...args),
}));

vi.mock("next/cache", () => ({
  revalidatePath: (...args: unknown[]) => revalidatePathMock(...args),
}));

import {
  createKahootActivity,
  deleteKahootActivity,
  updateKahootScore,
} from "@/server/actions/kahoot";

const MODERATOR = { id: "mod-1", role: "MODERATOR" };
const ADMIN = { id: "admin-1", role: "ADMIN" };
const VALID_ID = "cluid1234567890abcdefghi";

beforeEach(() => {
  createMock.mockReset();
  createManyMock.mockReset();
  deleteMock.mockReset();
  upsertMock.mockReset();
  transactionMock.mockReset();
  requireModeratorMock.mockReset();
  requireAdminMock.mockReset();
  revalidatePathMock.mockReset();

  requireModeratorMock.mockResolvedValue(MODERATOR);
  requireAdminMock.mockResolvedValue(ADMIN);

  transactionMock.mockImplementation(async (cb: (tx: unknown) => unknown) =>
    cb({
      kahootActivity: { create: createMock },
      kahootScore: { createMany: createManyMock },
    }),
  );
});

describe("createKahootActivity", () => {
  it("permite a un moderador crear la actividad (no exige admin)", async () => {
    createMock.mockResolvedValue({ id: "activity-1" });

    await createKahootActivity({
      title: "Trivia de Rayuela",
      playedAt: new Date("2026-07-01"),
    });

    expect(requireModeratorMock).toHaveBeenCalled();
    expect(requireAdminMock).not.toHaveBeenCalled();
  });

  it("crea la actividad con el creatorId del moderador", async () => {
    createMock.mockResolvedValue({ id: "activity-1" });

    await createKahootActivity({
      title: "Trivia de Rayuela",
      playedAt: new Date("2026-07-01"),
    });

    expect(createMock).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          title: "Trivia de Rayuela",
          creatorId: "mod-1",
        }),
      }),
    );
  });

  it("no llama createMany cuando no vienen puntajes", async () => {
    createMock.mockResolvedValue({ id: "activity-1" });

    await createKahootActivity({
      title: "Trivia de Rayuela",
      playedAt: new Date("2026-07-01"),
    });

    expect(createManyMock).not.toHaveBeenCalled();
  });

  it("crea los puntajes junto con la actividad dentro de la misma transacción", async () => {
    createMock.mockResolvedValue({ id: "activity-2" });

    await createKahootActivity({
      title: "Trivia de Rayuela",
      playedAt: new Date("2026-07-01"),
      scores: [
        { userId: "user-1", points: 100 },
        { userId: "user-2", points: 80, correctAnswers: 4 },
      ],
    });

    expect(transactionMock).toHaveBeenCalledTimes(1);
    expect(createManyMock).toHaveBeenCalledWith({
      data: [
        { activityId: "activity-2", userId: "user-1", points: 100, correctAnswers: null },
        { activityId: "activity-2", userId: "user-2", points: 80, correctAnswers: 4 },
      ],
    });
  });

  it("rechaza cuando falta el título", async () => {
    await expect(
      createKahootActivity({ playedAt: new Date("2026-07-01") }),
    ).rejects.toThrow();
    expect(createMock).not.toHaveBeenCalled();
  });

  it("rechaza un título de un solo carácter", async () => {
    await expect(
      createKahootActivity({ title: "A", playedAt: new Date("2026-07-01") }),
    ).rejects.toThrow();
  });

  it("revalida /agenda y /admin", async () => {
    createMock.mockResolvedValue({ id: "activity-1" });

    await createKahootActivity({
      title: "Trivia de Rayuela",
      playedAt: new Date("2026-07-01"),
    });

    expect(revalidatePathMock).toHaveBeenCalledWith("/agenda");
    expect(revalidatePathMock).toHaveBeenCalledWith("/admin");
  });
});

describe("updateKahootScore", () => {
  it("permite a un moderador hacer upsert del puntaje (patrón role-select)", async () => {
    upsertMock.mockResolvedValue({ id: "score-1" });

    await updateKahootScore(VALID_ID, { userId: "user-1", points: 90 });

    expect(requireModeratorMock).toHaveBeenCalled();
    expect(upsertMock).toHaveBeenCalledWith({
      where: { activityId_userId: { activityId: VALID_ID, userId: "user-1" } },
      create: {
        activityId: VALID_ID,
        userId: "user-1",
        points: 90,
        correctAnswers: null,
      },
      update: { points: 90, correctAnswers: null },
    });
  });

  it("acepta correctAnswers opcional", async () => {
    upsertMock.mockResolvedValue({ id: "score-1" });

    await updateKahootScore(VALID_ID, { userId: "user-1", points: 90, correctAnswers: 8 });

    expect(upsertMock).toHaveBeenCalledWith(
      expect.objectContaining({
        create: expect.objectContaining({ correctAnswers: 8 }),
        update: expect.objectContaining({ correctAnswers: 8 }),
      }),
    );
  });

  it("rechaza puntos negativos", async () => {
    await expect(
      updateKahootScore(VALID_ID, { userId: "user-1", points: -5 }),
    ).rejects.toThrow();
    expect(upsertMock).not.toHaveBeenCalled();
  });

  it("rechaza un activityId que no es un cuid válido", async () => {
    await expect(
      updateKahootScore("no-es-un-cuid", { userId: "user-1", points: 10 }),
    ).rejects.toThrow();
    expect(upsertMock).not.toHaveBeenCalled();
  });
});

describe("deleteKahootActivity", () => {
  it("exige admin (no alcanza con moderador)", async () => {
    deleteMock.mockResolvedValue({ id: VALID_ID });

    await deleteKahootActivity(VALID_ID);

    expect(requireAdminMock).toHaveBeenCalled();
  });

  it("borra la actividad por id", async () => {
    deleteMock.mockResolvedValue({ id: VALID_ID });

    await deleteKahootActivity(VALID_ID);

    expect(deleteMock).toHaveBeenCalledWith({ where: { id: VALID_ID } });
  });

  it("revalida /agenda y /admin", async () => {
    deleteMock.mockResolvedValue({ id: VALID_ID });

    await deleteKahootActivity(VALID_ID);

    expect(revalidatePathMock).toHaveBeenCalledWith("/agenda");
    expect(revalidatePathMock).toHaveBeenCalledWith("/admin");
  });

  it("rechaza un id que no es un cuid válido", async () => {
    await expect(deleteKahootActivity("no-es-un-cuid")).rejects.toThrow();
    expect(deleteMock).not.toHaveBeenCalled();
  });
});
