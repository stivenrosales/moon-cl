import { beforeEach, describe, expect, it, vi } from "vitest";

const userFindUniqueMock = vi.fn();
const userUpdateMock = vi.fn();
const requireUserMock = vi.fn();
const revalidatePathMock = vi.fn();

vi.mock("@/lib/db", () => ({
  db: {
    user: {
      findUnique: (...args: unknown[]) => userFindUniqueMock(...args),
      update: (...args: unknown[]) => userUpdateMock(...args),
    },
  },
}));

vi.mock("@/server/auth-helpers", () => ({
  requireUser: (...args: unknown[]) => requireUserMock(...args),
}));

vi.mock("next/cache", () => ({
  revalidatePath: (...args: unknown[]) => revalidatePathMock(...args),
}));

import { toggleMatchOptIn } from "@/server/actions/match";

const ME = { id: "cme111111111111111111111", role: "MEMBER" };

beforeEach(() => {
  userFindUniqueMock.mockReset();
  userUpdateMock.mockReset();
  requireUserMock.mockReset();
  revalidatePathMock.mockReset();
  requireUserMock.mockResolvedValue(ME);
});

describe("toggleMatchOptIn", () => {
  it("requiere sesión iniciada", async () => {
    requireUserMock.mockRejectedValue(new Error("Debes iniciar sesión"));

    await expect(toggleMatchOptIn()).rejects.toThrow("Debes iniciar sesión");
    expect(userUpdateMock).not.toHaveBeenCalled();
  });

  it("activa el Book Match cuando estaba desactivado", async () => {
    userFindUniqueMock.mockResolvedValue({ isMatchOptIn: false });
    userUpdateMock.mockResolvedValue({ id: ME.id, isMatchOptIn: true });

    const result = await toggleMatchOptIn();

    expect(result).toEqual({ isMatchOptIn: true });
    expect(userUpdateMock).toHaveBeenCalledWith({
      where: { id: ME.id },
      data: { isMatchOptIn: true },
    });
    expect(revalidatePathMock).toHaveBeenCalledWith("/perfil");
    expect(revalidatePathMock).toHaveBeenCalledWith("/club");
  });

  it("desactiva el Book Match cuando estaba activado", async () => {
    userFindUniqueMock.mockResolvedValue({ isMatchOptIn: true });
    userUpdateMock.mockResolvedValue({ id: ME.id, isMatchOptIn: false });

    const result = await toggleMatchOptIn();

    expect(result).toEqual({ isMatchOptIn: false });
    expect(userUpdateMock).toHaveBeenCalledWith({
      where: { id: ME.id },
      data: { isMatchOptIn: false },
    });
  });

  it("trata un usuario sin isMatchOptIn previo (undefined) como desactivado y lo activa", async () => {
    userFindUniqueMock.mockResolvedValue(null);
    userUpdateMock.mockResolvedValue({ id: ME.id, isMatchOptIn: true });

    const result = await toggleMatchOptIn();

    expect(result).toEqual({ isMatchOptIn: true });
  });
});
