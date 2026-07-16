import Link from "next/link";
import { notFound } from "next/navigation";
import { Crown } from "lucide-react";
import { db } from "@/lib/db";
import { getSession } from "@/lib/session";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { BookCover } from "@/components/book-cover";
import { RoundStatusBadge } from "@/components/round-status-badge";
import { SuggestBookDialog } from "@/components/suggest-book-dialog";
import { RoundSuggestionsList } from "@/components/round-suggestions-list";
import { formatDate } from "@/lib/utils";
import { routes } from "@/lib/routes";

export default async function RondaPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const session = await getSession();
  if (!session?.user?.id) return null;

  const round = await db.round.findUnique({
    where: { id },
    include: {
      winner: true,
      suggestions: {
        include: {
          book: true,
          user: { select: { id: true, name: true, email: true, image: true } },
          votes: { select: { userId: true } },
          _count: { select: { votes: true } },
        },
        orderBy: [{ votes: { _count: "desc" } }, { createdAt: "asc" }],
      },
    },
  });

  if (!round) notFound();

  const userId = session.user.id;
  const isAdmin = session.user.role === "ADMIN";
  const canVote = round.status === "OPEN";
  const totalVotes = round.suggestions.reduce((acc, s) => acc + s._count.votes, 0);

  return (
    <div className="space-y-5 md:space-y-6">
      <Link
        href={routes.agenda({ vista: "votaciones" })}
        className="inline-flex items-center gap-1 text-xs uppercase tracking-[0.24em] text-muted-foreground hover:text-foreground"
      >
        ← Todas las rondas
      </Link>

      <header className="space-y-3">
        <div className="flex flex-wrap items-center gap-3">
          <RoundStatusBadge status={round.status} />
          <span className="text-xs uppercase tracking-[0.22em] text-muted-foreground">
            {formatDate(round.startsAt)} → {formatDate(round.endsAt)}
          </span>
        </div>
        <h1 className="display text-3xl md:text-4xl leading-[1.05] tracking-tight">{round.title}</h1>
        {round.description ? (
          <p className="max-w-2xl text-sm text-muted-foreground leading-relaxed">{round.description}</p>
        ) : null}

        {round.status === "OPEN" ? (
          <div className="pt-1">
            <SuggestBookDialog roundId={round.id} />
          </div>
        ) : null}
      </header>

      {round.status === "CLOSED" && round.winner ? (
        <Card className="p-6 bg-gradient-to-br from-accent/15 via-card to-card">
          <div className="flex items-center gap-2 text-xs uppercase tracking-[0.24em] text-accent-text">
            <Crown className="h-4 w-4" />
            Libro ganador
          </div>
          <div className="mt-3 flex flex-col md:flex-row gap-5">
            <BookCover src={round.winner.coverUrl} title={round.winner.title} size="lg" />
            <div className="flex-1">
              <h2 className="display text-2xl md:text-3xl leading-tight">{round.winner.title}</h2>
              {round.winner.authors.length ? (
                <p className="mt-2 text-muted-foreground">
                  {round.winner.authors.join(", ")}
                </p>
              ) : null}
              {round.winner.description ? (
                <p className="mt-4 line-clamp-4 text-sm text-muted-foreground">
                  {round.winner.description}
                </p>
              ) : null}
              <div className="mt-4">
                <Button asChild variant="outline">
                  <Link href={routes.libro(round.winner.id)}>Ver libro</Link>
                </Button>
              </div>
            </div>
          </div>
        </Card>
      ) : null}

      <section className="space-y-3">
        <div className="flex items-center justify-between">
          <h2 className="text-xs uppercase tracking-[0.32em] text-muted-foreground">
            {round.suggestions.length} sugerencia{round.suggestions.length === 1 ? "" : "s"}
          </h2>
          <span className="text-xs uppercase tracking-[0.22em] text-muted-foreground">
            {totalVotes} voto{totalVotes === 1 ? "" : "s"} en total
          </span>
        </div>

        {round.suggestions.length === 0 ? (
          <Card className="p-8 text-center">
            <p className="hand-script text-2xl">Sin sugerencias todavía</p>
            <p className="mt-2 text-sm text-muted-foreground">
              {round.status === "OPEN"
                ? "Sé la primera en sugerir un libro."
                : "Esta ronda no recibió sugerencias."}
            </p>
          </Card>
        ) : (
          <RoundSuggestionsList
            currentUserId={userId}
            isAdmin={isAdmin}
            canVote={canVote}
            winnerBookId={round.winnerBookId}
            suggestions={round.suggestions.map((s) => ({
              id: s.id,
              bookId: s.bookId,
              pitch: s.pitch,
              userId: s.userId,
              votes: s.votes,
              voteCount: s._count.votes,
              book: {
                id: s.book.id,
                title: s.book.title,
                authors: s.book.authors,
                coverUrl: s.book.coverUrl,
                publishedYear: s.book.publishedYear,
              },
              user: {
                id: s.user.id,
                name: s.user.name,
                email: s.user.email,
                image: s.user.image,
              },
            }))}
          />
        )}
      </section>
    </div>
  );
}
