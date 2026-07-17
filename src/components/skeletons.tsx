import { Card } from "@/components/ui/card";
import { cn } from "@/lib/utils";

// Piezas compartidas de skeleton: usadas tanto en el `loading.tsx` de cada
// segmento (primera navegación al tab, boundary de ruta) como en el
// `<Suspense>` inline que envuelve cada vista dentro del SegmentedControl
// (cambio de searchParam sin cambio de ruta). Un solo lugar de verdad para
// que el hueso nunca se desincronice del contenido real y produzca salto
// de layout.

export function Bone({ className }: { className?: string }) {
  return <div className={cn("animate-pulse rounded-md bg-muted", className)} aria-hidden />;
}

export function SegmentedControlSkeleton({ items }: { items: number }) {
  return (
    <div className="flex w-full border-b border-border">
      {Array.from({ length: items }).map((_, i) => (
        <div key={i} className="flex min-h-11 flex-1 items-center justify-center">
          <Bone className="h-4 w-24" />
        </div>
      ))}
    </div>
  );
}

// /leer?vista=mios — filas de estantería (misma forma que ShelfBookRow).
export function ShelfRowsSkeleton({ count = 4 }: { count?: number }) {
  return (
    <div className="space-y-3">
      {Array.from({ length: count }).map((_, i) => (
        <div
          key={i}
          className="flex items-center gap-3 rounded-xl border border-border/40 bg-card/40 p-2.5 sm:p-3"
        >
          <Bone className="h-20 w-14 shrink-0 rounded-md" />
          <div className="min-w-0 flex-1 space-y-1.5">
            <Bone className="h-4 w-2/3" />
            <Bone className="h-3 w-1/3" />
            <Bone className="h-1.5 w-full rounded-full" />
          </div>
          <Bone className="h-8 w-8 shrink-0 rounded-full" />
        </div>
      ))}
    </div>
  );
}

// /leer?vista=club — grid de portadas (misma forma que BookGrid). Distinta
// de ShelfRowsSkeleton a propósito: mostrar filas mientras carga un grid
// sería el mismo salto de layout que estamos arreglando.
export function BookGridSkeleton({ count = 6 }: { count?: number }) {
  return (
    <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-x-4 gap-y-5">
      {Array.from({ length: count }).map((_, i) => (
        <div key={i} className="space-y-3">
          <Bone className="aspect-[2/3] w-full rounded-xl" />
          <div className="space-y-1.5">
            <Bone className="h-4 w-4/5" />
            <Bone className="h-3 w-2/3" />
          </div>
        </div>
      ))}
    </div>
  );
}

// /club?vista=actividad — cards de feed (misma forma que ActivityFeed).
export function FeedCardsSkeleton({ count = 4 }: { count?: number }) {
  return (
    <div className="space-y-3">
      {Array.from({ length: count }).map((_, i) => (
        <Card key={i} className="space-y-2 p-3.5 sm:p-4">
          <div className="flex gap-3">
            <Bone className="h-9 w-9 shrink-0 rounded-full" />
            <div className="min-w-0 flex-1 space-y-1.5">
              <Bone className="h-4 w-2/3" />
              <Bone className="h-3.5 w-1/2" />
            </div>
          </div>
        </Card>
      ))}
    </div>
  );
}

// /club?vista=personas — filas de miembro (misma forma que MemberList: buscador
// + lista con divide-y dentro de un borde compartido).
export function MemberRowsSkeleton({ count = 5 }: { count?: number }) {
  return (
    <div className="space-y-3">
      <Bone className="h-9 w-full rounded-md" />
      <div className="divide-y divide-border/40 rounded-xl border border-border/40 bg-card/40">
        {Array.from({ length: count }).map((_, i) => (
          <div key={i} className="flex items-center gap-3 px-3 py-3 sm:px-4">
            <Bone className="h-9 w-9 shrink-0 rounded-full" />
            <div className="min-w-0 flex-1 space-y-1.5">
              <Bone className="h-4 w-1/3" />
              <Bone className="h-3 w-1/2" />
            </div>
            <Bone className="h-8 w-16 shrink-0 rounded-full" />
          </div>
        ))}
      </div>
    </div>
  );
}

// /club?vista=frases — quote cards (misma forma que QuoteCard: cita + fila de
// libro + fila de autor/like).
export function QuoteCardsSkeleton({ count = 3 }: { count?: number }) {
  return (
    <div className="space-y-3.5">
      {Array.from({ length: count }).map((_, i) => (
        <div key={i} className="space-y-3.5 rounded-2xl border border-border/50 bg-card/60 p-4 sm:p-5">
          <Bone className="h-5 w-full" />
          <Bone className="h-5 w-4/5" />
          <div className="flex items-center gap-2.5">
            <Bone className="h-11 w-8 shrink-0 rounded-sm" />
            <Bone className="h-3.5 w-1/3" />
          </div>
        </div>
      ))}
    </div>
  );
}

// /agenda?vista=reuniones|votaciones — grid de cards (misma forma que
// MeetingCard y RoundCard: fila de badges, título, línea de meta, footer).
export function MeetingCardsSkeleton({ count = 4 }: { count?: number }) {
  return (
    <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
      {Array.from({ length: count }).map((_, i) => (
        <Card key={i} className="p-5">
          <div className="flex items-center gap-2">
            <Bone className="h-5 w-16 rounded-full" />
            <Bone className="h-5 w-20 rounded-full" />
            <Bone className="h-3 w-24" />
          </div>
          <Bone className="mt-2.5 h-6 w-3/4" />
          <Bone className="mt-2 h-4 w-1/2" />
          <div className="mt-2.5 flex items-center gap-3">
            <Bone className="h-3.5 w-16" />
            <Bone className="ml-auto h-3 w-24" />
          </div>
        </Card>
      ))}
    </div>
  );
}

// /agenda?vista=trivia — podio + tabla de puntajes (misma forma que
// KahootLeaderboard).
export function LeaderboardSkeleton() {
  return (
    <div className="space-y-5">
      <div className="flex items-end justify-center gap-3 sm:gap-5">
        {[0, 1, 2].map((i) => (
          <div key={i} className="flex w-24 flex-col items-center gap-2 sm:w-28">
            <Bone className="h-11 w-11 rounded-full" />
            <Bone className="h-3 w-16" />
            <Bone className={cn("w-full rounded-t-xl", i === 1 ? "h-24" : "h-16")} />
          </div>
        ))}
      </div>
      <div className="space-y-2 rounded-xl border border-border/40 bg-card/40 p-4">
        {[0, 1, 2].map((i) => (
          <Bone key={i} className="h-8 w-full" />
        ))}
      </div>
    </div>
  );
}
