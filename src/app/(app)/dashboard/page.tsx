import Link from "next/link";
import { ArrowRight, Vote, BookOpen, CalendarDays, Sparkles } from "lucide-react";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { BookCover } from "@/components/book-cover";
import { RoundStatusBadge } from "@/components/round-status-badge";
import { formatDate, formatDateTime, pageProgress, relativeTime } from "@/lib/utils";

export default async function DashboardPage() {
  const session = await auth();
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
    <div className="space-y-12">
      <header className="space-y-2 animate-fade-up">
        <span className="text-xs uppercase tracking-[0.32em] text-accent">
          {greet()}, {session.user.name ?? session.user.email?.split("@")[0]}
        </span>
        <h1 className="display text-4xl md:text-5xl leading-tight">
          Bajo la <span className="hand-script italic text-primary">misma luna</span>.
        </h1>
      </header>

      <div className="grid grid-cols-1 lg:grid-cols-[1.4fr_1fr] gap-6">
        {/* Libro en curso */}
        <Card className="p-6 md:p-8">
          <div className="flex items-center justify-between gap-2">
            <span className="inline-flex items-center gap-2 text-xs uppercase tracking-[0.24em] text-accent">
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
            <div className="mt-5 flex flex-col md:flex-row gap-6">
              <BookCover src={currentBook.coverUrl} title={currentBook.title} size="lg" />
              <div className="flex-1 min-w-0">
                <h2 className="display text-3xl leading-tight">{currentBook.title}</h2>
                {currentBook.authors.length ? (
                  <p className="mt-1 text-muted-foreground">{currentBook.authors.join(", ")}</p>
                ) : null}
                {currentBook.pageCount ? (
                  <p className="mt-1 text-xs uppercase tracking-[0.18em] text-muted-foreground">
                    {currentBook.pageCount} páginas
                  </p>
                ) : null}

                {myCurrentProgress ? (
                  <div className="mt-5 space-y-2">
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
                  <p className="mt-5 text-sm text-muted-foreground">
                    Aún no has marcado tu avance.
                  </p>
                )}

                <div className="mt-5 flex gap-2">
                  <Button asChild>
                    <Link href={`/libros/${currentBook.id}`}>Leer y comentar</Link>
                  </Button>
                </div>
              </div>
            </div>
          ) : (
            <div className="py-10 text-center">
              <Sparkles className="mx-auto h-6 w-6 text-primary/60" />
              <p className="mt-3 hand-script text-2xl">Esperando libro</p>
              <p className="mt-1 text-sm text-muted-foreground">
                Cuando termine la ronda, aparecerá aquí.
              </p>
            </div>
          )}
        </Card>

        <div className="space-y-6">
          {/* Ronda activa */}
          <Card className="p-6">
            <span className="inline-flex items-center gap-2 text-xs uppercase tracking-[0.24em] text-accent">
              <Vote className="h-4 w-4" /> Ronda
            </span>
            {openRound ? (
              <div className="mt-3 space-y-3">
                <div className="flex items-center gap-2">
                  <RoundStatusBadge status={openRound.status} />
                  <span className="text-[10px] uppercase tracking-[0.2em] text-muted-foreground">
                    cierra {relativeTime(openRound.endsAt)}
                  </span>
                </div>
                <h3 className="display text-2xl leading-tight">{openRound.title}</h3>
                <p className="text-sm text-muted-foreground">
                  {openRound._count.suggestions} sugerencia
                  {openRound._count.suggestions === 1 ? "" : "s"}
                </p>
                <Button asChild>
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
          <Card className="p-6">
            <span className="inline-flex items-center gap-2 text-xs uppercase tracking-[0.24em] text-accent">
              <CalendarDays className="h-4 w-4" /> Próxima reunión
            </span>
            {nextMeeting ? (
              <div className="mt-3 space-y-3">
                <p className="text-[10px] uppercase tracking-[0.2em] text-muted-foreground">
                  {formatDateTime(nextMeeting.startsAt)} · {relativeTime(nextMeeting.startsAt)}
                </p>
                <h3 className="display text-2xl leading-tight">{nextMeeting.title}</h3>
                <p className="text-sm text-muted-foreground">
                  {nextMeeting._count.rsvps} confirmacion
                  {nextMeeting._count.rsvps === 1 ? "" : "es"}
                </p>
                <Button asChild>
                  <Link href={`/reuniones/${nextMeeting.id}`}>Ver y confirmar</Link>
                </Button>
              </div>
            ) : (
              <div className="mt-3">
                <p className="hand-script text-xl">Sin reuniones programadas</p>
              </div>
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
