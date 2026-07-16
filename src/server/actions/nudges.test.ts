import { beforeEach, describe, expect, it, vi } from "vitest";

const upsertMock = vi.fn();
const requireUserMock = vi.fn();
const revalidatePathMock = vi.fn();

vi.mock("@/lib/db", () => ({
  db: {
    userNudge: {
      upsert: (...args: unknown[]) => upsertMock(...args),
    },
  },
}));

vi.mock("@/server/auth-helpers", () => ({
  requireUser: (...args: unknown[]) => requireUserMock(...args),
}));

vi.mock("next/cache", () => ({
  revalidatePath: (...args: unknown[]) => revalidatePathMock(...args),
}));

import { dismissNudge, markNudgeActed } from "@/server/actions/nudges";

const USER = { id: "user-1", role: "MEMBER" };

beforeEach(() => {
  upsertMock.mockReset();
  requireUserMock.mockReset();
  revalidatePathMock.mockReset();
  requireUserMock.mockResolvedValue(USER);
  upsertMock.mockResolvedValue({ id: "nudge-1" });
});

describe("dismissNudge", () => {
  it("hace upsert sobre @@unique([userId, key]) seteando dismissedAt", async () => {
    await dismissNudge("bienvenida");

    expect(upsertMock).toHaveBeenCalledWith({
      where: { userId_key: { userId: "user-1", key: "bienvenida" } },
      create: { userId: "user-1", key: "bienvenida", dismissedAt: expect.any(Date) },
      update: { dismissedAt: expect.any(Date) },
    });
  });

  it("revalida la pantalla donde vive la key descartada", async () => {
    await dismissNudge("book-match");

    expect(revalidatePathMock).toHaveBeenCalledWith("/club");
  });

  it("requiere sesión iniciada", async () => {
    requireUserMock.mockRejectedValue(new Error("Debes iniciar sesión"));

    await expect(dismissNudge("bienvenida")).rejects.toThrow("Debes iniciar sesión");
    expect(upsertMock).not.toHaveBeenCalled();
  });

  it("rechaza una key que no pertenece al catálogo de nudges", async () => {
    await expect(dismissNudge("no-existe" as never)).rejects.toThrow();
    expect(upsertMock).not.toHaveBeenCalled();
  });
});

describe("markNudgeActed", () => {
  it("hace upsert sobre @@unique([userId, key]) seteando actedAt", async () => {
    await markNudgeActed("primer-mensaje");

    expect(upsertMock).toHaveBeenCalledWith({
      where: { userId_key: { userId: "user-1", key: "primer-mensaje" } },
      create: { userId: "user-1", key: "primer-mensaje", actedAt: expect.any(Date) },
      update: { actedAt: expect.any(Date) },
    });
    expect(revalidatePathMock).toHaveBeenCalledWith("/club?vista=personas");
  });

  it("requiere sesión iniciada", async () => {
    requireUserMock.mockRejectedValue(new Error("Debes iniciar sesión"));

    await expect(markNudgeActed("bienvenida")).rejects.toThrow("Debes iniciar sesión");
    expect(upsertMock).not.toHaveBeenCalled();
  });
});
