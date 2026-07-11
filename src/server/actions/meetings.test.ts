import { beforeEach, describe, expect, it, vi } from "vitest";

const findUniqueMock = vi.fn();
const createMock = vi.fn();
const updateMock = vi.fn();
const requireAdminMock = vi.fn();

vi.mock("@/lib/db", () => ({
  db: {
    meeting: {
      findUnique: (...args: unknown[]) => findUniqueMock(...args),
      create: (...args: unknown[]) => createMock(...args),
      update: (...args: unknown[]) => updateMock(...args),
    },
  },
}));

vi.mock("@/server/auth-helpers", () => ({
  requireAdmin: (...args: unknown[]) => requireAdminMock(...args),
  requireUser: vi.fn(),
}));

vi.mock("next/cache", () => ({
  revalidatePath: vi.fn(),
}));

import { createMeeting, updateMeeting } from "@/server/actions/meetings";

const baseInput = {
  title: "Encuentro mensual",
  startsAt: new Date("2026-08-01T18:00:00.000Z"),
  location: "Biblioteca central",
  isVirtual: false,
};

describe("createMeeting", () => {
  beforeEach(() => {
    findUniqueMock.mockReset();
    createMock.mockReset();
    updateMock.mockReset();
    requireAdminMock.mockReset();
    requireAdminMock.mockResolvedValue({ id: "admin-1", role: "ADMIN" });
  });

  it("persiste el type recibido", async () => {
    createMock.mockResolvedValue({ id: "m1" });

    await createMeeting({ ...baseInput, type: "CINE" });

    expect(createMock).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ type: "CINE" }),
      }),
    );
  });

  it("usa REUNION por defecto cuando no se envía type", async () => {
    createMock.mockResolvedValue({ id: "m1" });

    await createMeeting(baseInput);

    expect(createMock).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ type: "REUNION" }),
      }),
    );
  });
});

describe("updateMeeting", () => {
  beforeEach(() => {
    findUniqueMock.mockReset();
    createMock.mockReset();
    updateMock.mockReset();
    requireAdminMock.mockReset();
    requireAdminMock.mockResolvedValue({ id: "admin-1", role: "ADMIN" });
  });

  it("persiste el type recibido", async () => {
    findUniqueMock.mockResolvedValue({ startsAt: baseInput.startsAt });
    updateMock.mockResolvedValue({ id: "m1" });

    await updateMeeting("m1", { ...baseInput, type: "POESIA" });

    expect(updateMock).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ type: "POESIA" }),
      }),
    );
  });

  it("resetea remindedAt a null cuando startsAt cambia (reunión reprogramada)", async () => {
    findUniqueMock.mockResolvedValue({
      startsAt: new Date("2026-08-01T18:00:00.000Z"),
    });
    updateMock.mockResolvedValue({ id: "m1" });

    await updateMeeting("m1", {
      ...baseInput,
      startsAt: new Date("2026-08-05T20:00:00.000Z"),
    });

    expect(updateMock).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ remindedAt: null }),
      }),
    );
  });

  it("NO toca remindedAt cuando startsAt no cambia", async () => {
    findUniqueMock.mockResolvedValue({
      startsAt: baseInput.startsAt,
    });
    updateMock.mockResolvedValue({ id: "m1" });

    await updateMeeting("m1", { ...baseInput });

    const call = updateMock.mock.calls[0][0];
    expect(call.data).not.toHaveProperty("remindedAt");
  });
});
