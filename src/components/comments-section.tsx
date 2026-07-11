"use client";

import * as React from "react";
import {
  Eye,
  EyeOff,
  Loader2,
  Lock,
  MessageCircle,
  Pencil,
  Reply,
  Trash2,
} from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import { Select } from "@/components/ui/select";
import { Card } from "@/components/ui/card";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { postComment, deleteComment, moderateComment, revealComment } from "@/server/actions/comments";
import { useGoToBookTab } from "@/components/book-tabs-provider";
import { cn, getInitials, relativeTime } from "@/lib/utils";
import type { GateReason } from "@/server/services/comment-gating";

// ─────────────────────────────────────────────────────────────────────────
// Tipos — el gating real ocurre en el servidor (libros/[id]/page.tsx +
// comment-gating.ts). El cliente solo recibe la forma ya decidida: un
// comentario abierto trae `content`, uno bloqueado trae `reason` en su
// lugar y jamás el texto real hasta que se pide explícitamente con
// revealComment (id).
// ─────────────────────────────────────────────────────────────────────────

interface CommentAuthor {
  id: string;
  name: string | null;
  email: string | null;
  image: string | null;
}

interface CommentNodeBase {
  id: string;
  chapter: number | null;
  isSpoiler: boolean;
  isReflection: boolean;
  createdAt: Date;
  user: CommentAuthor;
  replies: CommentNode[];
}

export interface UnlockedCommentNode extends CommentNodeBase {
  locked: false;
  content: string;
  deletedAt: Date | null;
}

export interface LockedCommentNode extends CommentNodeBase {
  locked: true;
  reason: GateReason;
}

export type CommentNode = UnlockedCommentNode | LockedCommentNode;

interface CommentsSectionProps {
  bookId: string;
  comments: CommentNode[];
  currentUserId: string;
  isModerator: boolean;
  myChapter: number;
  hasFinishedBook: boolean;
}

// ─────────────────────────────────────────────────────────────────────────
// Salas — se agrupan los comentarios raíz por capítulo declarado. La sala
// de reflexión es siempre visible (para que se sepa que existe) pero solo
// se abre al terminar el libro. La sala de mi capítulo actual siempre
// existe (aunque esté vacía) para que el composer aterrice ahí por
// defecto.
// ─────────────────────────────────────────────────────────────────────────

interface Room {
  key: string;
  label: string;
  kind: "general" | "chapter" | "reflection";
  chapter: number | null;
  count: number;
  locked: boolean;
  comments: CommentNode[];
}

function buildRooms(
  comments: CommentNode[],
  myChapter: number,
  isModerator: boolean,
  hasFinishedBook: boolean,
): Room[] {
  const chapterBuckets = new Map<number, CommentNode[]>();
  const general: CommentNode[] = [];
  const reflection: CommentNode[] = [];

  for (const c of comments) {
    if (c.isReflection) {
      reflection.push(c);
    } else if (c.chapter != null) {
      const bucket = chapterBuckets.get(c.chapter) ?? [];
      bucket.push(c);
      chapterBuckets.set(c.chapter, bucket);
    } else {
      general.push(c);
    }
  }

  if (myChapter > 0 && !chapterBuckets.has(myChapter)) {
    chapterBuckets.set(myChapter, []);
  }

  const rooms: Room[] = [
    {
      key: "general",
      label: "General",
      kind: "general",
      chapter: null,
      count: general.length,
      locked: false,
      comments: general,
    },
  ];

  const chapters = Array.from(chapterBuckets.keys()).sort((a, b) => a - b);
  for (const chapter of chapters) {
    rooms.push({
      key: `chapter:${chapter}`,
      label: `Capítulo ${chapter}`,
      kind: "chapter",
      chapter,
      count: chapterBuckets.get(chapter)?.length ?? 0,
      locked: !isModerator && chapter > myChapter,
      comments: chapterBuckets.get(chapter) ?? [],
    });
  }

  rooms.push({
    key: "reflection",
    label: "Sala de reflexión",
    kind: "reflection",
    chapter: null,
    count: reflection.length,
    locked: !isModerator && !hasFinishedBook,
    comments: reflection,
  });

  return rooms;
}

function collectIds(nodes: CommentNode[]): string[] {
  const ids: string[] = [];
  for (const n of nodes) {
    ids.push(n.id);
    if (n.replies.length) ids.push(...collectIds(n.replies));
  }
  return ids;
}

