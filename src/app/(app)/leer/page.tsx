import { Suspense } from "react";
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
import { StarRating } from "@/components/star-rating";
import { AddToShelfDialog } from "@/components/add-to-shelf-dialog";
import { ShelfBookRow, type ShelfBookRowData } from "@/components/shelf-book-row";
import { SegmentedControl } from "@/components/segmented-control";
import { NudgeCard } from "@/components/nudge-card";
import { StartReadingButton } from "@/components/start-reading-button";
import { BookGridSkeleton, ShelfRowsSkeleton } from "@/components/skeletons";
import { pageProgress } from "@/lib/utils";
import { routes } from "@/lib/routes";
import { resolverSegmentoActivo } from "@/lib/segmented-control";
import { resolveClubRowMode } from "@/lib/club-reading-row";
import { nextNudge } from "@/server/services/nudge-queue";
import type { ShelfStatus } from "@prisma/client";

export const dynamic = "force-dynamic";

export const metadata = { title: "Leer" };

const SEGMENTOS = [
  { valor: "mios", label: "Mi biblioteca" },
  { valor: "club", label: "Biblioteca del club" },
] as const;

export default async function LeerPage({
  searchParams,
}: {
  searchParams: Promise<{ vista?: string }>;
}) {
  const { vista } = await searchParams;
  const vistaActiva = resolverSegmentoActivo(SEGMENTOS, vista ?? "");

  return (
    <div className="space-y-6 md:space-y-8">
      {vistaActiva !== "club" ? (
        <div className="flex justify-end">
          <AddToShelfDialog />
        </div>
      ) : null}

      <SegmentedControl segmentos={SEGMENTOS} activo={vistaActiva} />

      {/* key={vistaActiva}: al cambiar de vista dentro del mismo tab (mismo
          segmento de ruta), Next NO vuelve a disparar loading.tsx porque no
          hay boundary nuevo — el key es lo que fuerza a React a desmontar el
          subárbol viejo y mostrar el fallback mientras la vista nueva
          streamea, en vez de quedarse con el contenido anterior congelado. */}
      <Suspense
        key={vistaActiva}
        fallback={vistaActiva === "club" ? <BookGridSkeleton /> : <ShelfRowsSkeleton />}
      >
        {vistaActiva === "club" ? <BibliotecaClubView /> : <MiBibliotecaView />}
      </Suspense>
    </div>
  );
}

