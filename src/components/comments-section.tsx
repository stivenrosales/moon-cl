"use client";

import * as React from "react";
import { Eye, EyeOff, Loader2, MessageCircle, Reply, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Label, Field } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { postComment, deleteComment, moderateComment } from "@/server/actions/comments";
import { cn, getInitials, relativeTime } from "@/lib/utils";

export interface CommentNode {
  id: string;
  content: string;
  isSpoiler: boolean;
  chapter: number | null;
  createdAt: Date;
  deletedAt: Date | null;
  user: {
    id: string;
    name: string | null;
    email: string | null;
    image: string | null;
  };
  replies: CommentNode[];
}

interface CommentsSectionProps {
  bookId: string;
  comments: CommentNode[];
  currentUserId: string;
  isModerator: boolean;
}

export function CommentsSection({ bookId, comments, currentUserId, isModerator }: CommentsSectionProps) {
  return (
    <div className="space-y-6">
      <CommentComposer bookId={bookId} />

      {comments.length === 0 ? (
        <EmptyComments />
      ) : (
        <ul className="space-y-3">
          {comments.map((c) => (
            <CommentItem
              key={c.id}
              bookId={bookId}
              comment={c}
              currentUserId={currentUserId}
              isModerator={isModerator}
            />
          ))}
        </ul>
      )}
    </div>
  );
}

function EmptyComments() {
  return (
    <div className="rounded-2xl border border-dashed border-border/60 bg-card/30 p-8 text-center">
      <p className="hand-script text-2xl text-primary">silencio bajo la luna</p>
      <p className="mt-2 text-sm text-muted-foreground">
        Sé la primera en compartir una impresión.
      </p>
    </div>
  );
}

function CommentComposer({
  bookId,
  parentId,
  onDone,
  onCancel,
  autoFocus,
}: {
  bookId: string;
  parentId?: string;
  onDone?: () => void;
  onCancel?: () => void;
  autoFocus?: boolean;
}) {
  const [content, setContent] = React.useState("");
  const [chapter, setChapter] = React.useState<string>("");
  const [isSpoiler, setIsSpoiler] = React.useState(false);
  const [submitting, setSubmitting] = React.useState(false);
  const isReply = !!parentId;

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!content.trim()) return;
    setSubmitting(true);
    try {
      await postComment({
        bookId,
        parentId: parentId ?? null,
        content,
        isSpoiler,
        chapter: chapter ? Number(chapter) : null,
      });
      toast.success(isReply ? "Respuesta publicada" : "Comentario publicado");
      setContent("");
      setChapter("");
      setIsSpoiler(false);
      onDone?.();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Error");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <form
      onSubmit={onSubmit}
      className={cn(
        "space-y-3 rounded-2xl border bg-card/40 p-3 sm:p-4",
        isReply ? "border-primary/30 bg-primary/[0.04]" : "border-border/60",
      )}
    >
      <Textarea
        value={content}
        onChange={(e) => setContent(e.target.value)}
        placeholder={
          isReply
            ? "Tu respuesta…"
            : "Comparte una impresión, una cita, una pregunta…"
        }
        maxLength={4000}
        rows={2}
        autoFocus={autoFocus}
        aria-label={isReply ? "Tu respuesta" : "Tu comentario"}
        className="min-h-[68px]"
      />

      <div className="flex flex-wrap items-center gap-2">
        <Input
          id={`chapter-${parentId ?? "root"}`}
          type="number"
          inputMode="numeric"
          min={1}
          max={9999}
          value={chapter}
          onChange={(e) => setChapter(e.target.value)}
          placeholder="Cap."
          aria-label="Capítulo (opcional)"
          className="h-9 w-[72px] text-center text-sm"
        />

        <Checkbox
          checked={isSpoiler}
          onChange={(e) => setIsSpoiler(e.currentTarget.checked)}
          label="Spoiler"
        />

        <div className="ml-auto flex items-center gap-1.5">
          {onCancel ? (
            <Button type="button" variant="ghost" size="sm" onClick={onCancel}>
              Cancelar
            </Button>
          ) : null}
          <Button type="submit" disabled={submitting || !content.trim()} size="sm">
            {submitting ? (
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
            ) : (
              <MessageCircle className="h-3.5 w-3.5" />
            )}
            {isReply ? "Responder" : "Publicar"}
          </Button>
        </div>
      </div>
    </form>
  );
}

