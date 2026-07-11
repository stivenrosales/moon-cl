"use client";

import * as React from "react";
import Link from "next/link";
import { Inbox, Search } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { cn, formatTime, getInitials } from "@/lib/utils";

export interface ConversationRow {
  otherUserId: string;
  otherUser: { id: string; name: string | null; image: string | null } | null;
  lastMessage: { content: string; createdAt: string; senderId: string };
  unreadCount: number;
}

interface ConversationListProps {
  rows: ConversationRow[];
  viewerId: string;
}

export function ConversationList({ rows, viewerId }: ConversationListProps) {
  const [query, setQuery] = React.useState("");

  const filtered = React.useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return rows;
    return rows.filter((r) => (r.otherUser?.name ?? "").toLowerCase().includes(q));
  }, [rows, query]);

  if (rows.length === 0) {
    return (
      <Card className="p-8 text-center">
        <Inbox className="mx-auto h-6 w-6 text-primary/60" />
        <p className="mt-2 hand-script text-2xl">aún no tienes conversaciones</p>
        <p className="mt-1 text-sm text-muted-foreground">
          Encuentra lectores en{" "}
          <Link href="/miembros" className="text-primary hover:underline">
            Miembros
          </Link>
          .
        </p>
      </Card>
    );
  }

  return (
    <div className="space-y-3">
      <div className="relative">
        <Search className="pointer-events-none absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
        <Input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Buscar conversación…"
          className="h-9 pl-9"
          aria-label="Buscar conversación"
        />
      </div>

      {filtered.length === 0 ? (
        <p className="py-6 text-center text-sm text-muted-foreground">
          Nada coincide con "{query}".
        </p>
      ) : (
        <ul className="divide-y divide-border/40 rounded-xl border border-border/40 bg-card/40">
          {filtered.map((row) => {
            const name = row.otherUser?.name ?? "Usuario";
            const mine = row.lastMessage.senderId === viewerId;
            return (
              <li key={row.otherUserId}>
                <Link
                  href={`/mensajes/${row.otherUserId}`}
                  className="flex items-center gap-3 px-3 py-3 sm:px-4 hover:bg-muted/40 transition-colors focus-ring"
                >
                  <Avatar className="h-10 w-10 shrink-0">
                    {row.otherUser?.image ? <AvatarImage src={row.otherUser.image} alt="" /> : null}
                    <AvatarFallback className="text-xs">
                      {getInitials(row.otherUser?.name, null)}
                    </AvatarFallback>
                  </Avatar>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <p
                        className={cn(
                          "truncate text-sm",
                          row.unreadCount > 0
                            ? "font-semibold text-foreground"
                            : "font-medium text-foreground",
                        )}
                      >
                        {name}
                      </p>
                      <span className="ml-auto shrink-0 text-[11px] tabular-nums text-muted-foreground">
                        {conversationTimeLabel(row.lastMessage.createdAt)}
                      </span>
                    </div>
                    <div className="mt-0.5 flex items-center gap-2">
                      <p className="min-w-0 flex-1 truncate text-xs text-muted-foreground">
                        {mine ? "Tú: " : ""}
                        {row.lastMessage.content}
                      </p>
                      {row.unreadCount > 0 ? (
                        <span aria-hidden className="h-2 w-2 shrink-0 rounded-full bg-accent" />
                      ) : null}
                    </div>
                  </div>
                </Link>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}

function conversationTimeLabel(iso: string): string {
  const date = new Date(iso);
  const now = new Date();
  const isToday = date.toDateString() === now.toDateString();
  if (isToday) return formatTime(date);
  const sameYear = date.getFullYear() === now.getFullYear();
  return new Intl.DateTimeFormat(
    "es-ES",
    sameYear ? { day: "numeric", month: "short" } : { day: "numeric", month: "short", year: "numeric" },
  ).format(date);
}
