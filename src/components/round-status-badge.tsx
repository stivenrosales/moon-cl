import type { RoundStatus } from "@prisma/client";
import { Badge } from "@/components/ui/badge";

const labels: Record<RoundStatus, { text: string; variant: "default" | "gold" | "secondary" | "outline" | "success" | "destructive" }> = {
  SCHEDULED: { text: "Próximamente", variant: "secondary" },
  OPEN: { text: "Activa", variant: "success" },
  CLOSED: { text: "Cerrada", variant: "outline" },
};

export function RoundStatusBadge({ status }: { status: RoundStatus }) {
  const meta = labels[status];
  return <Badge variant={meta.variant}>{meta.text}</Badge>;
}
