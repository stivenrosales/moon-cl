import { Card } from "@/components/ui/card";
import { cn } from "@/lib/utils";

// Skeleton de /hoy: se muestra al instante en la navegación entre pestañas
// (BottomTabBar) mientras Next streamea la página real — sin esto, el tab
// se ve "congelado" hasta que el servidor termina de resolver loadToday() +
// loadUrgency() + loadFeed() + nextNudge(). Mismas medidas que HoyPage para
// no saltar (CLS) cuando llega el contenido real.
export default function Loading() {
  return (
    <div className="space-y-5 md:space-y-7">
      <Bone className="h-4 w-48" />

      {/* Card héroe: portada (BookCover size="md") + kicker/título/autor */}
      <Card className="p-5 md:p-6">
        <div className="flex flex-col gap-5 sm:flex-row">
          <Bone className="h-36 w-24 shrink-0 rounded-md" />
          <div className="min-w-0 flex-1 space-y-3">
            <div className="flex items-center justify-between gap-2">
              <Bone className="h-3 w-24" />
              <Bone className="h-3 w-16" />
            </div>
            <Bone className="h-7 w-3/4" />
            <Bone className="h-4 w-1/2" />
            <Bone className="h-2 w-full rounded-full" />
            <div className="flex gap-2 pt-1">
              <Bone className="h-9 w-32 rounded-full" />
              <Bone className="h-9 w-28 rounded-full" />
            </div>
          </div>
        </div>
      </Card>

      {/* 2 slots de urgencia (grid grid-cols-1 md:grid-cols-2) */}
      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
        {[0, 1].map((i) => (
          <Card key={i} className="space-y-2.5 p-5">
            <Bone className="h-3 w-32" />
            <Bone className="h-4 w-24" />
            <Bone className="h-6 w-2/3" />
            <div className="flex gap-2 pt-1">
              <Bone className="h-8 w-20 rounded-full" />
              <Bone className="h-8 w-20 rounded-full" />
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
