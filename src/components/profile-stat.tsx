import Link from "next/link";
import { Card } from "@/components/ui/card";
import { cn } from "@/lib/utils";

interface ProfileStatProps {
  label: string;
  value: number;
  href?: string;
  className?: string;
  /**
   * El tamaño del contenedor debe corresponder al tamaño del dato: un
   * número de 1-3 dígitos no necesita ~100px de alto. `compact` reduce
   * padding/tipografía para bloques de stats en fila (p.ej. /perfil).
   * Por defecto queda igual que antes para no mover el perfil público.
   */
  compact?: boolean;
}

/**
 * Tarjeta de stat reutilizada por el perfil propio y el perfil público
 * (etiqueta versalitas + número tabular). Si recibe href, la tarjeta entera
 * es un link (p.ej. Seguidores/Siguiendo → /miembros).
 */
export function ProfileStat({ label, value, href, className, compact = false }: ProfileStatProps) {
  const content = (
    <Card
      className={cn(
        // flex-col + mt-auto ancla el número al pie: así los números de una
        // fila de stats comparten baseline aunque una etiqueta envuelva en
        // dos líneas y otra en una ("Votos emitidos" vs "Comentarios").
        "flex h-full flex-col",
        compact ? "p-3" : "p-5",
        href && "transition-colors hover:border-primary/40",
        className,
      )}
    >
      <p
        className={cn(
          "uppercase text-muted-foreground",
          compact ? "text-[9px] tracking-[0.08em]" : "text-[10px] tracking-[0.22em]",
        )}
      >
        {label}
      </p>
      <p className={cn("display tabular-nums", compact ? "mt-auto pt-1 text-xl" : "mt-auto pt-2 text-3xl")}>
        {value}
      </p>
    </Card>
  );

  if (!href) return content;

  return (
    <Link href={href} className="focus-ring block h-full rounded-2xl">
      {content}
    </Link>
  );
}
