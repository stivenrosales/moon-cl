import { redirect } from "next/navigation";
import { getSession } from "@/lib/session";
import { getConversations } from "@/server/actions/messages";
import { ConversationList, type ConversationRow } from "@/components/conversation-list";

export const metadata = { title: "Mensajes" };

export default async function MensajesPage() {
  const session = await getSession();
  if (!session?.user?.id) redirect("/login");

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
      <header>
        <span className="text-xs uppercase tracking-[0.32em] text-accent-text">
          Bajo la misma luna
        </span>
        <h1 className="h1-display display mt-1.5">
          <span className="hand-script italic text-primary">Mensajes</span>
        </h1>
      </header>

      <ConversationList rows={rows} viewerId={session.user.id} />
    </div>
  );
}
