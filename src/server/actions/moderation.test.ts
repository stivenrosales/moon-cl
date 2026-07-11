import { beforeEach, describe, expect, it, vi } from "vitest";
import { Prisma } from "@prisma/client";

const blockCreateMock = vi.fn();
const blockDeleteManyMock = vi.fn();
const reportCreateMock = vi.fn();
const reportUpdateMock = vi.fn();
const reportFindUniqueMock = vi.fn();
const messageFindManyMock = vi.fn();
const userFindManyMock = vi.fn();
const requireUserMock = vi.fn();
const requireModeratorMock = vi.fn();
const revalidatePathMock = vi.fn();

vi.mock("@/lib/db", () => ({
  db: {
    block: {
      create: (...args: unknown[]) => blockCreateMock(...args),
      deleteMany: (...args: unknown[]) => blockDeleteManyMock(...args),
    },
    report: {
      create: (...args: unknown[]) => reportCreateMock(...args),
      update: (...args: unknown[]) => reportUpdateMock(...args),
      findUnique: (...args: unknown[]) => reportFindUniqueMock(...args),
    },
    message: {
      findMany: (...args: unknown[]) => messageFindManyMock(...args),
    },
    user: {
      findMany: (...args: unknown[]) => userFindManyMock(...args),
    },
  },
}));

vi.mock("@/server/auth-helpers", () => ({
  requireUser: (...args: unknown[]) => requireUserMock(...args),
  requireModerator: (...args: unknown[]) => requireModeratorMock(...args),
}));

vi.mock("next/cache", () => ({
  revalidatePath: (...args: unknown[]) => revalidatePathMock(...args),
}));

const { emailsSendMock, batchSendMock, ResendMock } = vi.hoisted(() => {
  const emailsSendMock = vi.fn().mockResolvedValue({ data: { id: "e1" }, error: null });
  const batchSendMock = vi.fn().mockResolvedValue({ data: { data: [] }, error: null });
  const ResendMock = vi.fn().mockImplementation(function Resend() {
    return {
      emails: { send: emailsSendMock },
      batch: { send: batchSendMock },
    };
  });
  return { emailsSendMock, batchSendMock, ResendMock };
});

vi.mock("resend", () => ({ Resend: ResendMock }));

vi.mock("@/lib/email", () => ({
  buildReportNotificationHtml: vi.fn().mockReturnValue("<html></html>"),
  buildReportNotificationText: vi.fn().mockReturnValue("texto"),
}));

import {
  blockUser,
  getReportThread,
  reportConversation,
  resolveReport,
  unblockUser,
} from "@/server/actions/moderation";

const ME = { id: "cme111111111111111111111", role: "MEMBER" };
const MODERATOR = { id: "cmod22222222222222222222", role: "MODERATOR" };
const OTHER_ID = "cother2222222222222222222";

function duplicateBlockError() {
  return new Prisma.PrismaClientKnownRequestError("Unique constraint failed", {
    code: "P2002",
    clientVersion: "5.22.0",
  });
}

beforeEach(() => {
  blockCreateMock.mockReset();
  blockDeleteManyMock.mockReset();
  reportCreateMock.mockReset();
  reportUpdateMock.mockReset();
  reportFindUniqueMock.mockReset();
  messageFindManyMock.mockReset();
  userFindManyMock.mockReset();
  requireUserMock.mockReset();
  requireModeratorMock.mockReset();
  revalidatePathMock.mockReset();
  emailsSendMock.mockClear();
  batchSendMock.mockClear();

  requireUserMock.mockResolvedValue(ME);
  requireModeratorMock.mockResolvedValue(MODERATOR);
  userFindManyMock.mockResolvedValue([]);

  process.env.AUTH_RESEND_KEY = "re_test_key";
  process.env.EMAIL_FROM = "Moon Club <noreply@test.dev>";
  process.env.AUTH_URL = "https://moon.test";
});

