import { Card } from "@/components/ui/card";
import { cn } from "@/lib/utils";

// Skeleton de /agenda: SegmentedControl (Reuniones / Votaciones / Trivia) +
// cards de reunión (mismo grid grid-cols-1 md:grid-cols-2 que MeetingCard)
// para que el tab responda al instante. Sin header: la página real ya no
// pinta un h1 decorativo que repita "Agenda" (ver AgendaPage).
export default function Loading() {
  return (
    <div className="space-y-6 md:space-y-8">
      <SegmentedControlSkeleton items={3} />

      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
        {[0, 1, 2, 3].map((i) => (
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
