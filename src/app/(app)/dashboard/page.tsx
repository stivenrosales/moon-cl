import Link from "next/link";
import { ArrowRight, Vote, BookOpen, CalendarDays, Sparkles } from "lucide-react";
import { getSession } from "@/lib/session";
import { db } from "@/lib/db";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { BookCover } from "@/components/book-cover";
import { RoundStatusBadge } from "@/components/round-status-badge";
import { formatDate, formatDateTime, pageProgress, relativeTime } from "@/lib/utils";

export default async function DashboardPage() {
  const session = await getSession();
  if (!session?.user?.id) return null;
  const userId = session.user.id;

  const [currentBook, openRound, nextMeeting, myProgress] = await Promise.all([
    db.book.findFirst({
      where: { isCurrent: true },
      include: { _count: { select: { progressUpdates: true } } },
    }),
    db.round.findFirst({
      where: { status: "OPEN" },
      include: { _count: { select: { suggestions: true } } },
    }),
    db.meeting.findFirst({
      where: { startsAt: { gte: new Date() } },
      orderBy: { startsAt: "asc" },
      include: { _count: { select: { rsvps: true } } },
    }),
    db.readingProgress.findFirst({
      where: { userId },
      orderBy: { createdAt: "desc" },
      include: { book: true },
    }),
  ]);

  const myCurrentProgress =
    currentBook && myProgress?.bookId === currentBook.id ? myProgress : null;

  return (
    <div className="space-y-5 md:space-y-7">
      <header className="space-y-1 animate-fade-up">
        <span className="text-xs uppercase tracking-[0.32em] text-accent-text">
          {greet()}, {session.user.name ?? session.user.email?.split("@")[0]}
        </span>
        <h1 className="display text-3xl md:text-4xl leading-[1.05] tracking-tight">
          Bajo la <span className="hand-script italic text-primary">misma luna</span>.
        </h1>
      </header>

      <div className="grid grid-cols-1 lg:grid-cols-[1.4fr_1fr] gap-4 md:gap-5">
        {/* Libro en curso */}
        <Card className="p-5 md:p-6">
          <div className="flex items-center justify-between gap-2">
            <span className="inline-flex items-center gap-2 text-xs uppercase tracking-[0.24em] text-accent-text">
              <BookOpen className="h-4 w-4" /> Libro en curso
            </span>
            {currentBook ? (
              <Link
                href={`/libros/${currentBook.id}`}
                className="inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground transition-colors"
              >
                Detalle <ArrowRight className="h-3 w-3" />
              </Link>
            ) : null}
          </div>

          {currentBook ? (
            <div className="mt-4 flex flex-col md:flex-row gap-5">
              <BookCover src={currentBook.coverUrl} title={currentBook.title} size="lg" />
              <div className="flex-1 min-w-0">
                <h2 className="display text-2xl md:text-3xl leading-tight">{currentBook.title}</h2>
                {currentBook.authors.length ? (
                  <p className="mt-1 text-muted-foreground">{currentBook.authors.join(", ")}</p>
                ) : null}
                {currentBook.pageCount ? (
                  <p className="mt-1 text-xs uppercase tracking-[0.18em] text-muted-foreground">
                    {currentBook.pageCount} páginas
                  </p>
                ) : null}

                {myCurrentProgress ? (
                  <div className="mt-4 space-y-2">
                    <div className="flex items-center justify-between text-xs uppercase tracking-[0.18em] text-muted-foreground">
                      <span>Tu avance</span>
                      <span>
                        pág. {myCurrentProgress.currentPage}
                        {currentBook.pageCount ? ` / ${currentBook.pageCount}` : ""} ·{" "}
                        {pageProgress(myCurrentProgress.currentPage, currentBook.pageCount)}%
                      </span>
                    </div>
                    <Progress
                      value={pageProgress(myCurrentProgress.currentPage, currentBook.pageCount)}
                    />
                  </div>
                ) : (
                  <p className="mt-4 text-sm text-muted-foreground">
                    Aún no has marcado tu avance.
                  </p>
                )}

                <div className="mt-4 flex gap-2">
                  <Button asChild>
                    <Link href={`/libros/${currentBook.id}`}>Leer y comentar</Link>
                  </Button>
                </div>
              </div>
            </div>
          ) : (
            <div className="py-8 text-center">
              <Sparkles className="mx-auto h-6 w-6 text-primary/60" />
              <p className="mt-2 hand-script text-2xl">Esperando libro</p>
              <p className="mt-1 text-sm text-muted-foreground">
                Cuando termine la ronda, aparecerá aquí.
              </p>
            </div>
          )}
        </Card>

        <div className="space-y-4 md:space-y-5">
          {/* Ronda activa */}
          <Card className="p-5">
            <span className="inline-flex items-center gap-2 text-xs uppercase tracking-[0.24em] text-accent-text">
              <Vote className="h-4 w-4" /> Ronda
            </span>
            {openRound ? (
              <div className="mt-3 space-y-2.5">
                <div className="flex items-center gap-2">
                  <RoundStatusBadge status={openRound.status} />
                  <span className="text-[10px] uppercase tracking-[0.2em] text-muted-foreground">
                    cierra {relativeTime(openRound.endsAt)}
                  </span>
                </div>
                <h3 className="display text-xl md:text-2xl leading-tight">{openRound.title}</h3>
                <p className="text-sm text-muted-foreground">
                  {openRound._count.suggestions} sugerencia
                  {openRound._count.suggestions === 1 ? "" : "s"}
                </p>
                <Button asChild className="mt-1">
                  <Link href={`/rondas/${openRound.id}`}>
                    Sugerir y votar <ArrowRight className="h-3 w-3" />
                  </Link>
                </Button>
              </div>
            ) : (
              <div className="mt-3">
                <p className="hand-script text-xl">Sin ronda activa</p>
                <p className="mt-1 text-sm text-muted-foreground">
                  Pronto se abrirá la siguiente ✦
                </p>
                <Button asChild variant="outline" className="mt-3">
                  <Link href="/rondas">Ver historial</Link>
                </Button>
              </div>
            )}
          </Card>

          {/* Próxima reunión */}
          <Card className="p-5">
            <span className="inline-flex items-center gap-2 text-xs uppercase tracking-[0.24em] text-accent-text">
              <CalendarDays className="h-4 w-4" /> Próxima reunión
            </span>
            {nextMeeting ? (
              <div className="mt-3 space-y-2.5">
                <p className="text-[10px] uppercase tracking-[0.2em] text-muted-foreground">
                  {formatDateTime(nextMeeting.startsAt)} · {relativeTime(nextMeeting.startsAt)}
                </p>
                <h3 className="display text-xl md:text-2xl leading-tight">{nextMeeting.title}</h3>
                <p className="text-sm text-muted-foreground">
                  {nextMeeting._count.rsvps} confirmacion
                  {nextMeeting._count.rsvps === 1 ? "" : "es"}
                </p>
                <Button asChild className="mt-1">
                  <Link href={`/reuniones/${nextMeeting.id}`}>Ver y confirmar</Link>
                </Button>
              </div>
            ) : (
              <p className="mt-2 hand-script text-lg text-muted-foreground">
                Sin reuniones programadas
              </p>
            )}
          </Card>
        </div>
      </div>
    </div>
  );
}

function greet() {
  const h = new Date().getHours();
  if (h < 6) return "Buenas noches";
  if (h < 12) return "Buenos días";
  if (h < 19) return "Buenas tardes";
  return "Buenas noches";
}