describe("blockUser", () => {
  it("requiere sesión iniciada", async () => {
    requireUserMock.mockRejectedValue(new Error("Debes iniciar sesión"));

    await expect(blockUser(OTHER_ID)).rejects.toThrow("Debes iniciar sesión");
    expect(blockCreateMock).not.toHaveBeenCalled();
  });

  it("rechaza el auto-bloqueo", async () => {
    await expect(blockUser(ME.id)).rejects.toThrow("No puedes bloquearte a ti mismo");
    expect(blockCreateMock).not.toHaveBeenCalled();
  });

  it("crea el registro Block y revalida rutas", async () => {
    blockCreateMock.mockResolvedValue({ id: "b1" });

    await blockUser(OTHER_ID);

    expect(blockCreateMock).toHaveBeenCalledWith({
      data: { blockerId: ME.id, blockedId: OTHER_ID },
    });
    expect(revalidatePathMock).toHaveBeenCalledWith("/mensajes");
    expect(revalidatePathMock).toHaveBeenCalledWith(`/perfil/${OTHER_ID}`);
  });

  it("es idempotente ante un choque con @@unique (P2002)", async () => {
    blockCreateMock.mockRejectedValue(duplicateBlockError());

    await expect(blockUser(OTHER_ID)).resolves.toBeUndefined();
  });

  it("relanza errores de Prisma que no son de duplicado", async () => {
    const other = new Prisma.PrismaClientKnownRequestError("Foreign key failed", {
      code: "P2003",
      clientVersion: "5.22.0",
    });
    blockCreateMock.mockRejectedValue(other);

    await expect(blockUser(OTHER_ID)).rejects.toBe(other);
  });
});

describe("unblockUser", () => {
  it("requiere sesión iniciada", async () => {
    requireUserMock.mockRejectedValue(new Error("Debes iniciar sesión"));

    await expect(unblockUser(OTHER_ID)).rejects.toThrow("Debes iniciar sesión");
    expect(blockDeleteManyMock).not.toHaveBeenCalled();
  });

  it("borra el registro Block (idempotente) y revalida rutas", async () => {
    blockDeleteManyMock.mockResolvedValue({ count: 1 });

    await unblockUser(OTHER_ID);

    expect(blockDeleteManyMock).toHaveBeenCalledWith({
      where: { blockerId: ME.id, blockedId: OTHER_ID },
    });
    expect(revalidatePathMock).toHaveBeenCalledWith("/mensajes");
  });
});

describe("reportConversation", () => {
  it("requiere sesión iniciada", async () => {
    requireUserMock.mockRejectedValue(new Error("Debes iniciar sesión"));

    await expect(reportConversation({ reportedUserId: OTHER_ID, category: "SPAM" })).rejects.toThrow(
      "Debes iniciar sesión",
    );
    expect(reportCreateMock).not.toHaveBeenCalled();
  });

  it("rechaza el auto-reporte", async () => {
    await expect(reportConversation({ reportedUserId: ME.id, category: "SPAM" })).rejects.toThrow(
      "No puedes reportarte a ti mismo",
    );
    expect(reportCreateMock).not.toHaveBeenCalled();
  });

  it("crea el Report con los datos del schema", async () => {
    reportCreateMock.mockResolvedValue({ id: "r1" });

    await reportConversation({
      reportedUserId: OTHER_ID,
      category: "ACOSO",
      subReason: "Mensajes reiterados",
    });

    expect(reportCreateMock).toHaveBeenCalledWith({
      data: {
        reporterId: ME.id,
        reportedUserId: OTHER_ID,
        category: "ACOSO",
        subReason: "Mensajes reiterados",
        details: null,
        messageId: null,
      },
    });
    expect(revalidatePathMock).toHaveBeenCalledWith("/admin");
  });

  it("notifica por email a ADMIN y MODERATOR, consultados por role", async () => {
    reportCreateMock.mockResolvedValue({ id: "r1" });
    userFindManyMock.mockResolvedValue([
      { email: "admin@example.com" },
      { email: "mod@example.com" },
    ]);

    await reportConversation({ reportedUserId: OTHER_ID, category: "SPAM" });

    expect(userFindManyMock).toHaveBeenCalledWith({
      where: { role: { in: ["ADMIN", "MODERATOR"] } },
      select: { email: true },
    });
    expect(batchSendMock).toHaveBeenCalledTimes(1);
    expect(emailsSendMock).not.toHaveBeenCalled();
  });

  it("envía con emails.send cuando solo hay un destinatario", async () => {
    reportCreateMock.mockResolvedValue({ id: "r1" });
    userFindManyMock.mockResolvedValue([{ email: "admin@example.com" }]);

    await reportConversation({ reportedUserId: OTHER_ID, category: "SPAM" });

    expect(emailsSendMock).toHaveBeenCalledTimes(1);
    expect(batchSendMock).not.toHaveBeenCalled();
  });

  it("no falla si no hay AUTH_RESEND_KEY configurada (dev/local)", async () => {
    delete process.env.AUTH_RESEND_KEY;
    reportCreateMock.mockResolvedValue({ id: "r1" });
    userFindManyMock.mockResolvedValue([{ email: "admin@example.com" }]);

    await expect(
      reportConversation({ reportedUserId: OTHER_ID, category: "SPAM" }),
    ).resolves.toMatchObject({ id: "r1" });
    expect(emailsSendMock).not.toHaveBeenCalled();
  });

  it("no envía correos si no hay moderadores con email", async () => {
    reportCreateMock.mockResolvedValue({ id: "r1" });
    userFindManyMock.mockResolvedValue([{ email: null }]);

    await reportConversation({ reportedUserId: OTHER_ID, category: "SPAM" });

    expect(emailsSendMock).not.toHaveBeenCalled();
    expect(batchSendMock).not.toHaveBeenCalled();
  });
});

