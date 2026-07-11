import { beforeEach, describe, expect, it, vi } from "vitest";
import { Prisma } from "@prisma/client";

const followCreateMock = vi.fn();
const followDeleteManyMock = vi.fn();
const requireUserMock = vi.fn();
const revalidatePathMock = vi.fn();

vi.mock("@/lib/db", () => ({
  db: {
    follow: {
      create: (...args: unknown[]) => followCreateMock(...args),
      deleteMany: (...args: unknown[]) => followDeleteManyMock(...args),
    },
  },
}));

vi.mock("@/server/auth-helpers", () => ({
  requireUser: (...args: unknown[]) => requireUserMock(...args),
}));

vi.mock("next/cache", () => ({
  revalidatePath: (...args: unknown[]) => revalidatePathMock(...args),
}));

import { followUser, unfollowUser } from "@/server/actions/follow";

const ME = { id: "cme111111111111111111111", role: "MEMBER" };
const OTHER_ID = "cother2222222222222222222";

function duplicateFollowError() {
  return new Prisma.PrismaClientKnownRequestError("Unique constraint failed", {
    code: "P2002",
    clientVersion: "5.22.0",
  });
}

beforeEach(() => {
  followCreateMock.mockReset();
  followDeleteManyMock.mockReset();
  requireUserMock.mockReset();
  revalidatePathMock.mockReset();
  requireUserMock.mockResolvedValue(ME);
});

describe("followUser", () => {
  it("requiere sesión iniciada", async () => {
    requireUserMock.mockRejectedValue(new Error("Debes iniciar sesión"));

    await expect(followUser(OTHER_ID)).rejects.toThrow("Debes iniciar sesión");
    expect(followCreateMock).not.toHaveBeenCalled();
  });

  it("lanza un error en español si el usuario intenta seguirse a sí mismo", async () => {
    await expect(followUser(ME.id)).rejects.toThrow("No puedes seguirte a ti mismo");
    expect(followCreateMock).not.toHaveBeenCalled();
  });

  it("crea el registro Follow y revalida /miembros y los perfiles involucrados", async () => {
    followCreateMock.mockResolvedValue({ id: "f1", followerId: ME.id, followingId: OTHER_ID });

    await followUser(OTHER_ID);

    expect(followCreateMock).toHaveBeenCalledWith({
      data: { followerId: ME.id, followingId: OTHER_ID },
    });
    expect(revalidatePathMock).toHaveBeenCalledWith("/miembros");
    expect(revalidatePathMock).toHaveBeenCalledWith(`/perfil/${OTHER_ID}`);
    expect(revalidatePathMock).toHaveBeenCalledWith("/perfil");
  });

  it("es idempotente: si ya sigue al usuario (choque con @@unique / P2002) no lanza error", async () => {
    followCreateMock.mockRejectedValue(duplicateFollowError());

    await expect(followUser(OTHER_ID)).resolves.toBeUndefined();
    expect(revalidatePathMock).toHaveBeenCalledWith("/miembros");
  });

  it("relanza errores de Prisma que no son de duplicado", async () => {
    const other = new Prisma.PrismaClientKnownRequestError("Foreign key failed", {
      code: "P2003",
      clientVersion: "5.22.0",
    });
    followCreateMock.mockRejectedValue(other);

    await expect(followUser(OTHER_ID)).rejects.toBe(other);
  });

  it("rechaza un id que no es un cuid válido", async () => {
    await expect(followUser("no-es-un-cuid")).rejects.toThrow();
    expect(followCreateMock).not.toHaveBeenCalled();
  });
});

describe("unfollowUser", () => {
  it("requiere sesión iniciada", async () => {
    requireUserMock.mockRejectedValue(new Error("Debes iniciar sesión"));

    await expect(unfollowUser(OTHER_ID)).rejects.toThrow("Debes iniciar sesión");
    expect(followDeleteManyMock).not.toHaveBeenCalled();
  });

  it("borra el registro Follow (idempotente aunque no exista) y revalida rutas", async () => {
    followDeleteManyMock.mockResolvedValue({ count: 1 });

    await unfollowUser(OTHER_ID);

    expect(followDeleteManyMock).toHaveBeenCalledWith({
      where: { followerId: ME.id, followingId: OTHER_ID },
    });
    expect(revalidatePathMock).toHaveBeenCalledWith("/miembros");
    expect(revalidatePathMock).toHaveBeenCalledWith(`/perfil/${OTHER_ID}`);
    expect(revalidatePathMock).toHaveBeenCalledWith("/perfil");
  });
});
