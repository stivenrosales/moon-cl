"use client";

import * as React from "react";
import Link from "next/link";
import { BookCheck, BookOpen, Loader2, MoreHorizontal, Trash2 } from "lucide-react";
import { toast } from "sonner";
import type { ShelfStatus } from "@prisma/client";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Field, Label } from "@/components/ui/label";
import { Progress } from "@/components/ui/progress";
import { BookCover } from "@/components/book-cover";
import { moveShelf, removeFromShelf, updateMyBook } from "@/server/actions/shelves";
import { routes } from "@/lib/routes";
import { pageProgress } from "@/lib/utils";

export interface ShelfBookRowData {
  id: string;
  bookId: string;
  status: ShelfStatus;
  currentPage: number | null;
  currentChapter: number | null;
  book: {
    id: string;
    title: string;
    authors: string[];
    coverUrl: string | null;
    pageCount: number | null;
  };
}

interface ShelfBookRowProps {
  item: ShelfBookRowData;
  /** "row" = fila con progreso (Leyendo/Leídos). "cover" = tarjeta compacta (Quiero leer). */
  variant?: "row" | "cover";
}

export function ShelfBookRow({ item, variant = "row" }: ShelfBookRowProps) {
  const [pending, setPending] = React.useState(false);
  const [progressOpen, setProgressOpen] = React.useState(false);

  async function run(fn: () => Promise<unknown>, msg: string) {
    setPending(true);
    try {
      await fn();
      toast.success(msg);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Error");
    } finally {
      setPending(false);
    }
  }

  async function handleMove(status: ShelfStatus) {
    const msg =
      status === "READING"
        ? "Ahora estás leyendo este libro"
        : status === "FINISHED"
          ? "Marcado como leído"
          : "Movido a Quiero leer";
    await run(() => moveShelf({ bookId: item.bookId, status }), msg);
  }

  async function handleRemove() {
    if (!confirm("¿Quitar este libro de tu estantería?")) return;
    await run(() => removeFromShelf(item.bookId), "Libro quitado de tu estantería");
  }

  const menu = (
    <DropdownMenu>
      <DropdownMenuTrigger
        disabled={pending}
        className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-muted-foreground transition-colors hover:bg-muted/60 hover:text-foreground focus-ring disabled:opacity-50"
        aria-label="Más opciones"
      >
        {pending ? <Loader2 className="h-4 w-4 animate-spin" /> : <MoreHorizontal className="h-4 w-4" />}
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        {item.status === "READING" ? (
          <DropdownMenuItem onSelect={() => setProgressOpen(true)}>
            <BookOpen className="h-4 w-4" /> Actualizar avance
          </DropdownMenuItem>
        ) : (
          <DropdownMenuItem onSelect={() => handleMove("READING")}>
            <BookOpen className="h-4 w-4" /> Empezar a leer
          </DropdownMenuItem>
        )}
        {item.status !== "FINISHED" ? (
          <DropdownMenuItem onSelect={() => handleMove("FINISHED")}>
            <BookCheck className="h-4 w-4" /> Marcar como leído
          </DropdownMenuItem>
        ) : null}
        <DropdownMenuSeparator />
        <DropdownMenuItem onSelect={handleRemove} className="text-destructive focus:text-destructive">
          <Trash2 className="h-4 w-4" /> Quitar de la estantería
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );

  const progressDialog = (
    <UpdateProgressDialog
      open={progressOpen}
      onOpenChange={setProgressOpen}
      bookId={item.bookId}
      totalPages={item.book.pageCount}
      initialPage={item.currentPage ?? 0}
      initialChapter={item.currentChapter ?? undefined}
    />
  );

  if (variant === "cover") {
    return (
      <div className="w-28 shrink-0 space-y-2">
        <div className="relative">
          <Link href={routes.libro(item.bookId)} className="focus-ring block rounded-md">
            <BookCover
              src={item.book.coverUrl}
              title={item.book.title}
              size="md"
              className="w-28 h-[168px]"
            />
          </Link>
          <div className="absolute right-1 top-1">
            <DropdownMenu>
              <DropdownMenuTrigger
                disabled={pending}
                className="inline-flex h-7 w-7 items-center justify-center rounded-full bg-background/80 text-foreground backdrop-blur transition-colors hover:bg-background focus-ring disabled:opacity-50"
                aria-label="Más opciones"
              >
                {pending ? (
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                ) : (
                  <MoreHorizontal className="h-3.5 w-3.5" />
                )}
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuItem onSelect={() => handleMove("READING")}>
                  <BookOpen className="h-4 w-4" /> Empezar a leer
                </DropdownMenuItem>
                <DropdownMenuItem onSelect={() => handleMove("FINISHED")}>
                  <BookCheck className="h-4 w-4" /> Marcar como leído
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem
                  onSelect={handleRemove}
                  className="text-destructive focus:text-destructive"
                >
                  <Trash2 className="h-4 w-4" /> Quitar de la estantería
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </div>
        <p className="line-clamp-2 text-xs font-medium leading-snug">{item.book.title}</p>
      </div>
    );
  }

  const pct = pageProgress(item.currentPage, item.book.pageCount);

  return (
    <div className="flex items-center gap-3 rounded-xl border border-border/40 bg-card/40 p-2.5 sm:p-3">
      <Link href={routes.libro(item.bookId)} className="focus-ring shrink-0 rounded-md">
        <BookCover src={item.book.coverUrl} title={item.book.title} size="sm" />
      </Link>
      <div className="min-w-0 flex-1">
        <Link href={routes.libro(item.bookId)} className="focus-ring rounded-sm">
          <p className="line-clamp-1 font-medium leading-snug hover:text-primary transition-colors">
            {item.book.title}
          </p>
        </Link>
        {item.book.authors.length ? (
          <p className="line-clamp-1 text-xs text-muted-foreground">{item.book.authors.join(", ")}</p>
        ) : null}
        {item.status === "READING" ? (
          <div className="mt-1.5 space-y-1">
            <div className="flex items-baseline justify-between gap-2 text-[10px] uppercase tracking-[0.16em] text-muted-foreground">
              <span>Progreso</span>
              <span className="tabular-nums text-foreground">
                {pct}%
                {item.book.pageCount ? ` · pág. ${item.currentPage ?? 0}/${item.book.pageCount}` : ""}
                {item.currentChapter ? ` · cap. ${item.currentChapter}` : ""}
              </span>
            </div>
            <Progress value={pct} />
          </div>
        ) : item.status === "FINISHED" ? (
          <span className="mt-1 inline-flex items-center text-[10px] uppercase tracking-[0.18em] text-accent-text">
            Leído
          </span>
        ) : null}
      </div>
      {menu}
      {progressDialog}
    </div>
  );
}