export function CommentsSection({
  bookId,
  comments,
  currentUserId,
  isModerator,
  myChapter,
  hasFinishedBook,
}: CommentsSectionProps) {
  const rooms = React.useMemo(
    () => buildRooms(comments, myChapter, isModerator, hasFinishedBook),
    [comments, myChapter, isModerator, hasFinishedBook],
  );

  const defaultRoomKey = myChapter > 0 ? `chapter:${myChapter}` : "general";
  const [activeKey, setActiveKey] = React.useState(
    rooms.some((r) => r.key === defaultRoomKey) ? defaultRoomKey : "general",
  );
  const [revealedComments, setRevealedComments] = React.useState<Record<string, string>>({});
  const [revealedRooms, setRevealedRooms] = React.useState<Set<string>>(new Set());
  const [revealingRoom, setRevealingRoom] = React.useState(false);
  const goToTab = useGoToBookTab();

  const active = rooms.find((r) => r.key === activeKey) ?? rooms[0];
  const roomIsRevealed = revealedRooms.has(active.key);
  const totalComments = rooms.reduce((sum, r) => sum + r.count, 0);

  async function revealOne(id: string) {
    try {
      const result = await revealComment(id);
      setRevealedComments((prev) => ({ ...prev, [result.id]: result.content }));
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Error");
    }
  }

  async function revealRoom(room: Room) {
    setRevealingRoom(true);
    try {
      const ids = collectIds(room.comments);
      const results = await Promise.all(ids.map((id) => revealComment(id)));
      setRevealedComments((prev) => {
        const next = { ...prev };
        for (const r of results) next[r.id] = r.content;
        return next;
      });
      setRevealedRooms((prev) => new Set(prev).add(room.key));
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Error");
    } finally {
      setRevealingRoom(false);
    }
  }

  return (
    <div className="space-y-4">
      <ProgressBanner myChapter={myChapter} onEdit={() => goToTab?.("progress")} />

      <div className="flex items-center justify-between gap-3">
        <Select
          aria-label="Saltar de sala"
          value={active.key}
          onChange={(e) => setActiveKey(e.target.value)}
          className="w-auto min-w-[220px]"
        >
          {rooms.map((r) => (
            <option key={r.key} value={r.key}>
              {r.label} ({r.count})
            </option>
          ))}
        </Select>
        <span className="hidden text-xs text-muted-foreground sm:inline">
          {totalComments} comentario{totalComments === 1 ? "" : "s"} en total
        </span>
      </div>

      <Card
        className={cn(
          "p-4 sm:p-5",
          active.kind === "reflection" && "border-dashed",
        )}
      >
        <RoomHeader room={active} />

        {active.locked && !roomIsRevealed ? (
          <LockedRoom room={active} revealing={revealingRoom} onReveal={() => revealRoom(active)} />
        ) : (
          <div className="mt-4 space-y-4">
            {active.comments.length === 0 ? (
              <EmptyRoom kind={active.kind} />
            ) : (
              <ul className="divide-y divide-border/30">
                {active.comments.map((c) => (
                  <CommentItem
                    key={c.id}
                    bookId={bookId}
                    comment={c}
                    currentUserId={currentUserId}
                    isModerator={isModerator}
                    revealedContent={revealedComments}
                    onReveal={revealOne}
                  />
                ))}
              </ul>
            )}

            <RoomComposer
              bookId={bookId}
              room={active}
              hasFinishedBook={hasFinishedBook}
              isModerator={isModerator}
            />
          </div>
        )}
      </Card>
    </div>
  );
}

function ProgressBanner({ myChapter, onEdit }: { myChapter: number; onEdit: () => void }) {
  return (
    <div className="flex items-center justify-between gap-3 rounded-xl border border-border/40 bg-card/30 px-3 py-2">
      <span className="text-xs text-muted-foreground">
        {myChapter > 0 ? (
          <>
            Vas en el <span className="tabular-nums text-foreground">capítulo {myChapter}</span>
          </>
        ) : (
          "Aún no registras tu avance"
        )}
      </span>
      <button
        type="button"
        onClick={onEdit}
        title="Registrar tu avance abre las salas nuevas"
        className="inline-flex items-center gap-1 text-xs text-primary hover:underline"
      >
        <Pencil className="h-3 w-3" />
        Registrar avance
      </button>
    </div>
  );
}

function RoomHeader({ room }: { room: Room }) {
  return (
    <div className="flex items-center gap-2">
      <h3 className="display text-xl">{room.label}</h3>
      {room.kind === "reflection" ? (
        <span className="hand-script text-lg text-primary">spoilers totales</span>
      ) : null}
      {room.locked ? <Lock className="h-3.5 w-3.5 text-muted-foreground" /> : null}
    </div>
  );
}

