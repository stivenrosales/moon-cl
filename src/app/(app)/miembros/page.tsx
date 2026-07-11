import { getSession } from "@/lib/session";
import { db } from "@/lib/db";
import { booksInCommon } from "@/server/services/social";
import { MemberList, type MemberRow } from "@/components/member-list";

export const metadata = { title: "Miembros" };

const WEEK_MS = 7 * 24 * 60 * 60 * 1000;

export default async function MiembrosPage() {
  const session = await getSession();
  if (!session?.user?.id) return null;
  const userId = session.user.id;

  const [users, myFollowing, readingRows] = await Promise.all([
    db.user.findMany({
      where: { id: { not: userId } },
      orderBy: { name: "asc" },
    }),
    db.follow.findMany({ where: { followerId: userId }, select: { followingId: true } }),
    db.userBook.findMany({
      where: { status: "READING" },
      orderBy: { updatedAt: "desc" },
      include: { book: { select: { title: true } } },
    }),
  ]);

  const followingSet = new Set(myFollowing.map((f) => f.followingId));

  const readingByUser = new Map<string, string>();
  for (const ub of readingRows) {
    if (!readingByUser.has(ub.userId)) readingByUser.set(ub.userId, ub.book.title);
  }

  const weekAgo = new Date(Date.now() - WEEK_MS);

  const rows: MemberRow[] = await Promise.all(
    users.map(async (u) => ({
      id: u.id,
      name: u.name,
      email: u.email,
      image: u.image,
      isFollowing: followingSet.has(u.id),
      booksInCommon: await booksInCommon(userId, u.id),
      readingTitle: readingByUser.get(u.id) ?? null,
      isNew: u.createdAt >= weekAgo,
    })),
  );

  return (
    <div className="space-y-6">
      <header>
        <span className="text-xs uppercase tracking-[0.32em] text-accent-text">
          El club
        </span>
        <h1 className="display text-3xl md:text-4xl leading-[1.05] tracking-tight mt-1.5">
          <span className="hand-script italic text-primary">Miembros</span>
        </h1>
        <p className="mt-2 max-w-xl text-sm text-muted-foreground">
          Encuentra a quienes leen contigo bajo la misma luna.
        </p>
      </header>

      <MemberList rows={rows} />
    </div>
  );
}
