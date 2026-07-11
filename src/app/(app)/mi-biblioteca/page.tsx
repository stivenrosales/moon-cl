import Link from "next/link";
import { Library } from "lucide-react";
import { getSession } from "@/lib/session";
import { db } from "@/lib/db";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { BookCover } from "@/components/book-cover";
import { AddToShelfDialog } from "@/components/add-to-shelf-dialog";
import { ShelfBookRow, type ShelfBookRowData } from "@/components/shelf-book-row";
import { pageProgress } from "@/lib/utils";
import type { ShelfStatus } from "@prisma/client";

export const metadata = { title: "Mi biblioteca" };

export default async function MiBibliotecaPage() {
  const session = await getSession();
  if (!session?.user?.id) return null;
  const userId = session.user.id;

  const [userBooks, currentClubBook] = await Promise.all([
    db.userBook.findMany({
      where: { userId },
      include: { book: true },
      orderBy: { updatedAt: "desc" },
    }),
    db.book.findFirst({ where: { isCurrent: true } }),
  ]);

  const myClubProgress = currentClubBook
    ? await db.readingProgress.findFirst({
        where: { userId, bookId: currentClubBook.id },
        orderBy: { createdAt: "desc" },
      })
    : null;

  const clubBookId = currentClubBook?.id;
  const showClubRow = !!currentClubBook;

  const readingItems = userBooks.filter(
    (ub) => ub.status === "READING" && ub.bookId !== clubBookId,
  );
  const wantToReadItems = userBooks.filter((ub) => ub.status === "WANT_TO_READ");
  const finishedItems = userBooks.filter((ub) => ub.status === "FINISHED");

  const readingCount = readingItems.length + (showClubRow ? 1 : 0);

  return (
    <div className="space-y-6 md:space-y-8">
      <header className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <span className="text-xs uppercase tracking-[0.32em] text-accent-text">
            Tu espacio personal
          </span>
          <h1 className="display text-3xl md:text-4xl leading-[1.05] tracking-tight mt-1.5">
            Mi <span className="hand-script italic text-primary">biblioteca</span>
          </h1>
          <p className="mt-2 max-w-xl text-sm text-muted-foreground">
            Lo que estás leyendo, lo que quieres leer y lo que ya terminaste.
          </p>
        </div>
        <AddToShelfDialog />
      </header>

      <Tabs defaultValue="reading">
        <TabsList className="w-full grid grid-cols-3 sm:inline-flex sm:w-auto">
          <TabsTrigger value="reading" className="px-2 sm:px-3.5">
            <span className="text-xs sm:text-sm">
              Leyendo <span className="tabular-nums">· {readingCount}</span>
            </span>
          </TabsTrigger>
          <TabsTrigger value="want" className="px-2 sm:px-3.5">
            <span className="text-xs sm:text-sm">
              Quiero leer <span className="tabular-nums">· {wantToReadItems.length}</span>
            </span>
          </TabsTrigger>
          <TabsTrigger value="finished" className="px-2 sm:px-3.5">
            <span className="text-xs sm:text-sm">
              Leídos <span className="tabular-nums">· {finishedItems.length}</span>
            </span>
          </TabsTrigger>
        </TabsList>

        <TabsContent value="reading" className="space-y-3">
          {readingCount === 0 ? (
            <EmptyState
              message="Aún no hay libros en Leyendo"
              hint="Agrega uno para empezar a llevar tu avance."
            />
          ) : (
            <div className="space-y-3">
              {showClubRow && currentClubBook ? (
                <ClubCurrentBookCard
                  book={currentClubBook}
                  progress={myClubProgress ? { currentPage: myClubProgress.currentPage } : null}
                />
              ) : null}
              {readingItems.map((ub) => (
                <ShelfBookRow key={ub.id} item={toRowData(ub)} />
              ))}
            </div>
          )}
        </TabsContent>

        <TabsContent value="want">
          {wantToReadItems.length === 0 ? (
            <EmptyState
              message="Aún no hay libros en Quiero leer"
              hint="Guarda aquí los libros que tienes en la mira."
              defaultStatus="WANT_TO_READ"
            />
          ) : (
            <div className="flex gap-3 overflow-x-auto pb-2 scrollbar-hide">
              {wantToReadItems.map((ub) => (
                <ShelfBookRow key={ub.id} item={toRowData(ub)} variant="cover" />
              ))}
            </div>
          )}
        </TabsContent>

        <TabsContent value="finished" className="space-y-3">
          {finishedItems.length === 0 ? (
            <EmptyState
              message="Aún no hay libros en Leídos"
              hint="Cuando termines uno, márcalo como leído."
              defaultStatus="FINISHED"
            />
          ) : (
            <div className="space-y-3">
              {finishedItems.map((ub) => (
                <ShelfBookRow key={ub.id} item={toRowData(ub)} />
              ))}
            </div>
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
}

function toRowData(ub: {
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
}): ShelfBookRowData {
  return {
    id: ub.id,
    bookId: ub.bookId,
    status: ub.status,
    currentPage: ub.currentPage,
    currentChapter: ub.currentChapter,
    book: {
      id: ub.book.id,
      title: ub.book.title,
      authors: ub.book.authors,
      coverUrl: ub.book.coverUrl,
      pageCount: ub.book.pageCount,
    },
  };
}

function ClubCurrentBookCard({
  book,
  progress,
}: {
  book: {
    id: string;
    title: string;
    authors: string[];
    coverUrl: string | null;
    pageCount: number | null;
  };
  progress: { currentPage: number } | null;
}) {
  const pct = pageProgress(progress?.currentPage, book.pageCount);
  return (
    <Card className="p-2.5 sm:p-3">
      <div className="flex items-center gap-3">
        <Link href={`/libros/${book.id}`} className="focus-ring shrink-0 rounded-md">
          <BookCover src={book.coverUrl} title={book.title} size="sm" />
        </Link>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-1.5">
            <Link href={`/libros/${book.id}`} className="focus-ring min-w-0 rounded-sm">
              <p className="line-clamp-1 font-medium leading-snug hover:text-primary transition-colors">
                {book.title}
              </p>
            </Link>
            <Badge variant="gold" className="shrink-0">CLUB</Badge>
          </div>
          {book.authors.length ? (
            <p className="line-clamp-1 text-xs text-muted-foreground">{book.authors.join(", ")}</p>
          ) : null}
          <div className="mt-1.5 space-y-1">
            <div className="flex items-baseline justify-between gap-2 text-[10px] uppercase tracking-[0.16em] text-muted-foreground">
              <span>Progreso del club</span>
              <span className="tabular-nums text-foreground">
                {pct}%
                {book.pageCount && progress
                  ? ` · pág. ${progress.currentPage}/${book.pageCount}`
                  : ""}
              </span>
            </div>
            <Progress value={pct} />
          </div>
        </div>
        <Button asChild size="sm" variant="outline" className="shrink-0">
          <Link href={`/libros/${book.id}`}>Continuar</Link>
        </Button>
      </div>
    </Card>
  );
}

function EmptyState({
  message,
  hint,
  defaultStatus = "READING",
}: {
  message: string;
  hint: string;
  defaultStatus?: ShelfStatus;
}) {
  return (
    <Card className="p-8 text-center">
      <Library className="mx-auto h-6 w-6 text-primary/60" />
      <p className="mt-2 hand-script text-2xl">{message}</p>
      <p className="mt-1 text-sm text-muted-foreground">{hint}</p>
      <div className="mt-4 flex justify-center">
        <AddToShelfDialog defaultStatus={defaultStatus} triggerLabel="Agregar un libro" />
      </div>
    </Card>
  );
}
