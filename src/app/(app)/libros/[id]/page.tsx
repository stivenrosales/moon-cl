import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, BookOpen, MessageSquare, Star, Users } from "lucide-react";
import { getSession } from "@/lib/session";
import { db } from "@/lib/db";
import { Card } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Progress } from "@/components/ui/progress";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { BookCover } from "@/components/book-cover";
import { ProgressForm } from "@/components/progress-form";
import { RatingForm } from "@/components/rating-form";
import { StarRating } from "@/components/star-rating";
import { CommentsSection, type CommentNode } from "@/components/comments-section";
import { BookEditDialog } from "@/components/book-edit-dialog";
import { formatDate, getInitials, pageProgress, relativeTime } from "@/lib/utils";
import { isModeratorOrAbove } from "@/lib/permissions";

export default async function BookPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const session = await getSession();
  if (!session?.user?.id) return null;
  const userId = session.user.id;

  const book = await db.book.findUnique({
    where: { id },
    include: {
      progressUpdates: {
        orderBy: { createdAt: "desc" },
        include: { user: { select: { id: true, name: true, email: true, image: true } } },
      },
      ratings: {
        include: { user: { select: { id: true, name: true, email: true, image: true } } },
      },
      meetings: { orderBy: { startsAt: "asc" } },
      comments: {
        where: { parentId: null },
        orderBy: { createdAt: "desc" },
        include: {
          user: { select: { id: true, name: true, email: true, image: true } },
          replies: {
            orderBy: { createdAt: "asc" },
            include: { user: { select: { id: true, name: true, email: true, image: true } } },
          },
        },
      },
    },
  });

  if (!book) notFound();

  // Latest progress per user
  const latestByUser = new Map<string, (typeof book.progressUpdates)[number]>();
  for (const p of book.progressUpdates) {
    if (!latestByUser.has(p.userId)) latestByUser.set(p.userId, p);
  }
  const myLatest = latestByUser.get(userId);
  const allLatest = Array.from(latestByUser.values());

  const myRating = book.ratings.find((r) => r.userId === userId);
  const otherRatings = book.ratings.filter((r) => r.userId !== userId);
  const avgStars = book.ratings.length
    ? book.ratings.reduce((s, r) => s + r.stars, 0) / book.ratings.length
    : 0;

  const isModerator = isModeratorOrAbove(session.user.role);

  return (
    <div className="space-y-5 md:space-y-6">
      <Link
        href="/biblioteca"
        className="inline-flex items-center gap-1 text-xs uppercase tracking-[0.24em] text-muted-foreground hover:text-foreground"
      >
        <ArrowLeft className="h-3 w-3" /> Biblioteca
      </Link>

      <header className="space-y-4 md:space-y-0 md:grid md:grid-cols-[auto_1fr] md:gap-8 md:items-start">
        {/* Mobile: cover + title in 2-col layout. Desktop: cover left, full content right */}
        <div className="flex gap-4 md:contents">
          <BookCover
            src={book.coverUrl}
            title={book.title}
            size="md"
            className="md:hidden shrink-0"
          />
          <BookCover
            src={book.coverUrl}
            title={book.title}
            size="xl"
            className="hidden md:block"
          />
          <div className="min-w-0 flex-1 md:hidden space-y-2">
            <div className="flex flex-wrap items-center gap-1.5">
              {book.isCurrent ? <Badge variant="default">En curso</Badge> : null}
              {book.status === "FINISHED" ? <Badge variant="gold">Leído</Badge> : null}
              {book.publishedYear ? <Badge variant="outline">{book.publishedYear}</Badge> : null}
            </div>
            <h1 className="display text-2xl leading-[1.1] tracking-tight break-words">
              {book.title}
            </h1>
            {book.authors.length ? (
              <p className="text-sm text-muted-foreground break-words line-clamp-2">
                {book.authors.join(", ")}
              </p>
            ) : null}
            {book.pageCount ? (
              <p className="text-[10px] uppercase tracking-[0.18em] text-muted-foreground">
                {book.pageCount} páginas
              </p>
            ) : null}
          </div>
        </div>

        {/* Desktop full content */}
        <div className="hidden md:block space-y-3 min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            {book.isCurrent ? <Badge variant="default">Libro en curso</Badge> : null}
            {book.status === "FINISHED" ? <Badge variant="gold">Leído</Badge> : null}
            {book.publishedYear ? <Badge variant="outline">{book.publishedYear}</Badge> : null}
            {book.pageCount ? <Badge variant="secondary">{book.pageCount} páginas</Badge> : null}
          </div>
          <div className="flex flex-wrap items-start gap-3">
            <h1 className="display text-4xl leading-[1.05] tracking-tight flex-1 min-w-0 break-words">{book.title}</h1>
            {isModerator ? (
              <BookEditDialog
                book={{
                  id: book.id,
                  title: book.title,
                  authors: book.authors,
                  coverUrl: book.coverUrl,
                  description: book.description,
                  pageCount: book.pageCount,
                  publishedYear: book.publishedYear,
                  isbn: book.isbn,
                }}
              />
            ) : null}
          </div>
          {book.authors.length ? (
            <p className="text-lg text-muted-foreground break-words">{book.authors.join(", ")}</p>
          ) : null}
          {book.ratings.length ? (
            <div className="flex items-center gap-3">
              <StarRating value={Math.round(avgStars)} readOnly size={18} />
              <span className="text-sm text-muted-foreground tabular-nums">
                {avgStars.toFixed(1)} · {book.ratings.length} valoracion
                {book.ratings.length === 1 ? "" : "es"}
              </span>
            </div>
          ) : null}
          {book.description ? (
            <details className="group">
              <summary className="cursor-pointer text-xs uppercase tracking-[0.22em] text-primary list-none">
                Sinopsis ↓
              </summary>
              <p className="mt-3 text-sm text-muted-foreground leading-relaxed whitespace-pre-line break-words">
                {book.description}
              </p>
            </details>
          ) : null}
        </div>

        {/* Mobile: rating row + edit + description below cover */}
        <div className="md:hidden space-y-3 min-w-0">
          {book.ratings.length || isModerator ? (
            <div className="flex items-center justify-between gap-3">
              {book.ratings.length ? (
                <div className="flex items-center gap-2">
                  <StarRating value={Math.round(avgStars)} readOnly size={16} />
                  <span className="text-xs text-muted-foreground tabular-nums">
                    {avgStars.toFixed(1)} · {book.ratings.length}
                  </span>
                </div>
              ) : <span />}
              {isModerator ? (
                <BookEditDialog
                  book={{
                    id: book.id,
                    title: book.title,
                    authors: book.authors,
                    coverUrl: book.coverUrl,
                    description: book.description,
                    pageCount: book.pageCount,
                    publishedYear: book.publishedYear,
                    isbn: book.isbn,
                  }}
                />
              ) : null}
            </div>
          ) : null}
          {book.description ? (
            <details className="group">
              <summary className="cursor-pointer text-xs uppercase tracking-[0.22em] text-primary list-none">
                Sinopsis ↓
              </summary>
              <p className="mt-2 text-sm text-muted-foreground leading-relaxed whitespace-pre-line break-words">
                {book.description}
              </p>
            </details>
          ) : null}
        </div>
      </header>

      <Tabs defaultValue={book.isCurrent ? "progress" : "ratings"}>
        <TabsList className="w-full grid sm:inline-flex sm:w-auto" style={{ gridTemplateColumns: book.isCurrent ? "repeat(3, minmax(0, 1fr))" : "repeat(1, minmax(0, 1fr))" }}>
          {book.isCurrent ? (
            <>
              <TabsTrigger value="progress" className="px-2 sm:px-3.5">
                <BookOpen className="mr-1.5 sm:mr-2 h-3.5 w-3.5 shrink-0" />
                <span className="text-xs sm:text-sm">Avance</span>
              </TabsTrigger>
              <TabsTrigger value="comments" className="px-2 sm:px-3.5">
                <MessageSquare className="mr-1.5 sm:mr-2 h-3.5 w-3.5 shrink-0" />
                <span className="text-xs sm:text-sm">
                  <span className="sm:hidden">Coment. </span>
                  <span className="hidden sm:inline">Comentarios </span>
                  ({book.comments.length})
                </span>
              </TabsTrigger>
            </>
          ) : null}
          <TabsTrigger value="ratings" className="px-2 sm:px-3.5">
            <Star className="mr-1.5 sm:mr-2 h-3.5 w-3.5 shrink-0" />
            <span className="text-xs sm:text-sm">
              <span className="sm:hidden">Valor. </span>
              <span className="hidden sm:inline">Valoraciones </span>
              ({book.ratings.length})
            </span>
          </TabsTrigger>
        </TabsList>

        {book.isCurrent ? (
          <TabsContent value="progress" className="space-y-6">
            <Card className="p-5">
              <h2 className="display text-2xl">Tu avance</h2>
              <p className="mt-1 text-sm text-muted-foreground">
                Marca por dónde vas. Inspira al club ✦
              </p>
              <div className="mt-5">
                <ProgressForm
                  bookId={book.id}
                  totalPages={book.pageCount}
                  initialPage={myLatest?.currentPage ?? 0}
                />
              </div>
            </Card>

            <Card className="p-5">
              <h2 className="display text-2xl flex items-center gap-2">
                <Users className="h-5 w-5 text-primary" /> Avance del club
              </h2>
              {allLatest.length === 0 ? (
                <p className="mt-3 text-sm text-muted-foreground">
                  Nadie ha marcado avance todavía.
                </p>
              ) : (
                <ul className="mt-5 space-y-4">
                  {allLatest
                    .sort((a, b) => b.currentPage - a.currentPage)
                    .map((p) => {
                      const pct = pageProgress(p.currentPage, book.pageCount);
                      return (
                        <li key={p.userId} className="space-y-2">
                          <div className="flex items-center gap-3">
                            <Avatar className="h-7 w-7">
                              {p.user.image ? <AvatarImage src={p.user.image} alt="" /> : null}
                              <AvatarFallback className="text-[10px]">
                                {getInitials(p.user.name, p.user.email)}
                              </AvatarFallback>
                            </Avatar>
                            <span className="text-sm font-medium">
                              {p.user.name ?? p.user.email?.split("@")[0]}
                            </span>
                            <span className="ml-auto text-xs uppercase tracking-[0.18em] text-muted-foreground tabular-nums">
                              pág. {p.currentPage}
                              {book.pageCount ? ` / ${book.pageCount}` : ""} · {pct}%
                            </span>
                          </div>
                          <Progress value={pct} />
                          {p.note ? (
                            <p className="ml-10 text-xs italic text-muted-foreground">"{p.note}"</p>
                          ) : null}
                        </li>
                      );
                    })}
                </ul>
              )}
            </Card>
          </TabsContent>
        ) : null}

        {book.isCurrent ? (
          <TabsContent value="comments">
            <CommentsSection
              bookId={book.id}
              comments={book.comments as unknown as CommentNode[]}
              currentUserId={userId}
              isModerator={isModerator}
            />
          </TabsContent>
        ) : null}

        <TabsContent value="ratings" className="space-y-6">
          <Card className="p-5">
            <h2 className="display text-2xl">Tu valoración</h2>
            <p className="mt-1 text-sm text-muted-foreground">
              Una estrella vale más que mil palabras (pero ambas son bienvenidas).
            </p>
            <div className="mt-5">
              <RatingForm
                bookId={book.id}
                initialStars={myRating?.stars ?? 0}
                initialReview={myRating?.review ?? ""}
              />
            </div>
          </Card>

          <div className="space-y-3">
            <h3 className="text-xs uppercase tracking-[0.32em] text-muted-foreground">
              Reseñas del club
            </h3>
            {otherRatings.length === 0 ? (
              <p className="text-sm text-muted-foreground">
                Aún sin reseñas de otras lectoras.
              </p>
            ) : (
              <ul className="space-y-3">
                {otherRatings.map((r) => (
                  <li key={r.id}>
                    <Card className="p-4">
                      <div className="flex items-center gap-3">
                        <Avatar className="h-7 w-7">
                          {r.user.image ? <AvatarImage src={r.user.image} alt="" /> : null}
                          <AvatarFallback className="text-[10px]">
                            {getInitials(r.user.name, r.user.email)}
                          </AvatarFallback>
                        </Avatar>
                        <span className="text-sm font-medium">
                          {r.user.name ?? r.user.email?.split("@")[0]}
                        </span>
                        <StarRating value={r.stars} readOnly size={16} />
                        <span className="ml-auto text-[10px] uppercase tracking-[0.18em] text-muted-foreground">
                          {relativeTime(r.createdAt)}
                        </span>
                      </div>
                      {r.review ? (
                        <p className="mt-3 text-sm text-muted-foreground whitespace-pre-line">
                          {r.review}
                        </p>
                      ) : null}
                    </Card>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}
