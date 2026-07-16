import { Card } from "@/components/ui/card";
import { cn } from "@/lib/utils";

// Skeleton de /perfil: avatar + bloques (header, stats, secciones de listas)
// para que el tab responda al instante mientras se resuelve el Promise.all
// de user/suggestions/votes/ratings/comments/followCounts.
export default function Loading() {
  return (
    <div className="space-y-7">
      <header className="flex flex-col items-start gap-6 md:flex-row">
        <Bone className="h-20 w-20 shrink-0 rounded-full" />
        <div className="flex-1 space-y-2">
          <Bone className="h-3 w-20" />
          <Bone className="h-8 w-48" />
          <div className="flex flex-wrap items-center gap-2">
            <Bone className="h-5 w-20 rounded-full" />
            <Bone className="h-3 w-32" />
          </div>
        </div>
      </header>

      <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
        {[0, 1, 2, 3].map((i) => (
          <Card key={i} className="space-y-1.5 p-4">
            <Bone className="h-3 w-16" />
            <Bone className="h-7 w-10" />
          </Card>
        ))}
      </div>

      <div className="grid max-w-sm grid-cols-2 gap-4">
        {[0, 1].map((i) => (
          <Card key={i} className="space-y-1.5 p-4">
            <Bone className="h-3 w-16" />
            <Bone className="h-7 w-10" />
          </Card>
        ))}
      </div>

      {[0, 1].map((section) => (
        <section key={section} className="space-y-4">
          <Bone className="h-3 w-36" />
          <div className="space-y-3">
            {[0, 1].map((i) => (
              <Card key={i} className="p-4">
                <div className="flex gap-3">
                  <Bone className="h-20 w-14 shrink-0 rounded-md" />
                  <div className="min-w-0 flex-1 space-y-1.5">
                    <Bone className="h-4 w-2/3" />
                    <Bone className="h-3 w-1/3" />
                    <Bone className="h-3 w-1/2" />
                  </div>
                </div>
              </Card>
            ))}
          </div>
        </section>
      ))}
    </div>
  );
}

function Bone({ className }: { className?: string }) {
  return <div className={cn("animate-pulse rounded-md bg-muted", className)} aria-hidden />;
}
