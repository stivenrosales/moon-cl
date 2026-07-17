import Link from "next/link";
import { Shield } from "lucide-react";
import { getSession } from "@/lib/session";
import { db } from "@/lib/db";
import { Card } from "@/components/ui/card";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { BookCover } from "@/components/book-cover";
import { StarRating } from "@/components/star-rating";
import { ProfileEditDialog } from "@/components/profile-edit-dialog";
import { ProfileStat } from "@/components/profile-stat";
import { ThemeToggle } from "@/components/theme-toggle";
import { SignOutButton } from "@/components/sign-out-button";
import { getFollowCounts } from "@/server/services/social";
import { formatDate, getInitials } from "@/lib/utils";
import { routes } from "@/lib/routes";
import { getAccountAccessItems, type AccountAccessKey } from "@/lib/account-access";
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

  const accountAccess = getAccountAccessItems(user.role);
  const isAccountAccessVisible = (key: AccountAccessKey) =>
    accountAccess.find((item) => item.key === key)?.visible ?? false;

  return (
    <div className="space-y-7">
      {/* Identidad primero: avatar + nombre + rol + miembro desde.
          El toggle de tema NO debe pesar más que quién sos. */}
      <header className="flex items-center gap-4">
        <Avatar className="h-14 w-14">
          {user.image ? <AvatarImage src={user.image} alt="" /> : null}
          <AvatarFallback className="text-base">
            {getInitials(user.name, user.email)}
          </AvatarFallback>
        </Avatar>
        <div className="min-w-0 flex-1 space-y-1">
          <h1 className="h1-display display truncate">
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

      {/* Ajustes de cuenta: Apariencia, Herramientas del club, Cerrar sesión.
          Agrupados, filas compactas con etiqueta a la izquierda y control a
          la derecha — nada de una card entera para un toggle binario.
          Fuente de verdad: src/lib/account-access.ts */}
      <section className="divide-y divide-border/60 rounded-2xl border border-border/60 bg-muted/20">
        <div className="flex items-center justify-between px-4 py-3">
          <span className="text-sm font-medium text-foreground">Apariencia</span>
          <ThemeToggle />
        </div>
        {isAccountAccessVisible("admin") ? (
          <Link
            href={routes.admin()}
            className="flex items-center gap-2 px-4 py-3 text-sm font-medium text-foreground hover:bg-muted/40"
          >
            <Shield className="h-4 w-4 text-muted-foreground" />
            Herramientas del club
          </Link>
        ) : null}
        {isAccountAccessVisible("cerrar-sesion") ? (
          <div className="px-4 py-3">
            <SignOutButton />
          </div>
        ) : null}
      </section>

      {/* Stats */}
      <div className="grid grid-cols-4 gap-2">
        <ProfileStat compact label="Sugerencias" value={suggestions.length} />
        <ProfileStat compact label="Votos emitidos" value={votes} />
        <ProfileStat compact label="Comentarios" value={comments} />
        <ProfileStat compact label="Valoraciones" value={ratings.length} />
      </div>

      {/* Comunidad: seguidores/siguiendo, enlazan al directorio de miembros */}
      <div className="grid grid-cols-2 gap-2 max-w-sm">
        <ProfileStat
          compact
          label="Seguidores"
          value={followCounts.followers}
          href={routes.club({ vista: "personas" })}
        />
        <ProfileStat
          compact
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
