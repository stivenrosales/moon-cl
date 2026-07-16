"use client";

import * as React from "react";
import Link from "next/link";
import { Crown, Search } from "lucide-react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Input } from "@/components/ui/input";
import { BookCover } from "@/components/book-cover";
import { VoteButton } from "@/components/vote-button";
import { ChooseWinnerButton } from "@/components/admin/choose-winner-button";
import { DeleteSuggestionButton } from "@/components/delete-suggestion-button";
import { routes } from "@/lib/routes";
import { cn, getInitials } from "@/lib/utils";

export interface SuggestionRow {
  id: string;
  bookId: string;
  pitch: string | null;
  userId: string;
  votes: { userId: string }[];
  voteCount: number;
  book: {
    id: string;
    title: string;
    authors: string[];
    coverUrl: string | null;
    publishedYear: number | null;
  };
  user: {
    id: string;
    name: string | null;
    email: string | null;
    image: string | null;
  };
}

interface Props {
  suggestions: SuggestionRow[];
  currentUserId: string;
  isAdmin: boolean;
  canVote: boolean;
  winnerBookId: string | null;
}

export function RoundSuggestionsList({
  suggestions,
  currentUserId,
  isAdmin,
  canVote,
  winnerBookId,
}: Props) {
  const [query, setQuery] = React.useState("");

  const filtered = React.useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return suggestions;
    return suggestions.filter((s) => {
      const haystack = [
        s.book.title,
        s.book.authors.join(" "),
        s.user.name ?? "",
        s.user.email ?? "",
      ]
        .join(" ")
        .toLowerCase();
      return haystack.includes(q);
    });
  }, [suggestions, query]);

  const showSearch = suggestions.length >= 6;

  return (
    <div className="space-y-3">
      {showSearch ? (
        <div className="relative">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Buscar por título, autor o quién sugirió…"
            className="h-9 pl-9"
            aria-label="Buscar sugerencia"
          />
          {query ? (
            <span className="absolute right-3 top-1/2 -translate-y-1/2 text-[10px] uppercase tracking-[0.2em] text-muted-foreground">
              {filtered.length} de {suggestions.length}
            </span>
          ) : null}
        </div>
      ) : null}

      {filtered.length === 0 ? (
        <p className="py-6 text-center text-sm text-muted-foreground">
          Nada coincide con "{query}".
        </p>
      ) : (
        <ul className="divide-y divide-border/40 rounded-xl border border-border/40 bg-card/40">
          {filtered.map((s, idx) => {
            const userVoted = s.votes.some((v) => v.userId === currentUserId);
            const isOwner = s.userId === currentUserId;
            const isWinner = winnerBookId === s.bookId;
            const realIdx = suggestions.indexOf(s);

            return (
              <li
                key={s.id}
                className={cn(
                  "px-3 py-3 sm:px-4",
                  isWinner && "bg-accent/5",
                )}
              >
                <div className="flex gap-3 items-start">
                  <span className="hidden sm:inline-flex w-7 shrink-0 items-center justify-center pt-1 text-xs uppercase tracking-[0.2em] text-muted-foreground tabular-nums">
                    {String(realIdx + 1).padStart(2, "0")}
                  </span>

                  <Link
                    href={routes.libro(s.book.id)}
                    className="shrink-0 focus-ring rounded-md"
                    aria-label={`Ver ${s.book.title}`}
                  >
                    <BookCover src={s.book.coverUrl} title={s.book.title} size="sm" />
                  </Link>

                  <div className="flex-1 min-w-0">
                    <div className="flex items-baseline gap-2 min-w-0">
                      <Link
                        href={routes.libro(s.book.id)}
                        className="display text-base sm:text-lg leading-tight hover:text-primary transition-colors line-clamp-2 sm:line-clamp-1"
                      >
                        {s.book.title}
                      </Link>
                      {isWinner ? (
                        <Crown className="h-3.5 w-3.5 text-accent-text shrink-0" />
                      ) : null}
                    </div>
                    <p className="text-xs text-muted-foreground line-clamp-1 mt-0.5">
                      {s.book.authors.join(", ") || "Autor desconocido"}
                      {s.book.publishedYear ? ` · ${s.book.publishedYear}` : ""}
                    </p>
                    {s.pitch ? (
                      <p className="text-[11px] italic text-muted-foreground/85 line-clamp-2 sm:line-clamp-1 mt-0.5">
                        "{s.pitch}"
                      </p>
                    ) : null}
                    <div className="mt-1.5 flex items-center gap-1.5">
                      <Avatar className="h-4 w-4">
                        {s.user.image ? <AvatarImage src={s.user.image} alt="" /> : null}
                        <AvatarFallback className="text-[8px]">
                          {getInitials(s.user.name, s.user.email)}
                        </AvatarFallback>
                      </Avatar>
                      <span className="text-[10px] uppercase tracking-[0.16em] text-muted-foreground truncate">
                        {s.user.name ?? s.user.email?.split("@")[0]}
                      </span>
                    </div>
                  </div>

                  {/* Acciones en desktop: inline a la derecha */}
                  <div className="hidden sm:flex items-center gap-1.5 shrink-0">
                    <VoteButton
                      suggestionId={s.id}
                      initialVoted={userVoted}
                      initialCount={s.voteCount}
                      disabled={!canVote}
                    />
                    {isAdmin ? (
                      <ChooseWinnerButton
                        suggestionId={s.id}
                        bookTitle={s.book.title}
                        isAlreadyWinner={isWinner}
                      />
                    ) : null}
                    {(isOwner && canVote) || isAdmin ? (
                      <DeleteSuggestionButton suggestionId={s.id} />
                    ) : null}
                  </div>
                </div>

                {/* Acciones en mobile: fila propia abajo, alineadas a la derecha */}
                <div className="sm:hidden mt-2.5 flex items-center justify-end gap-1.5">
                  <VoteButton
                    suggestionId={s.id}
                    initialVoted={userVoted}
                    initialCount={s.voteCount}
                    disabled={!canVote}
                  />
                  {isAdmin ? (
                    <ChooseWinnerButton
                      suggestionId={s.id}
                      bookTitle={s.book.title}
                      isAlreadyWinner={isWinner}
                    />
                  ) : null}
                  {(isOwner && canVote) || isAdmin ? (
                    <DeleteSuggestionButton suggestionId={s.id} />
                  ) : null}
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
