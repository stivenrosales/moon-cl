"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import useSWR from "swr";
import { ArrowLeft, Ban, Flag, Loader2, MoreHorizontal, SendHorizontal } from "lucide-react";
import { toast } from "sonner";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { ReportDialog } from "@/components/report-dialog";
import { blockUser } from "@/server/actions/moderation";
import { sendMessage } from "@/server/actions/messages";
import { groupMessagesByDay } from "@/lib/message-thread";
import { cn, formatTime, getInitials, relativeTime } from "@/lib/utils";

interface ThreadUser {
  id: string;
  name: string | null;
  image: string | null;
}

interface ThreadMessage {
  id: string;
  senderId: string;
  receiverId: string;
  content: string;
  readAt: string | null;
  createdAt: string;
}

interface ThreadData {
  otherUser: ThreadUser;
  messages: ThreadMessage[];
}

interface ThreadViewProps {
  viewerId: string;
  otherUser: ThreadUser;
  otherUserLastActiveAt: string | null;
  initialMessages: ThreadMessage[];
}

const fetcher = async (url: string): Promise<ThreadData> => {
  const res = await fetch(url);
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error(body.error ?? "No se pudo cargar la conversación");
  }
  return res.json();
};

export function ThreadView({
  viewerId,
  otherUser,
  otherUserLastActiveAt,
  initialMessages,
}: ThreadViewProps) {
  const router = useRouter();
  const [content, setContent] = React.useState("");
  const [sending, setSending] = React.useState(false);
  const [reportOpen, setReportOpen] = React.useState(false);
  const formRef = React.useRef<HTMLFormElement>(null);
  const scrollRef = React.useRef<HTMLDivElement>(null);

  const { data, error, mutate } = useSWR<ThreadData>(`/api/mensajes/${otherUser.id}`, fetcher, {
    fallbackData: { otherUser, messages: initialMessages },
    refreshInterval: 5000,
  });

  const messages = data?.messages ?? initialMessages;
  const displayName = otherUser.name ?? "Usuario";
  const lastActiveLabel = otherUserLastActiveAt ? relativeTime(new Date(otherUserLastActiveAt)) : null;
  const dayGroups = React.useMemo(() => groupMessagesByDay(messages), [messages]);

  React.useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight });
  }, [messages.length]);

  async function handleSend(e: React.FormEvent) {
    e.preventDefault();
    const trimmed = content.trim();
    if (!trimmed || sending) return;

    setContent("");
    setSending(true);

    const optimisticMessage: ThreadMessage = {
      id: `optimistic-${Date.now()}`,
      senderId: viewerId,
      receiverId: otherUser.id,
      content: trimmed,
      readAt: null,
      createdAt: new Date().toISOString(),
    };

    try {
      await mutate(
        async (current) => {
          const base = current ?? { otherUser, messages: initialMessages };
          const created = await sendMessage({ receiverId: otherUser.id, content: trimmed });
          return {
            otherUser: base.otherUser,
            messages: [
              ...base.messages.filter((m) => m.id !== optimisticMessage.id),
              {
                id: created.id,
                senderId: created.senderId,
                receiverId: created.receiverId,
                content: created.content,
                readAt: created.readAt ? created.readAt.toISOString() : null,
                createdAt: created.createdAt.toISOString(),
              },
            ],
          };
        },
        {
          optimisticData: (current) => {
            const base = current ?? { otherUser, messages: initialMessages };
            return { otherUser: base.otherUser, messages: [...base.messages, optimisticMessage] };
          },
          rollbackOnError: true,
          revalidate: false,
        },
      );
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "No se pudo enviar el mensaje");
      setContent(trimmed);
    } finally {
      setSending(false);
    }
  }

  function handleKeyDown(e: React.KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      formRef.current?.requestSubmit();
    }
  }

  async function handleBlock() {
    if (!confirm(`¿Bloquear a ${displayName}? No podrá enviarte mensajes.`)) return;
    try {
      await blockUser(otherUser.id);
      toast.success("Usuario bloqueado");
      router.push("/mensajes");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "No se pudo bloquear");
    }
  }

  return (
    <Card className="flex h-[75dvh] max-h-[820px] min-h-[420px] flex-col overflow-hidden">
      <header className="flex shrink-0 items-center gap-3 border-b border-border/50 px-3.5 py-3 sm:px-5">
        <Link
          href="/mensajes"
          aria-label="Volver a mensajes"
          className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-muted-foreground transition-colors hover:bg-muted/60 hover:text-foreground focus-ring"
        >
          <ArrowLeft className="h-4 w-4" />
        </Link>
        <Avatar className="h-9 w-9 shrink-0">
          {otherUser.image ? <AvatarImage src={otherUser.image} alt="" /> : null}
          <AvatarFallback className="text-xs">{getInitials(otherUser.name, null)}</AvatarFallback>
        </Avatar>
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-medium">{displayName}</p>
          {lastActiveLabel ? (
            <p className="truncate text-xs text-muted-foreground">Activo/a {lastActiveLabel}</p>
          ) : null}
        </div>
        <DropdownMenu>
          <DropdownMenuTrigger
            className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-muted-foreground transition-colors hover:bg-muted/60 hover:text-foreground focus-ring"
            aria-label="Más opciones"
          >
            <MoreHorizontal className="h-4 w-4" />
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuItem onSelect={() => setReportOpen(true)}>
              <Flag className="h-4 w-4" /> Reportar conversación
            </DropdownMenuItem>
            <DropdownMenuItem onSelect={handleBlock} className="text-destructive focus:text-destructive">
              <Ban className="h-4 w-4" /> Bloquear
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </header>

      <div ref={scrollRef} className="flex-1 space-y-1 overflow-y-auto px-3.5 py-4 sm:px-5">
        {messages.length === 0 ? (
          <div className="flex h-full items-center justify-center text-center">
            <div>
              <p className="hand-script text-2xl text-primary">silencio bajo la luna</p>
              <p className="mt-1 text-sm text-muted-foreground">
                Aún no hay mensajes. Envía el primero.
              </p>
            </div>
          </div>
        ) : (
          dayGroups.map((group) => (
            <div key={group.label + group.messages[0].id} className="space-y-1">
              <div className="flex items-center justify-center py-2">
                <span className="inline-flex items-center rounded-full border border-border/50 bg-card/60 px-3 py-1 text-[10px] uppercase tracking-[0.16em] text-muted-foreground">
                  {group.label}
                </span>
              </div>
              {group.messages.map((message) => {
                const mine = message.senderId === viewerId;
                return (
                  <div key={message.id} className={cn("flex", mine ? "justify-end" : "justify-start")}>
                    <div
                      className={cn(
                        "max-w-[78%] rounded-2xl px-3.5 py-2 text-sm leading-relaxed sm:max-w-[65%]",
                        mine
                          ? "rounded-br-none bg-primary text-primary-foreground"
                          : "rounded-bl-none border border-border/60 bg-muted/60 text-foreground",
                      )}
                    >
                      <p className="whitespace-pre-wrap break-words">{message.content}</p>
                      <p
                        className={cn(
                          "mt-1 text-right text-[10px] tabular-nums",
                          mine ? "text-primary-foreground/70" : "text-muted-foreground",
                        )}
                      >
                        {formatTime(message.createdAt)}
                      </p>
                    </div>
                  </div>
                );
              })}
            </div>
          ))
        )}
      </div>

      {error ? (
        <div className="shrink-0 border-t border-border/50 bg-destructive/10 px-4 py-2 text-xs text-destructive">
          {error.message}
        </div>
      ) : null}

      <form
        ref={formRef}
        onSubmit={handleSend}
        className="flex shrink-0 items-end gap-2 border-t border-border/50 px-3 py-3 sm:px-4"
      >
        <Textarea
          value={content}
          onChange={(e) => setContent(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="Escribe un mensaje…"
          rows={1}
          maxLength={2000}
          disabled={!!error}
          aria-label="Tu mensaje"
          className="min-h-[44px] max-h-32 resize-none"
        />
        <Button
          type="submit"
          size="icon"
          disabled={sending || !content.trim() || !!error}
          aria-label="Enviar mensaje"
        >
          {sending ? <Loader2 className="h-4 w-4 animate-spin" /> : <SendHorizontal className="h-4 w-4" />}
        </Button>
      </form>

      <ReportDialog
        open={reportOpen}
        onOpenChange={setReportOpen}
        targetUserId={otherUser.id}
        targetUserName={displayName}
        onBlocked={() => router.push("/mensajes")}
      />
    </Card>
  );
}
