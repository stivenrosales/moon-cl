import { getSession } from "@/lib/session";
import { db } from "@/lib/db";
import { booksInCommon } from "@/server/services/social";
import { computeAffinity, loadAffinityData } from "@/server/services/affinity";
import { MemberList, type MemberRow } from "@/components/member-list";

export const metadata = { title: "Miembros" };

const WEEK_MS = 7 * 24 * 60 * 60 * 1000;

export default async function MiembrosPage() {
  const session = await getSession();
  if (!session?.user?.id) return null;
  const userId = session.user.id;

  const users = await db.user.findMany({
    where: { id: { not: userId } },
    orderBy: { name: "asc" },
  });

  const [myFollowing, readingRows, affinityData] = await Promise.all([
    db.follow.findMany({ where: { followerId: userId }, select: { followingId: true } }),
    db.userBook.findMany({
      where: { status: "READING" },
      orderBy: { updatedAt: "desc" },
      include: { book: { select: { title: true } } },
    }),
    // Bulk: una sola pasada de afinidad para todo el directorio, en vez de
    // N cálculos por fila — solo alimenta la insignia "Muy afín" de abajo.
    loadAffinityData([userId, ...users.map((u) => u.id)]),
  ]);

  const viewerAffinityData = affinityData.get(userId);
  const followingSet = new Set(myFollowing.map((f) => f.followingId));

  const readingByUser = new Map<string, string>();
  for (const ub of readingRows) {
    if (!readingByUser.has(ub.userId)) readingByUser.set(ub.userId, ub.book.title);
  }

  const weekAgo = new Date(Date.now() - WEEK_MS);

  const rows: MemberRow[] = await Promise.all(
    users.map(async (u) => {
      const memberAffinityData = affinityData.get(u.id);
      const affinity =
        viewerAffinityData && memberAffinityData ? computeAffinity(viewerAffinityData, memberAffinityData) : null;
      // Contrato visual: la insignia "Muy afín" solo aparece con score alto
      // Y evidencia real detrás — nunca con datos vacíos.
      const veryAffine =
        !!affinity &&
        affinity.score >= 70 &&
        (affinity.evidence.librosEnComun > 0 || affinity.evidence.generosEnComun.length > 0);

      return {
        id: u.id,
        name: u.name,
        email: u.email,
        image: u.image,
        isFollowing: followingSet.has(u.id),
        booksInCommon: await booksInCommon(userId, u.id),
        readingTitle: readingByUser.get(u.id) ?? null,
        isNew: u.createdAt >= weekAgo,
        veryAffine,
      };
    }),
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
