"use client";

import * as React from "react";
import Link from "next/link";
import { Heart, Loader2, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { BookCover } from "@/components/book-cover";
import { toggleQuoteLike, deleteQuote } from "@/server/actions/quotes";
import { cn, getInitials, relativeTime } from "@/lib/utils";

export interface QuoteCardData {
  id: string;
  content: string;
  page: number | null;
  chapter: number | null;
  createdAt: Date;
  likeCount: number;
  likedByViewer: boolean;
  book: { id: string; title: string; coverUrl: string | null };
  user: { id: string; name: string | null; email: string | null; image: string | null };
}

interface QuoteCardProps {
  quote: QuoteCardData;
  currentUserId: string;
  isModerator: boolean;
}

export function QuoteCard({ quote, currentUserId, isModerator }: QuoteCardProps) {
  const [liked, setLiked] = React.useState(quote.likedByViewer);
  const [count, setCount] = React.useState(quote.likeCount);
  const [likePending, setLikePending] = React.useState(false);
  const [deletePending, setDeletePending] = React.useState(false);
  const [deleted, setDeleted] = React.useState(false);

  const canDelete = quote.user.id === currentUserId || isModerator;

  async function onToggleLike() {
    setLikePending(true);
    const next = !liked;
    setLiked(next);
    setCount((c) => c + (next ? 1 : -1));
    try {
      await toggleQuoteLike(quote.id);
    } catch (err) {
      setLiked(!next);
      setCount((c) => c + (next ? -1 : 1));
      toast.error(err instanceof Error ? err.message : "Error");
    } finally {
      setLikePending(false);
    }
  }

  async function onDelete() {
    if (!confirm("¿Borrar esta frase?")) return;
    setDeletePending(true);
    try {
      await deleteQuote(quote.id);
      setDeleted(true);
      toast.success("Frase borrada");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Error");
    } finally {
      setDeletePending(false);
    }
  }

  if (deleted) return null;

  const location = [quote.chapter ? `cap. ${quote.chapter}` : null, quote.page ? `pág. ${quote.page}` : null]
    .filter(Boolean)
    .join(" · ");

  return (
    <article className="rounded-2xl border border-border/50 bg-card/60 p-4 sm:p-5 space-y-3.5">
      <p className="display italic text-lg sm:text-xl leading-snug text-foreground/90 break-words">
        &ldquo;{quote.content}&rdquo;
      </p>

      <div className="flex items-center gap-2.5 min-w-0">
        <Link href={`/libros/${quote.book.id}`} className="shrink-0 focus-ring rounded-md">
          <BookCover src={quote.book.coverUrl} title={quote.book.title} size="sm" />
        </Link>
        <div className="min-w-0 flex-1">
          <Link
            href={`/libros/${quote.book.id}`}
            className="text-sm font-medium leading-snug hover:text-primary transition-colors line-clamp-1"
          >
            {quote.book.title}
          </Link>
          {location ? (
            <p className="text-[10px] uppercase tracking-[0.16em] text-muted-foreground">{location}</p>
          ) : null}
        </div>
      </div>

      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2 min-w-0">
          <Avatar className="h-5 w-5">
            {quote.user.image ? <AvatarImage src={quote.user.image} alt="" /> : null}
            <AvatarFallback className="text-[8px]">
              {getInitials(quote.user.name, quote.user.email)}
            </AvatarFallback>
          </Avatar>
          <span className="text-xs text-muted-foreground truncate">
            {quote.user.name ?? quote.user.email?.split("@")[0]} · {relativeTime(quote.createdAt)}
          </span>
        </div>

        <div className="flex items-center gap-1 shrink-0">
          {canDelete ? (
            <button
              type="button"
              onClick={onDelete}
              disabled={deletePending}
              aria-label="Borrar frase"
              className="inline-flex items-center justify-center rounded-full p-1.5 text-muted-foreground hover:text-destructive transition-colors disabled:opacity-50"
            >
              <Trash2 className="h-3.5 w-3.5" />
            </button>
          ) : null}
          <button
            type="button"
            onClick={onToggleLike}
            disabled={likePending}
            aria-pressed={liked}
            aria-label={liked ? "Quitar me gusta" : "Me gusta"}
            className="inline-flex items-center gap-1 rounded-full px-2 py-1 text-xs transition-colors disabled:opacity-50 hover:bg-muted/60"
          >
            {likePending ? (
              <Loader2 className="h-3.5 w-3.5 animate-spin text-muted-foreground" />
            ) : (
              <Heart
                className={cn(
                  "h-3.5 w-3.5",
                  liked ? "fill-accent-text text-accent-text" : "text-muted-foreground",
                )}
              />
            )}
            <span className={cn("tabular-nums", liked ? "text-accent-text" : "text-muted-foreground")}>
              {count}
            </span>
          </button>
        </div>
      </div>
    </article>
  );
}
