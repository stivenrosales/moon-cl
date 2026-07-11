import { db } from "@/lib/db";
import type { Prisma } from "@prisma/client";

export type MessagingClient = Pick<Prisma.TransactionClient, "message" | "block"> | typeof db;

// ─────────────────────────────────────────────────────────────────────────
// Mensajes privados y moderación (Paquete B1)
//
// Igual que social.ts: lógica pura separada de las queries, con el cliente
// de Prisma inyectable para poder testear sin tocar la base de datos.
// ─────────────────────────────────────────────────────────────────────────

/**
 * Bloqueo BIDIRECCIONAL: si A bloqueó a B, o B bloqueó a A, no debe poder
 * fluir ningún mensaje entre ambos en ninguna dirección. El caller decide
 * el mensaje de error (siempre neutro, sin revelar quién bloqueó a quién).
 */
export async function isBlockedBetween(
  userAId: string,
  userBId: string,
  client: MessagingClient = db,
): Promise<boolean> {
  const block = await client.block.findFirst({
    where: {
      OR: [
        { blockerId: userAId, blockedId: userBId },
        { blockerId: userBId, blockedId: userAId },
      ],
    },
    select: { id: true },
  });
  return !!block;
}

export const MESSAGE_THROTTLE_LIMIT = 20;
export const MESSAGE_THROTTLE_WINDOW_MS = 60_000;

/**
 * Máx 20 mensajes por 60s. Función pura sobre un conteo ya calculado (el
 * caller hace la query de createdAt >= now - ventana) para que el límite en
 * sí sea trivial de testear sin mocks de Prisma ni fake timers.
 */
export function checkThrottle(recentCount: number): boolean {
  return recentCount >= MESSAGE_THROTTLE_LIMIT;
}

/**
 * Cuenta los mensajes enviados por `senderId` dentro de la ventana de
 * throttle, terminando en `now` (parámetro para tests deterministas).
 */
export async function countRecentMessages(
  senderId: string,
  now: Date = new Date(),
  client: MessagingClient = db,
): Promise<number> {
  const since = new Date(now.getTime() - MESSAGE_THROTTLE_WINDOW_MS);
  return client.message.count({
    where: { senderId, createdAt: { gte: since } },
  });
}

export interface ConversationMessage {
  id: string;
  senderId: string;
  receiverId: string;
  content: string;
  readAt: Date | null;
  createdAt: Date;
}

export interface Conversation {
  otherUserId: string;
  lastMessage: ConversationMessage;
  unreadCount: number;
}

/**
 * Agrupa una lista plana de mensajes (donde el viewer es siempre emisor o
 * receptor) por interlocutor: último mensaje del hilo + conteo de no
 * leídos (solo cuenta los que el viewer RECIBIÓ y no ha leído; nunca los
 * propios). Ordena las conversaciones por el mensaje más reciente primero,
 * sin asumir que `messages` ya venga ordenado.
 */
export function groupConversations(messages: ConversationMessage[], viewerId: string): Conversation[] {
  const byOtherUser = new Map<string, ConversationMessage[]>();

  for (const message of messages) {
    const otherUserId = message.senderId === viewerId ? message.receiverId : message.senderId;
    const bucket = byOtherUser.get(otherUserId);
    if (bucket) {
      bucket.push(message);
    } else {
      byOtherUser.set(otherUserId, [message]);
    }
  }

  const conversations: Conversation[] = [];
  for (const [otherUserId, thread] of byOtherUser) {
    const lastMessage = thread.reduce((latest, current) =>
      current.createdAt.getTime() > latest.createdAt.getTime() ? current : latest,
    );
    const unreadCount = thread.filter(
      (m) => m.receiverId === viewerId && m.readAt === null,
    ).length;

    conversations.push({ otherUserId, lastMessage, unreadCount });
  }

  conversations.sort((a, b) => b.lastMessage.createdAt.getTime() - a.lastMessage.createdAt.getTime());
  return conversations;
}