async function MiBibliotecaView() {
  const session = await getSession();
  if (!session?.user?.id) return null;
  const userId = session.user.id;

  // myClubProgress se resuelve vía la relación book.isCurrent en vez de
  // esperar a currentClubBook.id: antes esto era secuencial (buscar el
  // libro actual del club, y RECIÉN con su id pedir el progreso), acá las
  // 4 queries corren juntas en el mismo round-trip.
  const [userBooks, currentClubBook, myClubProgress, nudge] = await Promise.all([
    db.userBook.findMany({
      where: { userId },
      include: { book: true },
      orderBy: { updatedAt: "desc" },
    }),
    db.book.findFirst({ where: { isCurrent: true } }),
    db.readingProgress.findFirst({
      where: { userId, book: { isCurrent: true } },
      orderBy: { createdAt: "desc" },
    }),
    nextNudge(userId),
  ]);

  const leerMiosNudge = nudge && nudge.screen === "leer-mios" ? nudge : null;
  // "primer-rating" apunta al primer libro que el usuario terminó — misma
  // ancla (finishedAt asc) que usa checkPrimerRating en nudge-queue.ts.
  const firstFinishedBook = userBooks
    .filter((ub): ub is typeof ub & { finishedAt: Date } => ub.status === "FINISHED" && ub.finishedAt != null)
    .sort((a, b) => a.finishedAt.getTime() - b.finishedAt.getTime())[0] ?? null;

  const clubBookId = currentClubBook?.id;
  // "progress": el usuario tiene UserBook READING para el libro del club →
  // fila con avance real. "invite": no tiene NINGÚN UserBook para ese libro
  // → fila honesta de invitación, sin barra ni "Continuar". "none": no hay
  // libro actual, o el usuario ya lo tiene en Quiero leer/Leído (aparece en
  // su propia pestaña, no hace falta duplicarlo acá). Ver club-reading-row.ts.
  const clubRowMode = resolveClubRowMode(
    clubBookId,
    userBooks.map((ub) => ({ bookId: ub.bookId, status: ub.status })),
  );

  const readingItems = userBooks.filter(
    (ub) => ub.status === "READING" && ub.bookId !== clubBookId,
  );
  const wantToReadItems = userBooks.filter((ub) => ub.status === "WANT_TO_READ");
  const finishedItems = userBooks.filter((ub) => ub.status === "FINISHED");

  // El contador "Leyendo" solo suma la fila del club cuando es progreso
  // real: la fila de invitación NO cuenta como "estás leyendo esto" — es
  // justo la mentira que se estaba mostrando antes.
  const readingCount = readingItems.length + (clubRowMode === "progress" ? 1 : 0);
  // La sección "Leyendo" se pinta si hay progreso real O si hay una
  // invitación que mostrar — la invitación no debe quedar oculta detrás del
  // EmptyState solo porque el contador está en 0.
  const showReadingSection = readingCount > 0 || clubRowMode === "invite";

  return (
    <div className="space-y-4">
      {leerMiosNudge ? (
        <NudgeCard nudge={leerMiosNudge} context={{ libroTerminadoId: firstFinishedBook?.bookId }} />
      ) : null}

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
        {!showReadingSection ? (
          <EmptyState
            message="Aún no hay libros en Leyendo"
            hint="Agrega uno para empezar a llevar tu avance."
          />
        ) : (
          <div className="space-y-3">
            {clubRowMode === "progress" && currentClubBook ? (
              <ClubCurrentBookCard
                book={currentClubBook}
                progress={myClubProgress ? { currentPage: myClubProgress.currentPage } : null}
              />
            ) : null}
            {clubRowMode === "invite" && currentClubBook ? (
              <ClubInviteCard book={currentClubBook} />
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

async function BibliotecaClubView() {
  const books = await db.book.findMany({
    orderBy: [{ isCurrent: "desc" }, { finishedAt: "desc" }, { createdAt: "desc" }],
    select: {
      id: true,
      title: true,
      authors: true,
      coverUrl: true,
      isCurrent: true,
      status: true,
      ratings: { select: { stars: true } },
      _count: { select: { comments: true, ratings: true } },
    },
  });

  const current = books.filter((b) => b.isCurrent);
  const finished = books.filter((b) => b.status === "FINISHED");
  const others = books.filter((b) => !b.isCurrent && b.status !== "FINISHED");

  return (
    <div className="space-y-6 md:space-y-8">
      {current.length > 0 ? (
        <Section title="Leyendo ahora">
          <BookGrid books={current} />
        </Section>
      ) : null}

      {finished.length > 0 ? (
        <Section title="Ya leídos">
          <BookGrid books={finished} />
        </Section>
      ) : null}

      {others.length > 0 ? (
        <Section title="Sugeridos & candidatos">
          <BookGrid books={others} />
        </Section>
      ) : null}

      {books.length === 0 ? (
        <Card className="p-8 text-center">
          <p className="hand-script text-2xl">Todavía no hay libros</p>
          <p className="mt-1 text-sm text-muted-foreground">
            Cuando se sugiera el primero, aparecerá aquí.
          </p>
        </Card>
      ) : null}
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
        <Link href={routes.libro(book.id)} className="focus-ring shrink-0 rounded-md">
          <BookCover src={book.coverUrl} title={book.title} size="sm" />
        </Link>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-1.5">
            <Link href={routes.libro(book.id)} className="focus-ring min-w-0 rounded-sm">
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
          <Link href={routes.libro(book.id)}>Continuar</Link>
        </Button>
      </div>
    </Card>
  );
}

// Fila de invitación: el libro actual del club, pero el usuario NO tiene
// UserBook para él todavía. Misma estructura visual que ClubCurrentBookCard
// para que se sienta parte de la misma familia, pero CERO barra de progreso
// y CERO "Continuar" — nada que implique que ya empezaste. El CTA es
// honesto: "Lo voy a leer" crea el UserBook recién en este momento (ver
// StartReadingButton), y "Ver de qué va" solo lleva al detalle del libro.
function ClubInviteCard({
  book,
}: {
  book: {
    id: string;
    title: string;
    authors: string[];
    coverUrl: string | null;
  };
}) {
  return (
    <Card className="p-2.5 sm:p-3">
      <div className="flex items-center gap-3">
        <Link href={routes.libro(book.id)} className="focus-ring shrink-0 rounded-md">
          <BookCover src={book.coverUrl} title={book.title} size="sm" />
        </Link>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-1.5">
            <Link href={routes.libro(book.id)} className="focus-ring min-w-0 rounded-sm">
              <p className="line-clamp-1 font-medium leading-snug hover:text-primary transition-colors">
                {book.title}
              </p>
            </Link>
            <Badge variant="gold" className="shrink-0">CLUB</Badge>
          </div>
          {book.authors.length ? (
            <p className="line-clamp-1 text-xs text-muted-foreground">{book.authors.join(", ")}</p>
          ) : null}
          <p className="mt-1.5 text-xs text-muted-foreground">
            El club está leyendo esto ahora. Todavía no lo agregaste a tu estantería.
          </p>
        </div>
        <div className="flex shrink-0 flex-col items-stretch gap-1.5">
          <StartReadingButton bookId={book.id} />
          <Button asChild size="sm" variant="outline">
            <Link href={routes.libro(book.id)}>Ver de qué va</Link>
          </Button>
        </div>
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

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="space-y-3">
      <h2 className="text-xs uppercase tracking-[0.32em] text-muted-foreground">{title}</h2>
      {children}
    </section>
  );
}

interface BookGridItem {
  id: string;
  title: string;
  authors: string[];
  coverUrl: string | null;
  isCurrent: boolean;
  ratings: { stars: number }[];
  _count: { comments: number; ratings: number };
}

function BookGrid({ books }: { books: BookGridItem[] }) {
  return (
    <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-x-4 gap-y-5">
      {books.map((b) => {
        const avg = b.ratings.length
          ? b.ratings.reduce((s, r) => s + r.stars, 0) / b.ratings.length
          : 0;
        return (
          <Link key={b.id} href={routes.libro(b.id)} className="group focus-ring rounded-xl">
            <div className="space-y-3">
              <BookCover src={b.coverUrl} title={b.title} size="lg" className="w-full h-auto aspect-[2/3] mx-auto" />
              <div className="space-y-1">
                <h3 className="display text-base leading-tight line-clamp-2 group-hover:text-primary transition-colors">
                  {b.title}
                </h3>
                {b.authors.length ? (
                  <p className="text-xs text-muted-foreground line-clamp-1">{b.authors.join(", ")}</p>
                ) : null}
                {b._count.ratings > 0 ? (
                  <div className="flex items-center gap-1.5">
                    <StarRating value={Math.round(avg)} readOnly size={12} />
                    <span className="text-[10px] text-muted-foreground tabular-nums">{avg.toFixed(1)}</span>
                  </div>
                ) : null}
                {b.isCurrent ? <Badge variant="default" className="mt-1">En curso</Badge> : null}
              </div>
            </div>
          </Link>
        );
      })}
    </div>
  );
}
