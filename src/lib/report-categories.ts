import { z } from "zod";
import { reportCategorySchema } from "@/lib/validators";

export type ReportCategory = z.infer<typeof reportCategorySchema>;

/**
 * Fuente única de verdad para el flujo de reporte de 2 pasos (categoría →
 * sub-razón), igual que MEETING_TYPE_* en meeting-types.ts: se usa en
 * report-dialog.tsx (creación) y reports-panel.tsx (panel de moderación),
 * así categoría y sub-razón se ven y se llaman igual en todos lados.
 */
export const REPORT_CATEGORY_OPTIONS: ReportCategory[] = [
  "ACOSO",
  "SPAM",
  "CONTENIDO_INAPROPIADO",
  "OTRO",
];

export const REPORT_CATEGORY_LABELS: Record<ReportCategory, string> = {
  ACOSO: "Acoso",
  SPAM: "Spam",
  CONTENIDO_INAPROPIADO: "Contenido inapropiado",
  OTRO: "Otro",
};

export const REPORT_CATEGORY_DESCRIPTIONS: Record<ReportCategory, string> = {
  ACOSO: "Insultos, amenazas o comportamiento hostil",
  SPAM: "Mensajes repetidos, enlaces o publicidad no deseada",
  CONTENIDO_INAPROPIADO: "Contenido sexual, violento o inseguro",
  OTRO: "Algo más que no encaja en las categorías anteriores",
};

export const REPORT_SUB_REASONS: Record<ReportCategory, string[]> = {
  ACOSO: [
    "Insultos o lenguaje ofensivo",
    "Amenazas",
    "Acoso reiterado",
    "Odio o discriminación",
  ],
  SPAM: [
    "Mensajes repetidos",
    "Enlaces o publicidad no solicitada",
    "Posible estafa",
  ],
  CONTENIDO_INAPROPIADO: [
    "Contenido sexual",
    "Violencia gráfica",
    "Pone en riesgo a menores",
  ],
  OTRO: ["Otro motivo"],
};
