import { beforeEach, describe, expect, it, vi } from "vitest";

const messageCreateMock = vi.fn();
const messageFindManyMock = vi.fn();
const messageUpdateManyMock = vi.fn();
const messageCountMock = vi.fn();
const userFindManyMock = vi.fn();
const blockFindFirstMock = vi.fn();
const requireUserMock = vi.fn();
const revalidatePathMock = vi.fn();

vi.mock("@/lib/db", () => ({
  db: {
    message: {
      create: (...args: unknown[]) => messageCreateMock(...args),
      findMany: (...args: unknown[]) => messageFindManyMock(...args),
      updateMany: (...args: unknown[]) => messageUpdateManyMock(...args),
      count: (...args: unknown[]) => messageCountMock(...args),
    },
    user: {
      findMany: (...args: unknown[]) => userFindManyMock(...args),
    },
    block: {
      findFirst: (...args: unknown[]) => blockFindFirstMock(...args),
    },
  },
}));

vi.mock("@/server/auth-helpers", () => ({
  requireUser: (...args: unknown[]) => requireUserMock(...args),
}));

vi.mock("next/cache", () => ({
  revalidatePath: (...args: unknown[]) => revalidatePathMock(...args),
}));

import { getConversations, markThreadRead, sendMessage } from "@/server/actions/messages";

const ME = { id: "cme111111111111111111111", role: "MEMBER" };
const OTHER_ID = "cother2222222222222222222";

beforeEach(() => {
  messageCreateMock.mockReset();
  messageFindManyMock.mockReset();
  messageUpdateManyMock.mockReset();
  messageCountMock.mockReset();
  userFindManyMock.mockReset();
  blockFindFirstMock.mockReset();
  requireUserMock.mockReset();
  revalidatePathMock.mockReset();

  requireUserMock.mockResolvedValue(ME);
  blockFindFirstMock.mockResolvedValue(null);
  messageCountMock.mockResolvedValue(0);
});

describe("sendMessage", () => {
  it("requiere sesión iniciada", async () => {
    requireUserMock.mockRejectedValue(new Error("Debes iniciar sesión"));

    await expect(sendMessage({ receiverId: OTHER_ID, content: "hola" })).rejects.toThrow(
      "Debes iniciar sesión",
    );
    expect(messageCreateMock).not.toHaveBeenCalled();
  });

  it("rechaza el auto-envío", async () => {
    await expect(sendMessage({ receiverId: ME.id, content: "hola" })).rejects.toThrow(
      "No puedes enviarte mensajes a ti mismo",
    );
    expect(messageCreateMock).not.toHaveBeenCalled();
  });

  it("lanza un error NEUTRO (sin revelar quién bloqueó) cuando hay bloqueo entre ambos usuarios", async () => {
    blockFindFirstMock.mockResolvedValue({ id: "block1" });

    await expect(sendMessage({ receiverId: OTHER_ID, content: "hola" })).rejects.toThrow(
      "No puedes enviar mensajes a este usuario",
    );
    expect(messageCreateMock).not.toHaveBeenCalled();
  });

  it("el error de bloqueo es el mismo sin importar si bloqueó el emisor o el receptor", async () => {
    // isBlockedBetween es bidireccional: no probamos el detalle aquí (ver
    // messaging.test.ts), solo que la action no distingue el sentido.
    blockFindFirstMock.mockResolvedValue({ id: "block1" });

    const error = await sendMessage({ receiverId: OTHER_ID, content: "hola" }).catch((e) => e);

    expect(error.message).toBe("No puedes enviar mensajes a este usuario");
  });

  it("lanza un error de throttle cuando ya envió 20 mensajes en los últimos 60s", async () => {
    messageCountMock.mockResolvedValue(20);

    await expect(sendMessage({ receiverId: OTHER_ID, content: "hola" })).rejects.toThrow(
      "Estás enviando mensajes muy rápido, espera un momento",
    );
    expect(messageCreateMock).not.toHaveBeenCalled();
  });

  it("crea el mensaje y revalida las rutas cuando todas las guardas pasan", async () => {
    messageCreateMock.mockResolvedValue({
      id: "msg1",
      senderId: ME.id,
      receiverId: OTHER_ID,
      content: "hola",
    });

    await sendMessage({ receiverId: OTHER_ID, content: "hola" });

    expect(messageCreateMock).toHaveBeenCalledWith({
      data: { senderId: ME.id, receiverId: OTHER_ID, content: "hola" },
    });
    expect(revalidatePathMock).toHaveBeenCalledWith(`/club/mensajes/${OTHER_ID}`);
    expect(revalidatePathMock).toHaveBeenCalledWith("/club/mensajes");
  });

  it("recorta el contenido antes de guardarlo (zod trim)", async () => {
    messageCreateMock.mockResolvedValue({ id: "msg1" });

    await sendMessage({ receiverId: OTHER_ID, content: "  hola  " });

    expect(messageCreateMock).toHaveBeenCalledWith({
      data: { senderId: ME.id, receiverId: OTHER_ID, content: "hola" },
    });
  });

  it("rechaza un input inválido (zod)", async () => {
    await expect(sendMessage({ receiverId: OTHER_ID, content: "" })).rejects.toThrow();
    expect(messageCreateMock).not.toHaveBeenCalled();
  });
});

