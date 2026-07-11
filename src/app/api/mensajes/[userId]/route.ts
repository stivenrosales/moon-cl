import { NextResponse } from "next/server";
import { getSession } from "@/lib/session";
import { db } from "@/lib/db";
import { idSchema } from "@/lib/validators";
import { isBlockedBetween } from "@/server/services/messaging";

export const dynamic = "force-dynamic";

/**
 * Hilo de mensajes con `userId`, para el polling de SWR del cliente.
 * Soporta ?since=<ISO timestamp> para devolver solo mensajes posteriores
 * (payloads incrementales en vez de repintar todo el hilo en cada poll).
 * Marca readAt de los mensajes recibidos en cada llamada: el simple hecho
 * de pedir el hilo implica que el usuario lo está viendo.
 */
export async function GET(request: Request, { params }: { params: Promise<{ userId: string }> }) {
  const session = await getSession();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Debes iniciar sesión" }, { status: 401 });
  }
  const viewerId = session.user.id;

  const { userId } = await params;
  const parsedOtherId = idSchema.safeParse(userId);
  if (!parsedOtherId.success) {
    return NextResponse.json({ error: "Usuario no válido" }, { status: 400 });
  }
  const otherId = parsedOtherId.data;

  if (otherId === viewerId) {
    return NextResponse.json({ error: "Conversación no válida" }, { status: 400 });
  }

  const blocked = await isBlockedBetween(viewerId, otherId);
  if (blocked) {
    return NextResponse.json({ error: "No puedes ver esta conversación" }, { status: 403 });
  }

  const otherUser = await db.user.findUnique({
    where: { id: otherId },
    select: { id: true, name: true, image: true },
  });
  if (!otherUser) {
    return NextResponse.json({ error: "Usuario no encontrado" }, { status: 404 });
  }

  const { searchParams } = new URL(request.url);
  const since = searchParams.get("since");
  const sinceDate = since ? new Date(since) : null;
  const hasValidSince = !!sinceDate && !Number.isNaN(sinceDate.getTime());

  const threadWhere = {
    OR: [
      { senderId: viewerId, receiverId: otherId },
      { senderId: otherId, receiverId: viewerId },
    ],
  };

  const messages = await db.message.findMany({
    where: hasValidSince ? { ...threadWhere, createdAt: { gt: sinceDate! } } : threadWhere,
    orderBy: { createdAt: "asc" },
  });

  await db.message.updateMany({
    where: { senderId: otherId, receiverId: viewerId, readAt: null },
    data: { readAt: new Date() },
  });

  return NextResponse.json({ otherUser, messages });
}