function UpdateProgressDialog({
  open,
  onOpenChange,
  bookId,
  totalPages,
  initialPage,
  initialChapter,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  bookId: string;
  totalPages: number | null;
  initialPage: number;
  initialChapter?: number;
}) {
  // number | "": "" es el sentinel de "campo vacío" (mismo patrón que
  // hero-card.tsx). Con page: number, "0 || undefined" perdía la página 0
  // antes de llegar a la action porque 0 es falsy en JS.
  const [page, setPage] = React.useState<number | "">(initialPage);
  const [chapter, setChapter] = React.useState<string>(
    initialChapter ? String(initialChapter) : "",
  );
  const [submitting, setSubmitting] = React.useState(false);

  React.useEffect(() => {
    if (open) {
      setPage(initialPage);
      setChapter(initialChapter ? String(initialChapter) : "");
    }
  }, [open, initialPage, initialChapter]);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    try {
      await updateMyBook({
        bookId,
        // page === "" (no falsy): la página 0 es un valor válido y debe
        // enviarse tal cual, no perderse como si nunca se hubiera declarado.
        currentPage: page === "" ? undefined : page,
        currentChapter: chapter ? Number(chapter) : undefined,
      });
      toast.success("Avance actualizado");
      onOpenChange(false);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Error");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle>Actualizar avance</DialogTitle>
          <DialogDescription>Tu propia página y capítulo en este libro.</DialogDescription>
        </DialogHeader>
        <form onSubmit={onSubmit} className="space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <Field className="min-w-0">
              <Label htmlFor="shelf-page" optional>Página</Label>
              <Input
                id="shelf-page"
                type="number"
                inputMode="numeric"
                min={0}
                max={totalPages ?? 20000}
                value={page}
                onChange={(e) => {
                  const raw = e.target.value;
                  setPage(raw === "" ? "" : Math.max(0, Number(raw)));
                }}
              />
            </Field>
            <Field className="min-w-0">
              <Label htmlFor="shelf-chapter" optional>Capítulo</Label>
              <Input
                id="shelf-chapter"
                type="number"
                inputMode="numeric"
                min={1}
                max={2000}
                value={chapter}
                onChange={(e) => setChapter(e.target.value)}
              />
            </Field>
          </div>
          <Button type="submit" disabled={submitting} className="w-full">
            {submitting ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
            Guardar avance
          </Button>
        </form>
      </DialogContent>
    </Dialog>
  );
}
