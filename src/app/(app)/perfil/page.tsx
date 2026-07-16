import Link from "next/link";
import { getSession } from "@/lib/session";
import { db } from "@/lib/db";
import { Card } from "@/components/ui/card";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { BookCover } from "@/components/book-cover";
import { StarRating } from "@/components/star-rating";
import { ProfileEditDialog } from "@/components/profile-edit-dialog";
import { ProfileStat } from "@/components/profile-stat";
import { getFollowCounts } from "@/server/services/social";
import { formatDate, getInitials } from "@/lib/utils";
import { routes } from "@/lib/routes";
import type { Role } from "@prisma/client";

const roleLabel: Record<Role, string> = {
  ADMIN: "Admin",
  MODERATOR: "Moderadora",
  MEMBER: "Miembro",
};

export const metadata = { title: "Mi perfil" };

export default async function PerfilPage() {
  const session = await getSession();
  if (!session?.user?.id) return null;
  const userId = session.user.id;

  const [user, suggestions, votes, ratings, comments, followCounts] = await Promise.all([
    db.user.findUnique({
      where: { id: userId },
      select: {
        id: true,
        name: true,
        email: true,
        image: true,
        role: true,
        createdAt: true,
        bio: true,
        birthday: true,
        favoriteGenres: true,
        isMatchOptIn: true,
      },
    }),
    db.bookSuggestion.findMany({
      where: { userId },
      include: { book: true, round: true, _count: { select: { votes: true } } },
      orderBy: { createdAt: "desc" },
    }),
    db.vote.count({ where: { userId } }),
    db.rating.findMany({
      where: { userId },
      include: { book: true },
      orderBy: { createdAt: "desc" },
    }),
    db.comment.count({ where: { userId, deletedAt: null } }),
    getFollowCounts(userId),
  ]);

  if (!user) return null;

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
          <span className="text-xs uppercase tracking-[0.32em] text-accent-text">Tu perfil</span>
          <h1 className="h1-display display">
            {user.name ?? user.email?.split("@")[0]}
          </h1>
          <div className="flex flex-wrap items-center gap-2">
            <Badge variant="default">{roleLabel[user.role]}</Badge>
            <span className="text-xs uppercase tracking-[0.22em] text-muted-foreground">
              {user.email}
            </span>
            <span className="text-xs text-muted-foreground">· miembro desde {formatDate(user.createdAt)}</span>
          </div>
        </div>
      </header>

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <ProfileStat label="Sugerencias" value={suggestions.length} />
        <ProfileStat label="Votos emitidos" value={votes} />
        <ProfileStat label="Comentarios" value={comments} />
        <ProfileStat label="Valoraciones" value={ratings.length} />
      </div>

      {/* Comunidad: seguidores/siguiendo, enlazan al directorio de miembros */}
      <div className="grid grid-cols-2 gap-4 max-w-sm">
        <ProfileStat
          label="Seguidores"
          value={followCounts.followers}
          href={routes.club({ vista: "personas" })}
        />
        <ProfileStat
          label="Siguiendo"
          value={followCounts.following}
          href={routes.club({ vista: "personas" })}
        />
      </div>

      {/* Botones */}
      <div className="flex flex-wrap gap-2">
        <ProfileEditDialog
          user={{
            id: user.id,
            name: user.name,
            email: user.email,
            image: user.image,
            bio: user.bio,
            birthday: user.birthday,
            favoriteGenres: user.favoriteGenres,
            isMatchOptIn: user.isMatchOptIn,
          }}
        />
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

      {/* Bio y cumpleaños */}
      {user.bio || user.birthday ? (
        <section className="space-y-2">
          {user.bio ? <p className="text-sm text-foreground/90 leading-relaxed">{user.bio}</p> : null}
          {user.birthday ? (
            <p className="text-xs text-muted-foreground">
              🎂 {formatDate(user.birthday, { year: undefined })}
            </p>
          ) : null}
        </section>
      ) : null}

      {/* Mis sugerencias */}
      <section className="space-y-4">
        <h2 className="text-xs uppercase tracking-[0.32em] text-muted-foreground">
          Mis sugerencias
        </h2>
        {suggestions.length === 0 ? (
          <Card className="p-8 text-sm text-muted-foreground text-center">
            Aún no has sugerido libros.
          </Card>
        ) : (
          <ul className="space-y-3">
            {suggestions.map((s) => (
              <li key={s.id}>
                <Card className="p-4">
                  <div className="flex gap-3">
                    <BookCover src={s.book.coverUrl} title={s.book.title} size="sm" />
                    <div className="flex-1 min-w-0">
                      <Link href={routes.libro(s.book.id)} className="font-medium hover:text-primary">
                        {s.book.title}
                      </Link>
                      <p className="text-xs text-muted-foreground">
                        {s.book.authors.join(", ")}
                      </p>
                      <p className="mt-1 text-xs text-muted-foreground">
                        Ronda{" "}
                        <Link href={routes.ronda(s.round.id)} className="hover:text-primary italic">
                          {s.round.title}
                        </Link>{" "}
                        · {s._count.votes} voto{s._count.votes === 1 ? "" : "s"}
                      </p>
                    </div>
                  </div>
                </Card>
              </li>
            ))}
          </ul>
        )}
      </section>

      {/* Mis valoraciones */}
      <section className="space-y-4">
        <h2 className="text-xs uppercase tracking-[0.32em] text-muted-foreground">
          Mis valoraciones
        </h2>
        {ratings.length === 0 ? (
          <Card className="p-8 text-sm text-muted-foreground text-center">
            Aún no has valorado libros.
          </Card>
        ) : (
          <ul className="space-y-3">
            {ratings.map((r) => (
              <li key={r.id}>
                <Card className="p-4">
                  <div className="flex gap-3">
                    <BookCover src={r.book.coverUrl} title={r.book.title} size="sm" />
                    <div className="flex-1 min-w-0">
                      <Link href={routes.libro(r.book.id)} className="font-medium hover:text-primary">
                        {r.book.title}
                      </Link>
                      <div className="mt-1">
                        <StarRating value={r.stars} readOnly size={14} />
                      </div>
                      {r.review ? (
                        <p className="mt-2 text-xs text-muted-foreground line-clamp-3">
                          {r.review}
                        </p>
                      ) : null}
                    </div>
                  </div>
                </Card>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