function LockedRoom({
  room,
  revealing,
  onReveal,
}: {
  room: Room;
  revealing: boolean;
  onReveal: () => void;
}) {
  if (room.kind === "reflection") {
    return (
      <div className="mt-4 py-6 text-center">
        <p className="text-sm text-muted-foreground">
          Se abre cuando termines el libro. Marca tu lectura como terminada para entrar.
        </p>
      </div>
    );
  }

  return (
    <div className="mt-4 py-6 text-center space-y-3">
      <p className="text-sm text-muted-foreground">
        Llega al capítulo {room.chapter} para abrir esta sala.
      </p>
      <Button type="button" variant="outline" size="sm" onClick={onReveal} disabled={revealing}>
        {revealing ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Eye className="h-3.5 w-3.5" />}
        Leer igual
      </Button>
    </div>
  );
}

function EmptyRoom({ kind }: { kind: Room["kind"] }) {
  const copy =
    kind === "reflection"
      ? "Sé la primera en cerrar el libro con una reflexión."
      : "Sé la primera en comentar aquí.";
  return (
    <div className="py-8 text-center">
      <p className="hand-script text-2xl text-primary">silencio bajo la luna</p>
      <p className="mt-1 text-sm text-muted-foreground">{copy}</p>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────
// Composer — su comportamiento depende de la sala activa: en la sala de
// reflexión publica con isReflection sin pedir capítulo; en el resto
// publica con el capítulo de esa sala (fijo, no editable) salvo en
// General, donde no lleva capítulo.
// ─────────────────────────────────────────────────────────────────────────

function RoomComposer({
  bookId,
  room,
  hasFinishedBook,
  isModerator,
}: {
  bookId: string;
  room: Room;
  hasFinishedBook: boolean;
  isModerator: boolean;
}) {
  if (room.kind === "reflection" && !hasFinishedBook) {
    return (
      <p className="rounded-lg border border-dashed border-border/50 px-3 py-2.5 text-xs text-muted-foreground">
        Termina el libro para poder escribir en la sala de reflexión
        {isModerator ? " (esto aplica también a moderadores)" : ""}.
      </p>
    );
  }

  return (
    <Composer
      bookId={bookId}
      chapter={room.kind === "chapter" ? room.chapter : null}
      isReflection={room.kind === "reflection"}
    />
  );
}

function Composer({
  bookId,
  parentId,
  chapter,
  isReflection = false,
  onDone,
  onCancel,
  autoFocus,
}: {
  bookId: string;
  parentId?: string;
  chapter?: number | null;
  isReflection?: boolean;
  onDone?: () => void;
  onCancel?: () => void;
  autoFocus?: boolean;
}) {
  const [content, setContent] = React.useState("");
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
        isReflection: isReply ? false : isReflection,
        chapter: isReply ? null : chapter ?? null,
      });
      toast.success(isReply ? "Respuesta publicada" : "Comentario publicado");
      setContent("");
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
        "space-y-2.5 rounded-xl border p-2.5 sm:p-3",
        isReply ? "border-primary/25 bg-primary/[0.03]" : "border-border/40 bg-card/30",
      )}
    >
      <Textarea
        value={content}
        onChange={(e) => setContent(e.target.value)}
        placeholder={
          isReply
            ? "Tu respuesta…"
            : isReflection
              ? "Tu reflexión de cierre (spoilers totales permitidos)…"
              : "Comparte una impresión, una cita, una pregunta…"
        }
        maxLength={4000}
        rows={2}
        autoFocus={autoFocus}
        aria-label={isReply ? "Tu respuesta" : "Tu comentario"}
        className="min-h-[64px] border-0 bg-transparent px-2 py-1.5 focus-visible:ring-0"
      />

      <div className="flex flex-wrap items-center gap-2">
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
  revealedContent,
  onReveal,
  isReply = false,
}: {
  bookId: string;
  comment: CommentNode;
  currentUserId: string;
  isModerator: boolean;
  revealedContent: Record<string, string>;
  onReveal: (id: string) => Promise<void>;
  isReply?: boolean;
}) {
  const [replying, setReplying] = React.useState(false);
  const [revealing, setRevealing] = React.useState(false);
  const [pending, setPending] = React.useState(false);

  const canDelete = comment.user.id === currentUserId || isModerator;
  const isDeleted = !comment.locked && !!comment.deletedAt;
  const revealed = revealedContent[comment.id];
  const displayContent = comment.locked ? revealed : comment.content;

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

  async function handleReveal() {
    setRevealing(true);
    try {
      await onReveal(comment.id);
    } finally {
      setRevealing(false);
    }
  }

  return (
    <li className="py-3 first:pt-1 last:pb-1">
      <article className="flex gap-3">
        <Avatar className={cn("shrink-0", isReply ? "h-6 w-6" : "h-7 w-7")}>
          {comment.user.image ? <AvatarImage src={comment.user.image} alt="" /> : null}
          <AvatarFallback className={isReply ? "text-[9px]" : "text-[10px]"}>
            {getInitials(comment.user.name, comment.user.email)}
          </AvatarFallback>
        </Avatar>
        <div className="flex-1 min-w-0">
          <div className="flex flex-wrap items-baseline gap-x-2 gap-y-0.5">
            <span className="text-sm font-medium leading-snug">
              {comment.user.name ?? comment.user.email?.split("@")[0]}
            </span>
            <span className="text-[11px] text-muted-foreground/70">
              {relativeTime(comment.createdAt)}
            </span>
            {comment.chapter ? (
              <span className="text-[10px] text-muted-foreground/70">
                · cap. {comment.chapter}
              </span>
            ) : null}
            {comment.isSpoiler && !isDeleted ? (
              <Badge variant="default" className="text-[9px] py-0">Spoiler</Badge>
            ) : null}
          </div>

          <div className="relative mt-1">
            {comment.locked && displayContent === undefined ? (
              <LockedCommentContent
                reason={comment.reason}
                chapter={comment.chapter}
                revealing={revealing}
                onReveal={handleReveal}
              />
            ) : (
              <p
                className={cn(
                  "whitespace-pre-wrap text-sm leading-relaxed",
                  isDeleted && "italic text-muted-foreground",
                )}
              >
                {displayContent}
              </p>
            )}
          </div>

          {!isDeleted ? (
            <div className="mt-1.5 flex items-center gap-3 text-[11px] text-muted-foreground">
              {!isReply ? (
                <button
                  type="button"
                  onClick={() => setReplying((v) => !v)}
                  className="inline-flex items-center gap-1 hover:text-foreground transition-colors"
                  aria-pressed={replying}
                >
                  <Reply className="h-3 w-3" />
                  {replying ? "Cancelar" : "Responder"}
                </button>
              ) : null}
              {isModerator ? (
                <button
                  type="button"
                  onClick={toggleSpoiler}
                  disabled={pending}
                  className="inline-flex items-center gap-1 hover:text-foreground transition-colors disabled:opacity-50"
                >
                  {comment.isSpoiler ? (
                    <>
                      <EyeOff className="h-3 w-3" /> Quitar spoiler
                    </>
                  ) : (
                    <>
                      <Eye className="h-3 w-3" /> Marcar spoiler
                    </>
                  )}
                </button>
              ) : null}
              {canDelete ? (
                <button
                  type="button"
                  onClick={onDelete}
                  disabled={pending}
                  className="inline-flex items-center gap-1 hover:text-destructive transition-colors disabled:opacity-50"
                >
                  <Trash2 className="h-3 w-3" />
                  Borrar
                </button>
              ) : null}
            </div>
          ) : null}

          {replying && !isReply ? (
            <div className="mt-2.5">
              <Composer
                bookId={bookId}
                parentId={comment.id}
                onDone={() => setReplying(false)}
                onCancel={() => setReplying(false)}
                autoFocus
              />
            </div>
          ) : null}

          {!isReply && comment.replies && comment.replies.length > 0 ? (
            <ul className="mt-3 border-l border-border/40 pl-4">
              {comment.replies.map((r) => (
                <CommentItem
                  key={r.id}
                  bookId={bookId}
                  comment={r}
                  currentUserId={currentUserId}
                  isModerator={isModerator}
                  revealedContent={revealedContent}
                  onReveal={onReveal}
                  isReply
                />
              ))}
            </ul>
          ) : null}
        </div>
      </article>
    </li>
  );
}

function LockedCommentContent({
  reason,
  chapter,
  revealing,
  onReveal,
}: {
  reason: GateReason;
  chapter: number | null;
  revealing: boolean;
  onReveal: () => void;
}) {
  if (reason === "reflection") {
    return (
      <p className="text-sm italic text-muted-foreground">
        Comentario de la sala de reflexión — se abre cuando termines el libro.
      </p>
    );
  }

  const copy =
    reason === "chapter"
      ? `Es del capítulo ${chapter}, más adelante de tu avance.`
      : "Marcado como spoiler.";

  return (
    <button
      type="button"
      onClick={onReveal}
      disabled={revealing}
      className="inline-flex items-center gap-2 rounded-md bg-muted/40 px-3 py-2 text-xs text-muted-foreground hover:bg-muted/60 transition-colors disabled:opacity-60"
    >
      {revealing ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Eye className="h-3.5 w-3.5" />}
      {copy} {reason === "spoiler" ? "Revelar spoiler" : "Leer igual"}
    </button>
  );
}
