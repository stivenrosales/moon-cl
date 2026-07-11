import Link from "next/link";
import { Users } from "lucide-react";
import { getSession } from "@/lib/session";
import { db } from "@/lib/db";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { isModeratorOrAbove } from "@/lib/permissions";
import { loadFeed } from "@/server/services/feed";
import { computeAffinity, labelForScore, loadAffinityData } from "@/server/services/affinity";
import { currentMatchWeekOf } from "@/server/jobs/book-match";
import { MatchCard, type MatchCardMatch } from "@/components/match-card";
import { ActivityFeed } from "./activity-feed";
import { QuotesPanel } from "./quotes-panel";

export const metadata = { title: "Comunidad" };

export default async function ComunidadPage({
  searchParams,
}: {
  searchParams: Promise<{ tab?: string }>;
}) {
  const session = await getSession();
  if (!session?.user?.id) return null;
  const userId = session.user.id;
  const isModerator = isModeratorOrAbove(session.user.role);

  const { tab } = await searchParams;
  const activeTab = tab === "frases" || tab === "miembros" ? tab : "actividad";

  const [feed, quotes, shelfBooks, clubBook, viewerMatchSettings, weeklyMatch] = await Promise.all([
    loadFeed(userId),
    db.quote.findMany({
      orderBy: { createdAt: "desc" },
      take: 60,
      include: {
        user: { select: { id: true, name: true, email: true, image: true } },
        book: { select: { id: true, title: true, coverUrl: true } },
        likes: { select: { userId: true } },
        _count: { select: { likes: true } },
      },
    }),
    db.userBook.findMany({
      where: { userId },
      select: { book: { select: { id: true, title: true, coverUrl: true } } },
      orderBy: { updatedAt: "desc" },
    }),
    db.book.findFirst({
      where: { isCurrent: true },
      select: { id: true, title: true, coverUrl: true },
    }),
    db.user.findUnique({ where: { id: userId }, select: { isMatchOptIn: true } }),
    db.match.findFirst({
      where: { weekOf: currentMatchWeekOf(new Date()), OR: [{ userAId: userId }, { userBId: userId }] },
    }),
  ]);

  const quoteCards = quotes.map((q) => ({
    id: q.id,
    content: q.content,
    page: q.page,
    chapter: q.chapter,
    createdAt: q.createdAt,
    likeCount: q._count.likes,
    likedByViewer: q.likes.some((l) => l.userId === userId),
    book: q.book,
    user: q.user,
  }));

  const shareableBooks = dedupeById([
    ...(clubBook ? [clubBook] : []),
    ...shelfBooks.map((ub) => ub.book),
  ]);

  // Afinidad recalculada al vuelo (nunca se cachea el detalle): el score
  // guardado en Match es fijo desde el emparejamiento, pero la evidencia
  // (libros/géneros en común) se recompone en base a los datos actuales —
  // si evapora del todo, la card cae al estado "sin match" en vez de
  // mostrar un porcentaje sin nada real detrás (contrato: la afinidad
  // jamás se muestra con datos vacíos).
  let weeklyMatchCard: MatchCardMatch | null = null;
  if (weeklyMatch) {
    const otherId = weeklyMatch.userAId === userId ? weeklyMatch.userBId : weeklyMatch.userAId;
    const [otherUser, affinityData] = await Promise.all([
      db.user.findUnique({
        where: { id: otherId },
        select: { id: true, name: true, email: true, image: true },
      }),
      loadAffinityData([userId, otherId]),
    ]);
    const viewerData = affinityData.get(userId);
    const otherData = affinityData.get(otherId);
    const affinity = viewerData && otherData ? computeAffinity(viewerData, otherData) : null;

    if (otherUser && affinity) {
      weeklyMatchCard = {
        otherUserId: otherUser.id,
        otherUserName: otherUser.name,
        otherUserEmail: otherUser.email,
        otherUserImage: otherUser.image,
        score: weeklyMatch.score,
        label: labelForScore(weeklyMatch.score),
        evidence: affinity.evidence,
      };
    }
  }

  return (
    <div className="space-y-6 md:space-y-8">
      <header>
        <span className="text-xs uppercase tracking-[0.32em] text-accent-text">La conversación</span>
        <h1 className="display text-3xl md:text-4xl leading-[1.05] tracking-tight mt-1.5">
          La <span className="hand-script italic text-primary">comunidad</span>
        </h1>
        <p className="mt-2 max-w-xl text-sm text-muted-foreground">
          Lo que leen, califican y subrayan las personas que sigues — y todo el club.
        </p>
      </header>

      <Tabs defaultValue={activeTab}>
        <TabsList className="w-full grid grid-cols-3 sm:inline-flex sm:w-auto">
          <TabsTrigger value="actividad" className="px-2 sm:px-3.5">
            <span className="text-xs sm:text-sm">Actividad</span>
          </TabsTrigger>
          <TabsTrigger value="frases" className="px-2 sm:px-3.5">
            <span className="text-xs sm:text-sm">
              Frases <span className="tabular-nums">· {quoteCards.length}</span>
            </span>
          </TabsTrigger>
          <TabsTrigger value="miembros" className="px-2 sm:px-3.5">
            <span className="text-xs sm:text-sm">Miembros</span>
          </TabsTrigger>
        </TabsList>

        <TabsContent value="actividad" className="space-y-4">
          <MatchCard isOptedIn={viewerMatchSettings?.isMatchOptIn ?? false} match={weeklyMatchCard} />
          <ActivityFeed entries={feed} />
        </TabsContent>

        <TabsContent value="frases">
          <QuotesPanel
            quotes={quoteCards}
            books={shareableBooks}
            currentUserId={userId}
            isModerator={isModerator}
          />
        </TabsContent>

        <TabsContent value="miembros">
          <Card className="p-8 text-center">
            <Users className="mx-auto h-6 w-6 text-primary/60" />
            <p className="mt-2 hand-script text-2xl">Todo el club, en un vistazo</p>
            <p className="mt-1 text-sm text-muted-foreground">
              Perfiles, seguidores y a quién seguir.
            </p>
            <Button asChild className="mt-4">
              <Link href="/miembros">Ver miembros</Link>
            </Button>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}

function dedupeById<T extends { id: string }>(items: T[]): T[] {
  const seen = new Set<string>();
  const result: T[] = [];
  for (const item of items) {
    if (seen.has(item.id)) continue;
    seen.add(item.id);
    result.push(item);
  }
  return result;
}
