import { Card } from "@/components/ui/card";
import { cn } from "@/lib/utils";

// Skeleton de /club: SegmentedControl (Actividad / Personas / Frases) + cards
// de feed (misma forma que ActivityFeed: avatar + 2 líneas) para que el tab
// responda al instante mientras se resuelve loadFeed() + nudge queue. Sin
// header: la página real ya no pinta un h1 decorativo (ver ClubPage).
export default function Loading() {
  return (
    <div className="space-y-6 md:space-y-8">
      <SegmentedControlSkeleton items={3} />

      <div className="space-y-3">
        {[0, 1, 2, 3].map((i) => (
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
    </div>
  );
}

function Bone({ className }: { className?: string }) {
  return <div className={cn("animate-pulse rounded-md bg-muted", className)} aria-hidden />;
}

function SegmentedControlSkeleton({ items }: { items: number }) {
  return (
    <div className="flex w-full border-b border-border">
      {Array.from({ length: items }).map((_, i) => (
        <div key={i} className="flex min-h-11 flex-1 items-center justify-center">
          <Bone className="h-4 w-20" />
        </div>
      ))}
    </div>
  );
}
