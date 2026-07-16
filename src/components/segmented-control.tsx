import Link from "next/link";

import { cn } from "@/lib/utils";
import { alineacionSegmento, resolverSegmentoActivo, type Segmentos } from "@/lib/segmented-control";

export type { Segmento, Segmentos } from "@/lib/segmented-control";
export { resolverSegmentoActivo } from "@/lib/segmented-control";

interface SegmentedControlProps {
  segmentos: Segmentos;
  activo: string;
  paramName?: string;
}

// Control segmentado server-friendly: son <Link> a "?paramName=valor", la
// navegación real la resuelve el Server Component de la página al leer
// searchParams. Sin estado de cliente, sin queries, sin shadcn Tabs.
export function SegmentedControl({ segmentos, activo, paramName = "vista" }: SegmentedControlProps) {
  const activoResuelto = resolverSegmentoActivo(segmentos, activo);

  return (
    <nav aria-label="Navegación secundaria" className="flex w-full border-b border-border">
      {segmentos.map((segmento, indice) => {
        const esActivo = segmento.valor === activoResuelto;
        const alineacion = alineacionSegmento(indice, segmentos.length);

        return (
          <Link
            key={segmento.valor}
            href={`?${paramName}=${segmento.valor}`}
            aria-current={esActivo ? "page" : undefined}
            className={cn(
              "flex min-h-11 flex-1 items-center text-sm transition-colors",
              alineacion === "start" && "justify-start text-left",
              alineacion === "center" && "justify-center text-center",
              alineacion === "end" && "justify-end text-right",
              esActivo
                ? "font-semibold text-foreground"
                : "font-medium text-muted-foreground hover:text-foreground",
            )}
          >
            {segmento.label}
          </Link>
        );
      })}
    </nav>
  );
}