describe("getConversations", () => {
  it("requiere sesión iniciada", async () => {
    requireUserMock.mockRejectedValue(new Error("Debes iniciar sesión"));

    await expect(getConversations()).rejects.toThrow("Debes iniciar sesión");
  });

  it("retorna una lista vacía sin consultar usuarios cuando no hay mensajes", async () => {
    messageFindManyMock.mockResolvedValue([]);

    const result = await getConversations();

    expect(result).toEqual([]);
    expect(userFindManyMock).not.toHaveBeenCalled();
  });

  it("agrupa los mensajes y adjunta los datos del otro usuario por conversación", async () => {
    messageFindManyMock.mockResolvedValue([
      {
        id: "m1",
        senderId: ME.id,
        receiverId: OTHER_ID,
        content: "hola",
        readAt: null,
        createdAt: new Date("2026-07-10T10:00:00.000Z"),
      },
    ]);
    userFindManyMock.mockResolvedValue([{ id: OTHER_ID, name: "Otro", image: null }]);

    const result = await getConversations();

    expect(result).toEqual([
      {
        otherUserId: OTHER_ID,
        lastMessage: expect.objectContaining({ id: "m1" }),
        unreadCount: 0,
        otherUser: { id: OTHER_ID, name: "Otro", image: null },
      },
    ]);
  });
});

describe("markThreadRead", () => {
  it("requiere sesión iniciada", async () => {
    requireUserMock.mockRejectedValue(new Error("Debes iniciar sesión"));

    await expect(markThreadRead(OTHER_ID)).rejects.toThrow("Debes iniciar sesión");
    expect(messageUpdateManyMock).not.toHaveBeenCalled();
  });

  it("marca como leídos solo los mensajes recibidos del otro usuario", async () => {
    messageUpdateManyMock.mockResolvedValue({ count: 3 });

    await markThreadRead(OTHER_ID);

    expect(messageUpdateManyMock).toHaveBeenCalledWith({
      where: { senderId: OTHER_ID, receiverId: ME.id, readAt: null },
      data: { readAt: expect.any(Date) },
    });
    expect(revalidatePathMock).toHaveBeenCalledWith(`/club/mensajes/${OTHER_ID}`);
  });

  it("rechaza un id que no es un cuid válido", async () => {
    await expect(markThreadRead("no-es-un-cuid")).rejects.toThrow();
    expect(messageUpdateManyMock).not.toHaveBeenCalled();
  });
});
