"use server";

import { revalidatePath } from "next/cache";
import { db } from "@/lib/db";
import { routes } from "@/lib/routes";
import { idSchema, messageSchema } from "@/lib/validators";
import { requireUser } from "@/server/auth-helpers";
import {
  checkThrottle,
  countRecentMessages,
  groupConversations,
  isBlockedBetween,
} from "@/server/services/messaging";

/**
 * Envía un mensaje privado. Dos guardas antes de tocar la base de datos:
 * bloqueo bidireccional (error NEUTRO: nunca revela quién bloqueó a quién,
 * ver services/messaging.ts) y throttle (máx 20 mensajes/60s) para frenar
 * spam sin depender de infraestructura externa (rate limiter, Redis, etc).
 */
export async function sendMessage(input: unknown) {
  const user = await requireUser();
  const data = messageSchema.parse(input);

  if (data.receiverId === user.id) {
    throw new Error("No puedes enviarte mensajes a ti mismo");
  }

  const blocked = await isBlockedBetween(user.id, data.receiverId);
  if (blocked) {
    throw new Error("No puedes enviar mensajes a este usuario");
  }

  const recentCount = await countRecentMessages(user.id);
  if (checkThrottle(recentCount)) {
    throw new Error("Estás enviando mensajes muy rápido, espera un momento");
  }

  const message = await db.message.create({
    data: {
      senderId: user.id,
      receiverId: data.receiverId,
      content: data.content,
    },
  });

  revalidatePath(routes.mensajeCon(data.receiverId));
  revalidatePath(routes.mensajes());
  return message;
}

/**
 * Bandeja de conversaciones del usuario actual: agrupa todos sus mensajes
 * (enviados y recibidos) por interlocutor con groupConversations (pura) y
 * les adjunta los datos públicos del otro usuario para pintar la lista.
 */
export async function getConversations() {
  const user = await requireUser();

  const messages = await db.message.findMany({
    where: { OR: [{ senderId: user.id }, { receiverId: user.id }] },
    orderBy: { createdAt: "desc" },
  });

  const conversations = groupConversations(messages, user.id);
  if (conversations.length === 0) return [];

  const otherUsers = await db.user.findMany({
    where: { id: { in: conversations.map((c) => c.otherUserId) } },
    select: { id: true, name: true, image: true },
  });
  const otherUsersById = new Map(otherUsers.map((u) => [u.id, u]));

  return conversations.map((conversation) => ({
    ...conversation,
    otherUser: otherUsersById.get(conversation.otherUserId) ?? null,
  }));
}

/**
 * Marca como leídos todos los mensajes que el usuario actual RECIBIÓ de
 * `otherId` (nunca los que él mismo envió).
 */
export async function markThreadRead(otherId: string) {
  const user = await requireUser();
  const parsedOtherId = idSchema.parse(otherId);

  await db.message.updateMany({
    where: { senderId: parsedOtherId, receiverId: user.id, readAt: null },
    data: { readAt: new Date() },
  });

  revalidatePath(routes.mensajeCon(parsedOtherId));
  revalidatePath(routes.mensajes());
}
