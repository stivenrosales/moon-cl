import { redirect } from "next/navigation";
import Link from "next/link";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { Card } from "@/components/ui/card";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { BookCover } from "@/components/book-cover";
import { RoundStatusBadge } from "@/components/round-status-badge";
import { NewRoundForm } from "@/components/admin/round-form";
import { RoundActions } from "@/components/admin/round-actions";
import { NewMeetingForm } from "@/components/admin/meeting-form";
import { RoleSelect } from "@/components/admin/role-select";
import { BookStateButtons } from "@/components/admin/book-state-buttons";
import { formatDate, getInitials } from "@/lib/utils";
import { isModeratorOrAbove } from "@/lib/permissions";

export const metadata = { title: "Panel admin" };

export default async function AdminPage() {
  const session = await auth();
  if (!session?.user?.id) redirect("/login");
  if (!isModeratorOrAbove(session.user.role)) redirect("/dashboard");

  const isAdmin = session.user.role === "ADMIN";

  const [rounds, books, users, meetings] = await Promise.all([
    db.round.findMany({
      orderBy: [{ status: "asc" }, { startsAt: "desc" }],
      include: { _count: { select: { suggestions: true } } },
    }),
    db.book.findMany({
      orderBy: [{ isCurrent: "desc" }, { createdAt: "desc" }],
      take: 50,
    }),
    db.user.findMany({ orderBy: { createdAt: "desc" } }),
    db.meeting.findMany({
      orderBy: { startsAt: "desc" },
      take: 20,
      include: { _count: { select: { rsvps: true } } },
    }),
  ]);

  const bookOptions = books.map((b) => ({ id: b.id, title: b.title }));

  return (
    <div className="space-y-12">
      <header>
        <span className="text-xs uppercase tracking-[0.32em] text-accent">Cabina del club</span>
        <h1 className="h1-display display mt-2">
          Panel <span className="hand-script italic text-primary">admin</span>
        </h1>
      </header>

      {/* Rondas */}
      {isAdmin ? (
        <section id="rondas" className="space-y-4">
          <h2 className="display text-2xl">Rondas</h2>
          <div className="grid grid-cols-1 lg:grid-cols-[0.9fr_1.1fr] gap-6">
            <Card className="p-6">
              <h3 className="text-xs uppercase tracking-[0.32em] text-muted-foreground">Nueva ronda</h3>
              <div className="mt-4">
                <NewRoundForm />
              </div>
            </Card>

            <Card className="p-6">
              <h3 className="text-xs uppercase tracking-[0.32em] text-muted-foreground">Existentes</h3>
              {rounds.length === 0 ? (
                <p className="mt-4 text-sm text-muted-foreground">Aún no hay rondas.</p>
              ) : (
                <ul className="mt-4 divide-y divide-border/60">
                  {rounds.map((r) => (
                    <li key={r.id} className="py-3 flex items-center gap-3 flex-wrap">
                      <RoundStatusBadge status={r.status} />
                      <Link href={`/rondas/${r.id}`} className="font-medium hover:text-primary truncate max-w-[180px]">
                        {r.title}
                      </Link>
                      <span className="text-xs text-muted-foreground">
                        {formatDate(r.startsAt)} → {formatDate(r.endsAt)}
                      </span>
                      <span className="ml-auto text-xs text-muted-foreground">
                        {r._count.suggestions} sug.
                      </span>
                      <RoundActions id={r.id} status={r.status} />
                    </li>
                  ))}
                </ul>
              )}
            </Card>
          </div>
        </section>
      ) : null}

      {/* Reuniones */}
      {isAdmin ? (
        <section id="reuniones" className="space-y-4">
          <h2 className="display text-2xl">Reuniones</h2>
          <div className="grid grid-cols-1 lg:grid-cols-[0.9fr_1.1fr] gap-6">
            <Card className="p-6">
              <h3 className="text-xs uppercase tracking-[0.32em] text-muted-foreground">Nueva reunión</h3>
              <div className="mt-4">
                <NewMeetingForm books={bookOptions} />
              </div>
            </Card>

            <Card className="p-6">
              <h3 className="text-xs uppercase tracking-[0.32em] text-muted-foreground">Últimas reuniones</h3>
              {meetings.length === 0 ? (
                <p className="mt-4 text-sm text-muted-foreground">Aún no hay reuniones.</p>
              ) : (
                <ul className="mt-4 divide-y divide-border/60">
                  {meetings.map((m) => (
                    <li key={m.id} className="py-3 flex items-center gap-3">
                      <Link href={`/reuniones/${m.id}`} className="font-medium hover:text-primary truncate max-w-[200px]">
                        {m.title}
                      </Link>
                      <span className="text-xs text-muted-foreground">
                        {formatDate(m.startsAt)}
                      </span>
                      <span className="ml-auto text-xs text-muted-foreground">
                        {m._count.rsvps} RSVP
                      </span>
                    </li>
                  ))}
                </ul>
              )}
            </Card>
          </div>
        </section>
      ) : null}

      {/* Libros */}
      {isAdmin ? (
        <section className="space-y-4">
          <h2 className="display text-2xl">Libros del club</h2>
          <Card className="p-6">
            {books.length === 0 ? (
              <p className="text-sm text-muted-foreground">Aún no hay libros.</p>
            ) : (
              <ul className="space-y-3">
                {books.map((b) => (
                  <li key={b.id} className="flex items-center gap-4">
                    <BookCover src={b.coverUrl} title={b.title} size="sm" />
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <Link href={`/libros/${b.id}`} className="font-medium hover:text-primary truncate">
                          {b.title}
                        </Link>
                        {b.isCurrent ? <Badge variant="default">En curso</Badge> : null}
                        {b.status === "FINISHED" ? <Badge variant="gold">Leído</Badge> : null}
                      </div>
                      <p className="text-xs text-muted-foreground line-clamp-1">
                        {b.authors.join(", ")}
                      </p>
                    </div>
                    <BookStateButtons bookId={b.id} isCurrent={b.isCurrent} />
                  </li>
                ))}
              </ul>
            )}
          </Card>
        </section>
      ) : null}

      {/* Roles */}
      {isAdmin ? (
        <section className="space-y-4">
          <h2 className="display text-2xl">Miembros del club</h2>
          <Card className="p-6">
            <ul className="divide-y divide-border/60">
              {users.map((u) => (
                <li key={u.id} className="py-3 flex items-center gap-3">
                  <Avatar className="h-8 w-8">
                    {u.image ? <AvatarImage src={u.image} alt="" /> : null}
                    <AvatarFallback>{getInitials(u.name, u.email)}</AvatarFallback>
                  </Avatar>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium truncate">{u.name ?? u.email}</p>
                    <p className="text-xs text-muted-foreground truncate">{u.email}</p>
                  </div>
                  <RoleSelect
                    userId={u.id}
                    current={u.role}
                    disabled={u.id === session.user!.id}
                  />
                </li>
              ))}
            </ul>
          </Card>
        </section>
      ) : null}
    </div>
  );
}
