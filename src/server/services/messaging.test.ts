import { describe, expect, it, vi } from "vitest";
import {
  checkThrottle,
  countRecentMessages,
  groupConversations,
  isBlockedBetween,
  MESSAGE_THROTTLE_LIMIT,
  type ConversationMessage,
} from "@/server/services/messaging";

function createFakeClient(overrides: {
  blockFindFirst?: ReturnType<typeof vi.fn>;
  messageCount?: ReturnType<typeof vi.fn>;
} = {}) {
  return {
    block: {
      findFirst: overrides.blockFindFirst ?? vi.fn().mockResolvedValue(null),
    },
    message: {
      count: overrides.messageCount ?? vi.fn().mockResolvedValue(0),
    },
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
  } as any;
}

function makeMessage(overrides: Partial<ConversationMessage> = {}): ConversationMessage {
  return {
    id: "m1",
    senderId: "user-a",
    receiverId: "user-b",
    content: "hola",
    readAt: null,
    createdAt: new Date("2026-07-10T10:00:00.000Z"),
    ...overrides,
  };
}

describe("isBlockedBetween", () => {
  it("consulta el bloqueo en ambas direcciones (OR)", async () => {
    const blockFindFirst = vi.fn().mockResolvedValue(null);
    const client = createFakeClient({ blockFindFirst });

    await isBlockedBetween("user-a", "user-b", client);

    expect(blockFindFirst).toHaveBeenCalledWith({
      where: {
        OR: [
          { blockerId: "user-a", blockedId: "user-b" },
          { blockerId: "user-b", blockedId: "user-a" },
        ],
      },
      select: { id: true },
    });
  });

  it("retorna true cuando A bloqueó a B", async () => {
    const client = createFakeClient({ blockFindFirst: vi.fn().mockResolvedValue({ id: "block1" }) });

    const result = await isBlockedBetween("user-a", "user-b", client);

    expect(result).toBe(true);
  });

  it("retorna true cuando B bloqueó a A (bidireccional)", async () => {
    const blockFindFirst = vi.fn(async ({ where }) => {
      const hit = where.OR.some(
        (clause: { blockerId: string; blockedId: string }) =>
          clause.blockerId === "user-b" && clause.blockedId === "user-a",
      );
      return hit ? { id: "block1" } : null;
    });
    const client = createFakeClient({ blockFindFirst });

    const result = await isBlockedBetween("user-a", "user-b", client);

    expect(result).toBe(true);
  });

  it("retorna false cuando no hay bloqueo en ninguna dirección", async () => {
    const client = createFakeClient();

    const result = await isBlockedBetween("user-a", "user-b", client);

    expect(result).toBe(false);
  });
});

describe("checkThrottle", () => {
  it(`no está saturado con menos de ${MESSAGE_THROTTLE_LIMIT} mensajes recientes`, () => {
    expect(checkThrottle(0)).toBe(false);
    expect(checkThrottle(MESSAGE_THROTTLE_LIMIT - 1)).toBe(false);
  });

  it(`está saturado exactamente al llegar a ${MESSAGE_THROTTLE_LIMIT} mensajes recientes`, () => {
    expect(checkThrottle(MESSAGE_THROTTLE_LIMIT)).toBe(true);
  });

  it("sigue saturado por encima del límite", () => {
    expect(checkThrottle(MESSAGE_THROTTLE_LIMIT + 5)).toBe(true);
  });
});

describe("countRecentMessages", () => {
  it("cuenta mensajes del emisor dentro de la ventana de 60s terminando en `now`", async () => {
    const messageCount = vi.fn().mockResolvedValue(3);
    const client = createFakeClient({ messageCount });
    const now = new Date("2026-07-10T10:01:00.000Z");

    const result = await countRecentMessages("user-a", now, client);

    expect(result).toBe(3);
    expect(messageCount).toHaveBeenCalledWith({
      where: { senderId: "user-a", createdAt: { gte: new Date("2026-07-10T10:00:00.000Z") } },
    });
  });
});

describe("groupConversations", () => {
  it("agrupa mensajes por interlocutor (sin importar quién los envió)", () => {
    const messages = [
      makeMessage({ id: "m1", senderId: "viewer", receiverId: "a" }),
      makeMessage({ id: "m2", senderId: "a", receiverId: "viewer" }),
      makeMessage({ id: "m3", senderId: "viewer", receiverId: "b" }),
    ];

    const result = groupConversations(messages, "viewer");

    expect(result).toHaveLength(2);
    expect(result.map((c) => c.otherUserId).sort()).toEqual(["a", "b"]);
  });

  it("elige el mensaje más reciente del hilo como lastMessage, sin importar el orden de entrada", () => {
    const older = makeMessage({
      id: "old",
      senderId: "viewer",
      receiverId: "a",
      createdAt: new Date("2026-07-10T09:00:00.000Z"),
    });
    const newer = makeMessage({
      id: "new",
      senderId: "a",
      receiverId: "viewer",
      createdAt: new Date("2026-07-10T11:00:00.000Z"),
    });

    const result = groupConversations([older, newer], "viewer");

    expect(result[0].lastMessage.id).toBe("new");
  });

  it("cuenta solo los mensajes RECIBIDOS y no leídos por el viewer (nunca los propios)", () => {
    const messages = [
      makeMessage({ id: "m1", senderId: "a", receiverId: "viewer", readAt: null }),
      makeMessage({ id: "m2", senderId: "a", receiverId: "viewer", readAt: null }),
      makeMessage({ id: "m3", senderId: "a", receiverId: "viewer", readAt: new Date() }),
      // Enviado POR el viewer y sin leer por el otro: no debe contar como no leído del viewer.
      makeMessage({ id: "m4", senderId: "viewer", receiverId: "a", readAt: null }),
    ];

    const result = groupConversations(messages, "viewer");

    expect(result[0].unreadCount).toBe(2);
  });

  it("ordena las conversaciones por el mensaje más reciente primero", () => {
    const messages = [
      makeMessage({ id: "m-a", senderId: "viewer", receiverId: "a", createdAt: new Date("2026-07-08T00:00:00.000Z") }),
      makeMessage({ id: "m-b", senderId: "viewer", receiverId: "b", createdAt: new Date("2026-07-10T00:00:00.000Z") }),
      makeMessage({ id: "m-c", senderId: "viewer", receiverId: "c", createdAt: new Date("2026-07-09T00:00:00.000Z") }),
    ];

    const result = groupConversations(messages, "viewer");

    expect(result.map((c) => c.otherUserId)).toEqual(["b", "c", "a"]);
  });

  it("retorna una lista vacía cuando no hay mensajes", () => {
    expect(groupConversations([], "viewer")).toEqual([]);
  });
});
