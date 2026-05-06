import Link from "next/link";
import { notFound } from "next/navigation";
import { Crown, Trash2 } from "lucide-react";
import { db } from "@/lib/db";
import { auth } from "@/lib/auth";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { BookCover } from "@/components/book-cover";
import { VoteButton } from "@/components/vote-button";
import { RoundStatusBadge } from "@/components/round-status-badge";
import { SuggestBookDialog } from "@/components/suggest-book-dialog";
import { DeleteSuggestionButton } from "@/components/delete-suggestion-button";
import { formatDate, getInitials } from "@/lib/utils";

export default async function RondaPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const session = await auth();
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
    <div className="space-y-7">
      <Link
        href="/rondas"
        className="inline-flex items-center gap-1 text-xs uppercase tracking-[0.24em] text-muted-foreground hover:text-foreground"
      >
        ← Todas las rondas
      </Link>

      <header className="space-y-4">
        <div className="flex flex-wrap items-center gap-3">
          <RoundStatusBadge status={round.status} />
          <span className="text-xs uppercase tracking-[0.22em] text-muted-foreground">
            {formatDate(round.startsAt)} → {formatDate(round.endsAt)}
          </span>
        </div>
        <h1 className="h1-display display">{round.title}</h1>
        {round.description ? (
          <p className="max-w-2xl text-muted-foreground leading-relaxed">{round.description}</p>
        ) : null}

        {round.status === "OPEN" ? (
          <div className="pt-2">
            <SuggestBookDialog roundId={round.id} />
          </div>
        ) : null}
      </header>

      {round.status === "CLOSED" && round.winner ? (
        <Card className="p-8 bg-gradient-to-br from-accent/15 via-card to-card">
          <div className="flex items-center gap-2 text-xs uppercase tracking-[0.24em] text-accent">
            <Crown className="h-4 w-4" />
            Libro ganador
          </div>
          <div className="mt-4 flex flex-col md:flex-row gap-6">
            <BookCover src={round.winner.coverUrl} title={round.winner.title} size="lg" />
            <div className="flex-1">
              <h2 className="display text-3xl leading-tight">{round.winner.title}</h2>
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
                  <Link href={`/libros/${round.winner.id}`}>Ver libro</Link>
                </Button>
              </div>
            </div>
          </div>
        </Card>
      ) : null}

      <section className="space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="text-xs uppercase tracking-[0.32em] text-muted-foreground">
            {round.suggestions.length} sugerencia{round.suggestions.length === 1 ? "" : "s"}
          </h2>
          <span className="text-xs uppercase tracking-[0.22em] text-muted-foreground">
            {totalVotes} voto{totalVotes === 1 ? "" : "s"} en total
          </span>
        </div>

        {round.suggestions.length === 0 ? (
          <Card className="p-10 text-center">
            <p className="hand-script text-2xl">Sin sugerencias todavía</p>
            <p className="mt-2 text-sm text-muted-foreground">
              {round.status === "OPEN"
                ? "Sé la primera en sugerir un libro."
                : "Esta ronda no recibió sugerencias."}
            </p>
          </Card>
        ) : (
          <ul className="space-y-3">
            {round.suggestions.map((s, idx) => {
              const userVoted = s.votes.some((v) => v.userId === userId);
              const isOwner = s.userId === userId;
              const isWinner = round.winnerBookId === s.bookId;
              return (
                <li key={s.id}>
                  <Card
                    className={`p-5 transition-all ${
                      isWinner ? "ring-1 ring-accent" : ""
                    }`}
                  >
                    <div className="flex flex-col md:flex-row gap-5">
                      <div className="flex items-center gap-2 md:flex-col md:items-center md:gap-1 md:w-12">
                        <span className="display text-2xl text-muted-foreground tabular-nums">
                          {String(idx + 1).padStart(2, "0")}
                        </span>
                        {isWinner ? (
                          <Crown className="h-4 w-4 text-accent" />
                        ) : null}
                      </div>

                      <BookCover src={s.book.coverUrl} title={s.book.title} size="md" />

                      <div className="flex-1 min-w-0 space-y-2">
                        <div>
                          <Link
                            href={`/libros/${s.book.id}`}
                            className="display text-xl leading-tight hover:text-primary transition-colors"
                          >
                            {s.book.title}
                          </Link>
                          {s.book.authors.length ? (
                            <p className="text-sm text-muted-foreground">
                              {s.book.authors.join(", ")}
                            </p>
                          ) : null}
                        </div>

                        {s.pitch ? (
                          <blockquote className="rounded-lg bg-primary/5 px-3 py-2 italic text-sm text-muted-foreground">
                            "{s.pitch}"
                          </blockquote>
                        ) : null}

                        <div className="flex items-center gap-2 pt-1">
                          <Avatar className="h-6 w-6">
                            {s.user.image ? <AvatarImage src={s.user.image} alt="" /> : null}
                            <AvatarFallback className="text-[10px]">
                              {getInitials(s.user.name, s.user.email)}
                            </AvatarFallback>
                          </Avatar>
                          <span className="text-xs text-muted-foreground">
                            Sugerido por {s.user.name ?? s.user.email?.split("@")[0]}
                          </span>
                        </div>
                      </div>

                      <div className="flex items-center gap-2 md:flex-col md:items-end md:justify-center">
                        <VoteButton
                          suggestionId={s.id}
                          initialVoted={userVoted}
                          initialCount={s._count.votes}
                          disabled={!canVote}
                        />
                        {(isOwner && canVote) || isAdmin ? (
                          <DeleteSuggestionButton suggestionId={s.id} />
                        ) : null}
                      </div>
                    </div>
                  </Card>
                </li>
              );
            })}
          </ul>
        )}
      </section>
    </div>
  );
}
