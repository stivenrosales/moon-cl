import Link from "next/link";
import { Vote } from "lucide-react";
import { db } from "@/lib/db";
import { Card } from "@/components/ui/card";
import { RoundStatusBadge } from "@/components/round-status-badge";
import { formatDate } from "@/lib/utils";
import { getSession } from "@/lib/session";

export const metadata = { title: "Rondas de votación" };

export default async function RondasPage() {
  const session = await getSession();
  const isAdmin = session?.user?.role === "ADMIN";

  const rounds = await db.round.findMany({
    orderBy: [{ status: "asc" }, { startsAt: "desc" }],
    include: {
      _count: { select: { suggestions: true } },
      winner: true,
    },
  });

  const open = rounds.filter((r) => r.status === "OPEN");
  const upcoming = rounds.filter((r) => r.status === "SCHEDULED");
  const closed = rounds.filter((r) => r.status === "CLOSED");

  return (
    <div className="space-y-6 md:space-y-8">
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <span className="text-xs uppercase tracking-[0.32em] text-accent-text">El club elige</span>
          <h1 className="display text-3xl md:text-4xl leading-[1.05] tracking-tight mt-1.5">
            Rondas de <span className="hand-script italic text-primary">votación</span>
          </h1>
        </div>
        {isAdmin ? (
          <Link
            href="/admin#rondas"
            className="text-xs uppercase tracking-[0.22em] text-muted-foreground hover:text-foreground transition-colors"
          >
            Gestionar →
          </Link>
        ) : null}
      </header>

      {open.length > 0 ? (
        <Section title="Activa ahora">
          {open.map((r) => (
            <RoundCard key={r.id} round={r} />
          ))}
        </Section>
      ) : (
        <Card className="p-8 text-center">
          <Vote className="mx-auto h-7 w-7 text-primary/60" />
          <p className="mt-3 hand-script text-2xl text-foreground">No hay ronda activa</p>
          <p className="mt-1 text-sm text-muted-foreground">
            Cuando un admin abra una ronda, aparecerá aquí.
          </p>
        </Card>
      )}

      {upcoming.length > 0 ? (
        <Section title="Próximas">
          {upcoming.map((r) => (
            <RoundCard key={r.id} round={r} />
          ))}
        </Section>
      ) : null}

      {closed.length > 0 ? (
        <Section title="Anteriores">
          {closed.map((r) => (
            <RoundCard key={r.id} round={r} />
          ))}
        </Section>
      ) : null}
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="space-y-3">
      <h2 className="text-xs uppercase tracking-[0.32em] text-muted-foreground">{title}</h2>
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3.5">{children}</div>
    </section>
  );
}

type R = Awaited<ReturnType<typeof db.round.findMany>> extends (infer U)[] ? U : never;

function RoundCard({
  round,
}: {
  round: R & { _count: { suggestions: number }; winner?: { title: string } | null };
}) {
  return (
    <Link href={`/rondas/${round.id}`} className="block focus-ring rounded-2xl">
      <Card className="p-5 transition-all hover:-translate-y-0.5 hover:shadow-[0_30px_60px_-30px_rgba(0,0,0,0.5)]">
        <div className="flex items-center gap-3">
          <RoundStatusBadge status={round.status} />
          <span className="text-xs uppercase tracking-[0.22em] text-muted-foreground">
            {formatDate(round.startsAt)} → {formatDate(round.endsAt)}
          </span>
        </div>
        <h3 className="display mt-2.5 text-xl md:text-2xl leading-tight">{round.title}</h3>
        {round.description ? (
          <p className="mt-1.5 text-sm text-muted-foreground line-clamp-2">{round.description}</p>
        ) : null}
        <div className="mt-3 flex items-center justify-between text-sm">
          <span className="text-muted-foreground">
            {round._count.suggestions} sugerencia{round._count.suggestions === 1 ? "" : "s"}
          </span>
          {round.winner ? (
            <span className="text-accent-text">
              ✦ {round.winner.title}
            </span>
          ) : null}
        </div>
      </Card>
    </Link>
  );
}