function CommentItem({
  bookId,
  comment,
  currentUserId,
  isModerator,
  isReply = false,
}: {
  bookId: string;
  comment: CommentNode;
  currentUserId: string;
  isModerator: boolean;
  isReply?: boolean;
}) {
  const [replying, setReplying] = React.useState(false);
  const [revealed, setRevealed] = React.useState(false);
  const [pending, setPending] = React.useState(false);

  const canDelete = comment.user.id === currentUserId || isModerator;
  const isDeleted = !!comment.deletedAt;
  const showSpoilerOverlay = comment.isSpoiler && !revealed && !isDeleted;

  async function onDelete() {
    if (!confirm("¿Borrar comentario?")) return;
    setPending(true);
    try {
      await deleteComment(comment.id);
      toast.success("Comentario borrado");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Error");
    } finally {
      setPending(false);
    }
  }

  async function toggleSpoiler() {
    setPending(true);
    try {
      await moderateComment(comment.id, comment.isSpoiler ? "unspoiler" : "spoiler");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Error");
    } finally {
      setPending(false);
    }
  }

  return (
    <li className={cn("group", isReply && "ml-5 sm:ml-10")}>
      <article
        className={cn(
          "rounded-2xl border bg-card/50 p-3.5 sm:p-4 transition-colors",
          isReply
            ? "border-border/40 bg-card/30"
            : "border-border/60",
        )}
      >
        <header className="flex items-start gap-2.5">
          <Avatar className={cn(isReply ? "h-7 w-7" : "h-8 w-8", "shrink-0")}>
            {comment.user.image ? <AvatarImage src={comment.user.image} alt="" /> : null}
            <AvatarFallback className={isReply ? "text-[10px]" : "text-[11px]"}>
              {getInitials(comment.user.name, comment.user.email)}
            </AvatarFallback>
          </Avatar>
          <div className="flex-1 min-w-0">
            <div className="flex flex-wrap items-baseline gap-x-2 gap-y-0.5">
              <span className="text-sm font-medium leading-snug">
                {comment.user.name ?? comment.user.email?.split("@")[0]}
              </span>
              <span className="text-[10px] uppercase tracking-[0.16em] text-muted-foreground/70">
                {relativeTime(comment.createdAt)}
              </span>
              {comment.chapter ? (
                <Badge variant="outline" className="text-[9px] py-0">Cap. {comment.chapter}</Badge>
              ) : null}
              {comment.isSpoiler && !isDeleted ? (
                <Badge variant="default" className="text-[9px] py-0">Spoiler</Badge>
              ) : null}
            </div>

            <div className="relative mt-1.5">
              <p
                className={cn(
                  "whitespace-pre-wrap text-sm leading-relaxed",
                  showSpoilerOverlay && "blur-md select-none",
                  isDeleted && "italic text-muted-foreground",
                )}
              >
                {comment.content}
              </p>
              {showSpoilerOverlay ? (
                <button
                  type="button"
                  onClick={() => setRevealed(true)}
                  className="absolute inset-0 flex items-center justify-center gap-2 rounded-lg bg-background/50 backdrop-blur-sm hover:bg-background/70 transition-colors group/spoiler"
                >
                  <Eye className="h-4 w-4 text-primary group-hover/spoiler:scale-110 transition-transform" />
                  <span className="text-xs text-primary font-medium">
                    Revelar spoiler
                  </span>
                </button>
              ) : null}
            </div>
          </div>
        </header>

        {!isDeleted ? (
          <footer className="mt-2.5 -ml-2 flex items-center gap-0 text-xs text-muted-foreground">
            {!isReply ? (
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setReplying((v) => !v)}
                className="h-8 px-2 text-muted-foreground hover:text-foreground"
                aria-pressed={replying}
              >
                <Reply className="h-3.5 w-3.5" />
                {replying ? "Cancelar" : "Responder"}
              </Button>
            ) : null}
            {isModerator ? (
              <Button
                variant="ghost"
                size="sm"
                onClick={toggleSpoiler}
                disabled={pending}
                className="h-8 px-2 text-muted-foreground hover:text-foreground"
              >
                {comment.isSpoiler ? (
                  <>
                    <EyeOff className="h-3.5 w-3.5" /> Quitar spoiler
                  </>
                ) : (
                  <>
                    <Eye className="h-3.5 w-3.5" /> Marcar spoiler
                  </>
                )}
              </Button>
            ) : null}
            {canDelete ? (
              <Button
                variant="ghost"
                size="sm"
                onClick={onDelete}
                disabled={pending}
                className="h-8 px-2 text-muted-foreground hover:text-destructive"
              >
                <Trash2 className="h-3.5 w-3.5" />
                Borrar
              </Button>
            ) : null}
          </footer>
        ) : null}

        {replying && !isReply ? (
          <div className="mt-3">
            <CommentComposer
              bookId={bookId}
              parentId={comment.id}
              onDone={() => setReplying(false)}
              onCancel={() => setReplying(false)}
              autoFocus
            />
          </div>
        ) : null}
      </article>

      {comment.replies.length > 0 ? (
        <ul className="mt-3 space-y-3">
          {comment.replies.map((r) => (
            <CommentItem
              key={r.id}
              bookId={bookId}
              comment={r}
              currentUserId={currentUserId}
              isModerator={isModerator}
              isReply
            />
          ))}
        </ul>
      ) : null}
    </li>
  );
}
