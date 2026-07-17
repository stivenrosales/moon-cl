import { FeedCardsSkeleton, SegmentedControlSkeleton } from "@/components/skeletons";

// Skeleton de /club: SegmentedControl (Actividad / Personas / Frases) + cards
// de feed (misma forma que ActivityFeed: avatar + 2 líneas) para que el tab
// responda al instante mientras se resuelve loadFeed() + nudge queue. Sin
// header: la página real ya no pinta un h1 decorativo (ver ClubPage).
//
// Este boundary solo cubre la primera navegación a /club (cambio de ruta).
// El cambio entre ?vista=actividad|personas|frases usa el <Suspense
// key={vista}> inline en ClubPage, con las piezas de src/components/skeletons.
export default function Loading() {
  return (
    <div className="space-y-6 md:space-y-8">
      <SegmentedControlSkeleton items={3} />

      <FeedCardsSkeleton />
    </div>
  );
}
