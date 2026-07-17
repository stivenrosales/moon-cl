import { redirect } from "next/navigation";
import { getSession } from "@/lib/session";
import { getConversations } from "@/server/actions/messages";
import { ConversationList, type ConversationRow } from "@/components/conversation-list";
import { routes } from "@/lib/routes";

export const metadata = { title: "Mensajes" };

export default async function MensajesPage() {
  const session = await getSession();
  if (!session?.user?.id) redirect(routes.login());

  const conversations = await getConversations();

  const rows: ConversationRow[] = conversations.map((c) => ({
    otherUserId: c.otherUserId,
    otherUser: c.otherUser,
    lastMessage: {
      content: c.lastMessage.content,
      createdAt: c.lastMessage.createdAt.toISOString(),
      senderId: c.lastMessage.senderId,
    },
    unreadCount: c.unreadCount,
  }));

  return (
    <div className="space-y-6">
      <ConversationList rows={rows} viewerId={session.user.id} />
    </div>
  );
}