describe("resolveReport", () => {
  it("requiere ser moderador o admin", async () => {
    requireModeratorMock.mockRejectedValue(new Error("No tienes permisos para esta acción"));

    await expect(resolveReport("creport11111111111111111", "RESOLVED")).rejects.toThrow(
      "No tienes permisos para esta acción",
    );
    expect(reportUpdateMock).not.toHaveBeenCalled();
  });

  it("actualiza status, resolvedAt y resolvedById", async () => {
    reportUpdateMock.mockResolvedValue({ id: "r1" });

    await resolveReport("creport11111111111111111", "RESOLVED");

    expect(reportUpdateMock).toHaveBeenCalledWith({
      where: { id: "creport11111111111111111" },
      data: {
        status: "RESOLVED",
        resolvedAt: expect.any(Date),
        resolvedById: MODERATOR.id,
      },
    });
    expect(revalidatePathMock).toHaveBeenCalledWith("/admin");
  });

  it("rechaza intentar volver a poner un reporte en OPEN", async () => {
    await expect(resolveReport("creport11111111111111111", "OPEN")).rejects.toThrow(
      "Estado de resolución no válido",
    );
    expect(reportUpdateMock).not.toHaveBeenCalled();
  });
});

describe("getReportThread", () => {
  it("requiere ser moderador o admin", async () => {
    requireModeratorMock.mockRejectedValue(new Error("No tienes permisos para esta acción"));

    await expect(getReportThread("creport11111111111111111")).rejects.toThrow(
      "No tienes permisos para esta acción",
    );
    expect(reportFindUniqueMock).not.toHaveBeenCalled();
  });

  it("lanza si el reporte no existe", async () => {
    reportFindUniqueMock.mockResolvedValue(null);

    await expect(getReportThread("creport11111111111111111")).rejects.toThrow(
      "Reporte no encontrado",
    );
    expect(messageFindManyMock).not.toHaveBeenCalled();
  });

  it("consulta los últimos 30 mensajes entre reportante y reportado, en ambas direcciones", async () => {
    reportFindUniqueMock.mockResolvedValue({ reporterId: ME.id, reportedUserId: OTHER_ID });
    messageFindManyMock.mockResolvedValue([]);

    await getReportThread("creport11111111111111111");

    expect(reportFindUniqueMock).toHaveBeenCalledWith({
      where: { id: "creport11111111111111111" },
      select: { reporterId: true, reportedUserId: true },
    });
    expect(messageFindManyMock).toHaveBeenCalledWith({
      where: {
        OR: [
          { senderId: ME.id, receiverId: OTHER_ID },
          { senderId: OTHER_ID, receiverId: ME.id },
        ],
      },
      orderBy: { createdAt: "desc" },
      take: 30,
    });
  });

  it("devuelve los mensajes en orden cronológico ascendente (la query trae desc)", async () => {
    reportFindUniqueMock.mockResolvedValue({ reporterId: ME.id, reportedUserId: OTHER_ID });
    const newest = { id: "m2", createdAt: new Date("2026-07-10T12:00:00.000Z") };
    const oldest = { id: "m1", createdAt: new Date("2026-07-10T10:00:00.000Z") };
    messageFindManyMock.mockResolvedValue([newest, oldest]);

    const result = await getReportThread("creport11111111111111111");

    expect(result.map((m: { id: string }) => m.id)).toEqual(["m1", "m2"]);
  });
});
