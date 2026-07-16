import { cn } from "@/lib/utils";

// Skeleton de /leer: botón "Agregar" (esquina superior derecha, solo en Mi
// biblioteca) + SegmentedControl (Mi biblioteca / Biblioteca del club) +
// filas de libros (misma forma que ShelfBookRow) para que la navegación
// entre pestañas del BottomTabBar responda al instante. Sin header de
// texto: la página real ya no pinta un h1 decorativo (ver LeerPage).
export default function Loading() {
  return (
    <div className="space-y-6 md:space-y-8">
      <div className="flex justify-end">
        <Bone className="h-11 w-40 rounded-full" />
      </div>

      <SegmentedControlSkeleton items={2} />

      <div className="space-y-3">
        {[0, 1, 2, 3].map((i) => (
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
          <Bone className="h-4 w-24" />
        </div>
      ))}
    </div>
  );
}
