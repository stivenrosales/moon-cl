import { cn } from "@/lib/utils";

interface RatingHistogramProps {
  ratings: { stars: number }[];
  className?: string;
}

/**
 * Contrato Letterboxd: promedio + mini-histograma antes de la conversación.
 * Barras neutras (solo border, sin relleno de acento) — Lemon se reserva
 * únicamente para el número del promedio, nunca para las barras (Lemon
 * solo señal, no decoración).
 */
export function RatingHistogram({ ratings, className }: RatingHistogramProps) {
  const total = ratings.length;
  if (total === 0) return null;

  const counts = [5, 4, 3, 2, 1].map((stars) => ({
    stars,
    count: ratings.filter((r) => r.stars === stars).length,
  }));
  const max = Math.max(1, ...counts.map((c) => c.count));
  const avg = ratings.reduce((sum, r) => sum + r.stars, 0) / total;

  return (
    <div className={cn("flex items-center gap-4", className)}>
      <div className="shrink-0 text-center">
        <p className="text-3xl font-semibold tabular-nums text-accent-text">{avg.toFixed(1)}</p>
        <p className="text-[10px] uppercase tracking-[0.18em] text-muted-foreground">
          {total} valoracion{total === 1 ? "" : "es"}
        </p>
      </div>
      <div className="flex-1 space-y-1">
        {counts.map(({ stars, count }) => (
          <div key={stars} className="flex items-center gap-2">
            <span className="w-3 text-[10px] tabular-nums text-muted-foreground">{stars}</span>
            <div className="h-2 flex-1 overflow-hidden rounded-full border border-border/50">
              <div
                className="h-full rounded-full bg-foreground/15"
                style={{ width: `${count > 0 ? Math.max(4, (count / max) * 100) : 0}%` }}
              />
            </div>
            <span className="w-5 text-right text-[10px] tabular-nums text-muted-foreground">
              {count}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}
