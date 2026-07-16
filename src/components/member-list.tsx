"use client";

import * as React from "react";
import Link from "next/link";
import { Search, Users } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { FollowButton } from "@/components/follow-button";
import { routes } from "@/lib/routes";
import { getInitials } from "@/lib/utils";

export interface MemberRow {
  id: string;
  name: string | null;
  email: string | null;
  image: string | null;
  isFollowing: boolean;
  booksInCommon: number;
  readingTitle: string | null;
  isNew: boolean;
  /** Afinidad >=70 con evidencia real (contrato: nunca con datos vacíos). */
  veryAffine: boolean;
}

interface MemberListProps {
  rows: MemberRow[];
}

export function MemberList({ rows }: MemberListProps) {
  const [query, setQuery] = React.useState("");

  const filtered = React.useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return rows;
    return rows.filter((r) => {
      const haystack = [r.name ?? "", r.email ?? ""].join(" ").toLowerCase();
      return haystack.includes(q);
    });
  }, [rows, query]);

  if (rows.length === 0) {
    return (
      <Card className="p-8 text-center">
        <Users className="mx-auto h-6 w-6 text-primary/60" />
        <p className="mt-2 hand-script text-2xl">aún no hay más miembros</p>
        <p className="mt-1 text-sm text-muted-foreground">
          Cuando alguien más se una al club, aparecerá aquí.
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
          placeholder="Buscar por nombre o correo…"
          className="h-9 pl-9"
          aria-label="Buscar miembro"
        />
      </div>

      {filtered.length === 0 ? (
        <p className="py-6 text-center text-sm text-muted-foreground">
          Nada coincide con "{query}".
        </p>
      ) : (
        <ul className="divide-y divide-border/40 rounded-xl border border-border/40 bg-card/40">
          {filtered.map((m) => (
            <li key={m.id} className="flex items-center gap-3 px-3 py-3 sm:px-4">
              <Link href={routes.persona(m.id)} className="focus-ring shrink-0 rounded-full">
                <Avatar className="h-9 w-9">
                  {m.image ? <AvatarImage src={m.image} alt="" /> : null}
                  <AvatarFallback className="text-xs">{getInitials(m.name, m.email)}</AvatarFallback>
                </Avatar>
              </Link>
              <div className="min-w-0 flex-1">
                <div className="flex min-w-0 items-center gap-2">
                  <Link href={routes.persona(m.id)} className="focus-ring min-w-0 rounded-sm">
                    <p className="truncate text-sm font-medium hover:text-primary transition-colors">
                      {m.name ?? m.email?.split("@")[0]}
                    </p>
                  </Link>
                  {m.veryAffine ? (
                    <Badge variant="gold" className="shrink-0">
                      Muy afín
                    </Badge>
                  ) : null}
                </div>
                <p className="truncate text-xs text-muted-foreground">{contextLine(m)}</p>
              </div>
              <FollowButton userId={m.id} initialFollowing={m.isFollowing} className="shrink-0" />
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function contextLine(m: MemberRow): string {
  const parts: string[] = [];
  if (m.readingTitle) parts.push(`Leyendo ${m.readingTitle}`);
  if (m.booksInCommon > 0) {
    parts.push(`${m.booksInCommon} libro${m.booksInCommon === 1 ? "" : "s"} en común`);
  }
  if (m.isNew) parts.push("Se unió esta semana");
  return parts.length ? parts.join(" · ") : "Miembro del club";
}
