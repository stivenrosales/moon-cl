import { db } from "@/lib/db";
import { Card } from "@/components/ui/card";
import { rankByPoints } from "@/server/services/kahoot-ranking";
import { KahootLeaderboard, type LeaderboardEntry, type ActivityLeaderboard } from "./kahoot-leaderboard";

export const metadata = { title: "Puntajes" };

function memberName(user: { name: string | null; email: string | null } | null) {
  return user?.name ?? user?.email?.split("@")[0] ?? "Miembro";
}

function pluralize(count: number, singular: string, plural: string) {
  return count === 1 ? singular : plural;
}

export default async function PuntajesPage() {
  const [totals, activities] = await Promise.all([
    // Acumulado del club: total de puntos y cantidad de trivias jugadas por
    // persona, agregado en la base con groupBy (no en memoria).
    db.kahootScore.groupBy({
      by: ["userId"],
      _sum: { points: true },
      _count: true,
    }),
    db.kahootActivity.findMany({
      orderBy: { playedAt: "desc" },
      include: {
        scores: {
          include: {
            user: { select: { id: true, name: true, email: true, image: true } },
          },
        },
      },
    }),
  ]);

  const userIds = totals.map((t) => t.userId);
  const users = userIds.length
    ? await db.user.findMany({
        where: { id: { in: userIds } },
        select: { id: true, name: true, email: true, image: true },
      })
    : [];
  const userMap = new Map(users.map((u) => [u.id, u]));

  const accumulatedRanked = rankByPoints(
    totals
      .map((t) => ({ ...t, user: userMap.get(t.userId) ?? null }))
      .filter((t) => t.user !== null),
    (t) => t._sum.points ?? 0,
  );

  const accumulated: LeaderboardEntry[] = accumulatedRanked.map((t) => {
    const played = t._count;
    return {
      rank: t.rank,
      userId: t.userId,
      name: memberName(t.user),
      image: t.user?.image ?? null,
      points: t._sum.points ?? 0,
      caption: `${played} ${pluralize(played, "kahoot jugado", "kahoots jugados")}`,
    };
  });

  const activityLeaderboards: ActivityLeaderboard[] = activities.map((a) => {
    const ranked = rankByPoints(a.scores, (s) => s.points);
    const entries: LeaderboardEntry[] = ranked.map((s) => ({
      rank: s.rank,
      userId: s.userId,
      name: memberName(s.user),
      image: s.user?.image ?? null,
      points: s.points,
      caption:
        s.correctAnswers != null
          ? `${s.correctAnswers} ${pluralize(s.correctAnswers, "respuesta correcta", "respuestas correctas")}`
          : "",
    }));
    return {
      id: a.id,
      title: a.title,
      playedAt: a.playedAt,
      entries,
    };
  });

  const lastActivity = activities[0] ?? null;

  return (
    <div className="space-y-6 md:space-y-8">
      <header>
        <span className="text-xs uppercase tracking-[0.32em] text-accent-text">Trivias del club</span>
        <h1 className="display text-3xl md:text-4xl leading-[1.05] tracking-tight mt-1.5">
          <span className="hand-script italic text-primary">Puntajes</span> de Kahoot
        </h1>
        <p className="mt-2 max-w-xl text-sm text-muted-foreground">
          Quién ha jugado, cuánto ha sumado y qué se jugó en cada trivia. Nada de ligas ni descensos, solo el gusto de competir juntos.
        </p>
      </header>

      {activities.length === 0 ? (
        <Card className="p-8 text-center">
          <p className="hand-script text-2xl">Aún no hay trivias jugadas</p>
          <p className="mt-2 text-sm text-muted-foreground">
            Cuando el club juegue su primer Kahoot, los puntajes aparecerán acá.
          </p>
        </Card>
      ) : (
        <KahootLeaderboard
          accumulated={accumulated}
          activities={activityLeaderboards}
          lastActivity={lastActivity ? { title: lastActivity.title, playedAt: lastActivity.playedAt } : null}
        />
      )}
    </div>
  );
}
