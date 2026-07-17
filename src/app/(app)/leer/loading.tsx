import { Bone, SegmentedControlSkeleton, ShelfRowsSkeleton } from "@/components/skeletons";

// Skeleton de /leer: botón "Agregar" (esquina superior derecha, solo en Mi
// biblioteca) + SegmentedControl (Mi biblioteca / Biblioteca del club) +
// filas de libros (misma forma que ShelfBookRow) para que la navegación
// entre pestañas del BottomTabBar responda al instante. Sin header de
// texto: la página real ya no pinta un h1 decorativo (ver LeerPage).
//
// Este boundary solo cubre la primera navegación a /leer (cambio de ruta).
// El cambio entre ?vista=mios y ?vista=club usa el <Suspense key={vista}>
// inline en LeerPage, con ShelfRowsSkeleton/BookGridSkeleton — las mismas
// piezas de acá, para que ninguno de los dos se desincronice.
export default function Loading() {
  return (
    <div className="space-y-6 md:space-y-8">
      <div className="flex justify-end">
        <Bone className="h-11 w-40 rounded-full" />
      </div>

      <SegmentedControlSkeleton items={2} />

      <ShelfRowsSkeleton />
    </div>
  );
}
