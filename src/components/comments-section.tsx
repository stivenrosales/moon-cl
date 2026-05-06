"use client";

import * as React from "react";
import { Eye, EyeOff, Loader2, MessageCircle, Reply, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
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
        <p className="rounded-2xl border border-border/60 bg-card/40 p-8 text-center text-sm text-muted-foreground">
          Sé la primera en comentar.
        </p>
      ) : (
        <ul className="space-y-4">
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

function CommentComposer({
  bookId,
  parentId,
  onDone,
}: {
  bookId: string;
  parentId?: string;
  onDone?: () => void;
}) {
  const [content, setContent] = React.useState("");
  const [chapter, setChapter] = React.useState<string>("");
  const [isSpoiler, setIsSpoiler] = React.useState(false);
  const [submitting, setSubmitting] = React.useState(false);

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
      toast.success(parentId ? "Respuesta publicada" : "Comentario publicado");
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
    <form onSubmit={onSubmit} className="space-y-3 rounded-2xl border border-border/60 bg-card/50 p-4">
      <Textarea
        value={content}
        onChange={(e) => setContent(e.target.value)}
        placeholder={parentId ? "Tu respuesta..." : "Comparte una impresión, una cita, una pregunta..."}
        maxLength={4000}
        rows={parentId ? 2 : 3}
      />
      <div className="flex flex-wrap items-end gap-3">
        <div className="space-y-1.5">
          <Label htmlFor={`chapter-${parentId ?? "root"}`}>Capítulo</Label>
          <Input
            id={`chapter-${parentId ?? "root"}`}
            type="number"
            min={1}
            value={chapter}
            onChange={(e) => setChapter(e.target.value)}
            placeholder="—"
            className="w-24"
          />
        </div>
        <label className="inline-flex items-center gap-2 text-xs uppercase tracking-[0.18em] text-muted-foreground select-none cursor-pointer">
          <input
            type="checkbox"
            checked={isSpoiler}
            onChange={(e) => setIsSpoiler(e.target.checked)}
            className="h-4 w-4 accent-primary"
          />
          Marcar como spoiler
        </label>
        <Button type="submit" disabled={submitting} size="sm" className="ml-auto">
          {submitting ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <MessageCircle className="h-3.5 w-3.5" />}
          {parentId ? "Responder" : "Comentar"}
        </Button>
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
    <li className={cn("group", isReply && "ml-6 md:ml-10")}>
      <article className="rounded-2xl border border-border/60 bg-card/50 p-4">
        <header className="flex items-start gap-3">
          <Avatar className="h-8 w-8 shrink-0">
            {comment.user.image ? <AvatarImage src={comment.user.image} alt="" /> : null}
            <AvatarFallback>{getInitials(comment.user.name, comment.user.email)}</AvatarFallback>
          </Avatar>
          <div className="flex-1 min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-sm font-medium">{comment.user.name ?? comment.user.email?.split("@")[0]}</span>
              <span className="text-[10px] uppercase tracking-[0.18em] text-muted-foreground">
                {relativeTime(comment.createdAt)}
              </span>
              {comment.chapter ? (
                <Badge variant="outline">Cap. {comment.chapter}</Badge>
              ) : null}
              {comment.isSpoiler && !isDeleted ? (
                <Badge variant="default">Spoiler</Badge>
              ) : null}
            </div>

            <div className="relative mt-2">
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
                  className="absolute inset-0 flex items-center justify-center bg-background/30 backdrop-blur-sm rounded-md text-xs uppercase tracking-[0.22em] text-primary hover:bg-background/50 transition-colors"
                >
                  <Eye className="mr-2 h-3.5 w-3.5" />
                  Revelar spoiler
                </button>
              ) : null}
            </div>
          </div>
        </header>

        {!isDeleted ? (
          <footer className="mt-3 flex items-center gap-1 text-xs text-muted-foreground">
            {!isReply ? (
              <Button variant="ghost" size="sm" onClick={() => setReplying((v) => !v)}>
                <Reply className="h-3.5 w-3.5" />
                Responder
              </Button>
            ) : null}
            {isModerator ? (
              <Button variant="ghost" size="sm" onClick={toggleSpoiler} disabled={pending}>
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
                className="hover:text-destructive"
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
