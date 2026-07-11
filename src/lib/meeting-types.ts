import type { MeetingType } from "@prisma/client";
import type { BadgeProps } from "@/components/ui/badge";

/**
 * Fuente única de verdad para etiquetas, variante de Badge y color de punto
 * por MeetingType. Se usa en el select de creación/edición de reuniones, las
 * cards de /reuniones, el detalle de reunión, el panel admin y el calendario
 * mensual — así el tipo se ve y se llama exactamente igual en todos lados.
 */
export const MEETING_TYPE_OPTIONS: Array<{ value: MeetingType; label: string }> = [
  { value: "REUNION", label: "Reunión" },
  { value: "CINE", label: "Cine" },
  { value: "POESIA", label: "Poesía" },
  { value: "OTRO", label: "Otro" },
];

export const MEETING_TYPE_LABELS: Record<MeetingType, string> = {
  REUNION: "Reunión",
  CINE: "Cine",
  POESIA: "Poesía",
  OTRO: "Otro",
};

export const MEETING_TYPE_BADGE_VARIANT: Record<MeetingType, NonNullable<BadgeProps["variant"]>> = {
  REUNION: "default",
  CINE: "gold",
  POESIA: "secondary",
  OTRO: "outline",
};

// Puntos del calendario mensual: REUNION→primario, CINE→acento (Lemon, uso
// de "señal" permitido por el contrato visual), POESIA→secundario.
export const MEETING_TYPE_DOT_CLASS: Record<MeetingType, string> = {
  REUNION: "bg-primary",
  CINE: "bg-accent",
  POESIA: "bg-secondary",
  OTRO: "bg-muted-foreground",
};
