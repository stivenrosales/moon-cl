import { MeetingCardsSkeleton, SegmentedControlSkeleton } from "@/components/skeletons";

// Skeleton de /agenda: SegmentedControl (Reuniones / Votaciones / Trivia) +
// cards de reunión (mismo grid grid-cols-1 md:grid-cols-2 que MeetingCard)
// para que el tab responda al instante. Sin header: la página real ya no
// pinta un h1 decorativo que repita "Agenda" (ver AgendaPage).
//
// Este boundary solo cubre la primera navegación a /agenda (cambio de ruta).
// El cambio entre ?vista=reuniones|votaciones|trivia usa el <Suspense
// key={vista}> inline en AgendaPage, con las piezas de src/components/skeletons.
export default function Loading() {
  return (
    <div className="space-y-6 md:space-y-8">
      <SegmentedControlSkeleton items={3} />

      <MeetingCardsSkeleton />
    </div>
  );
}
