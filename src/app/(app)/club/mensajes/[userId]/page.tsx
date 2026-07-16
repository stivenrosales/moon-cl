import { notFound, redirect } from "next/navigation";
import { getSession } from "@/lib/session";
import { db } from "@/lib/db";
import { idSchema } from "@/lib/validators";
import { routes } from "@/lib/routes";
import { isBlockedBetween } from "@/server/services/messaging";
import { ThreadView } from "@/components/thread-view";

export default async function MensajeThreadPage({
  params,
}: {
  params: Promise<{ userId: string }>;
}) {
  const { userId } = await params;
  const session = await getSession();
  if (!session?.user?.id) redirect(routes.login());
  const viewerId = session.user.id;

  const parsedOtherId = idSchema.safeParse(userId);
  if (!parsedOtherId.success) notFound();
  const otherId = parsedOtherId.data;
  if (otherId === viewerId) notFound();

  const blocked = await isBlockedBetween(viewerId, otherId);
  if (blocked) notFound();

  const otherUser = await db.user.findUnique({
    where: { id: otherId },
    select: { id: true, name: true, image: true },
  });
  if (!otherUser) notFound();

  const [messages, lastActiveMessage] = await Promise.all([
    db.message.findMany({
      where: {
        OR: [
          { senderId: viewerId, receiverId: otherId },
          { senderId: otherId, receiverId: viewerId },
        ],
      },
      orderBy: { createdAt: "asc" },
    }),
    // Proxy razonable de "actividad reciente": el club no tiene un campo
    // lastSeenAt dedicado, así que se usa el mensaje más reciente que esta
    // persona haya enviado (en cualquier hilo) — un dato real, nunca uno
    // inventado (mismo principio que la afinidad: nunca mostrar con datos
    // vacíos).
    db.message.findFirst({
      where: { senderId: otherId },
      orderBy: { createdAt: "desc" },
      select: { createdAt: true },
    }),
  ]);

  await db.message.updateMany({
    where: { senderId: otherId, receiverId: viewerId, readAt: null },
    data: { readAt: new Date() },
  });

  return (
    <ThreadView
      viewerId={viewerId}
      otherUser={otherUser}
      otherUserLastActiveAt={lastActiveMessage?.createdAt.toISOString() ?? null}
      initialMessages={messages.map((m) => ({
        id: m.id,
        senderId: m.senderId,
        receiverId: m.receiverId,
        content: m.content,
        readAt: m.readAt ? m.readAt.toISOString() : null,
        createdAt: m.createdAt.toISOString(),
      }))}
    />
  );
}
