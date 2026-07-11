import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { MessageCircle } from "lucide-react";
import { getSession } from "@/lib/session";
import { db } from "@/lib/db";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { BookCover } from "@/components/book-cover";
import { StarRating } from "@/components/star-rating";
import { FollowButton } from "@/components/follow-button";
import { ProfileStat } from "@/components/profile-stat";
import { getFollowCounts } from "@/server/services/social";
import { formatDate, getInitials } from "@/lib/utils";
import type { Role } from "@prisma/client";

const roleLabel: Record<Role, string> = {
  ADMIN: "Admin",
  MODERATOR: "Moderadora",
  MEMBER: "Miembro",
};

export default async function PerfilPublicoPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const session = await getSession();
  if (!session?.user?.id) return null;
  const myId = session.user.id;

  // Tu propio perfil vive en /perfil (con tus acciones de edición).
  if (id === myId) redirect("/perfil");

  const [user, isFollowing, followCounts, readThisYear, readingNow, clubBook, lastReview] =
    await Promise.all([
      db.user.findUnique({ where: { id } }),
      db.follow.findUnique({
        where: { followerId_followingId: { followerId: myId, followingId: id } },
      }),
      getFollowCounts(id),
      db.userBook.count({
        where: {
          userId: id,
          status: "FINISHED",
          finishedAt: { gte: new Date(new Date().getFullYear(), 0, 1) },
        },
      }),
      db.userBook.findMany({
        where: { userId: id, status: "READING" },
        include: { book: true },
        orderBy: { updatedAt: "desc" },
      }),
      db.book.findFirst({ where: { isCurrent: true } }),
      db.rating.findFirst({
        where: { userId: id, review: { not: null } },
        orderBy: { createdAt: "desc" },
        include: { book: true },
      }),
    ]);

  if (!user) notFound();

  const readingClubBook = clubBook
    ? readingNow.find((ub) => ub.bookId === clubBook.id)
    : undefined;

  const chapterComparison = readingClubBook
    ? await getChapterComparison(myId, id, clubBook!.id)
    : null;

  return (
    <div className="space-y-7">
      <header className="flex flex-col md:flex-row items-start gap-6">
        <Avatar className="h-20 w-20">
          {user.image ? <AvatarImage src={user.image} alt="" /> : null}
          <AvatarFallback className="text-xl">
            {getInitials(user.name, user.email)}
          </AvatarFallback>
        </Avatar>
        <div className="flex-1 space-y-2">
          <span className="text-xs uppercase tracking-[0.32em] text-accent-text">Perfil</span>
          <h1 className="h1-display display">
            {user.name ?? user.email?.split("@")[0]}
          </h1>
          <div className="flex flex-wrap items-center gap-2">
            <Badge variant="default">{roleLabel[user.role]}</Badge>
            <span className="text-xs text-muted-foreground">
              · miembro desde {formatDate(user.createdAt)}
            </span>
          </div>
        </div>
      </header>

      {/* Stats */}
      <div className="grid grid-cols-3 gap-4">
        <ProfileStat label="Leídos este año" value={readThisYear} />
        <ProfileStat label="Seguidores" value={followCounts.followers} href="/miembros" />
        <ProfileStat label="Siguiendo" value={followCounts.following} href="/miembros" />
      </div>

      {/* Botones */}
      <div className="flex flex-wrap gap-2">
        <FollowButton userId={user.id} initialFollowing={!!isFollowing} size="default" />
        <span title="Próximamente">
          <Button type="button" variant="outline" disabled className="gap-2">
            <MessageCircle className="h-4 w-4" />
            Mensaje
          </Button>
        </span>
      </div>

      {/* Géneros favoritos */}
      {user.favoriteGenres.length > 0 ? (
        <section className="space-y-3">
          <h2 className="text-xs uppercase tracking-[0.32em] text-muted-foreground">
            Géneros favoritos
          </h2>
          <div className="flex flex-wrap gap-2">
            {user.favoriteGenres.map((genre) => (
              <Badge key={genre} variant="outline">
                {genre}
              </Badge>
            ))}
          </div>
        </section>
      ) : null}

      {/* Leyendo ahora */}
      {readingNow.length > 0 ? (
        <section className="space-y-3">
          <h2 className="text-xs uppercase tracking-[0.32em] text-muted-foreground">
            Leyendo ahora
          </h2>
          <div className="flex gap-3 overflow-x-auto pb-2 scrollbar-hide">
            {readingNow.map((ub) => (
              <Link
                key={ub.id}
                href={`/libros/${ub.book.id}`}
                className="focus-ring shrink-0 space-y-1.5 rounded-md"
              >
                <BookCover src={ub.book.coverUrl} title={ub.book.title} size="sm" />
                {ub.bookId === clubBook?.id && chapterComparison ? (
                  <p className="w-14 text-center text-[9px] leading-tight text-accent-text">
                    {chapterComparison}
                  </p>
                ) : null}
              </Link>
            ))}
          </div>
        </section>
      ) : null}

      {/* Bio */}
      {user.bio ? (
        <section className="space-y-2">
          <p className="text-sm text-foreground/90 leading-relaxed">{user.bio}</p>
        </section>
      ) : null}

      {/* Última reseña */}
      {lastReview ? (
        <section className="space-y-3">
          <h2 className="text-xs uppercase tracking-[0.32em] text-muted-foreground">
            Última reseña
          </h2>
          <Card className="p-4">
            <div className="flex gap-3">
              <BookCover src={lastReview.book.coverUrl} title={lastReview.book.title} size="sm" />
              <div className="flex-1 min-w-0">
                <Link
                  href={`/libros/${lastReview.book.id}`}
                  className="font-medium hover:text-primary"
                >
                  {lastReview.book.title}
                </Link>
                <div className="mt-1">
                  <StarRating value={lastReview.stars} readOnly size={14} />
                </div>
                <p className="mt-2 text-xs text-muted-foreground line-clamp-3">
                  {lastReview.review}
                </p>
              </div>
            </div>
          </Card>
        </section>
      ) : null}
    </div>
  );
}

/**
 * Compara el capítulo del libro en curso del club entre "yo" y el usuario
 * del perfil visitado, usando el ReadingProgress más reciente de cada uno
 * (mismo campo que usa /mi-biblioteca para el avance compartido del club).
 * Si a alguno le falta el capítulo, no hay nada que comparar todavía.
 */
async function getChapterComparison(
  myId: string,
  otherId: string,
  bookId: string,
): Promise<string | null> {
  const [mine, theirs] = await Promise.all([
    db.readingProgress.findFirst({
      where: { userId: myId, bookId },
      orderBy: { createdAt: "desc" },
    }),
    db.readingProgress.findFirst({
      where: { userId: otherId, bookId },
      orderBy: { createdAt: "desc" },
    }),
  ]);

  if (!mine?.chapter || !theirs?.chapter) return null;

  const diff = theirs.chapter - mine.chapter;
  if (diff === 0) return "Va al mismo capítulo que tú";
  if (diff > 0) return `Va ${diff} cap. más adelante que tú`;
  return `Va ${Math.abs(diff)} cap. más atrás que tú`;
}
