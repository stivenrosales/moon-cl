import Link from "next/link";
import { Card } from "@/components/ui/card";
import { cn } from "@/lib/utils";

interface ProfileStatProps {
  label: string;
  value: number;
  href?: string;
  className?: string;
}

/**
 * Tarjeta de stat reutilizada por el perfil propio y el perfil público
 * (etiqueta versalitas + número tabular). Si recibe href, la tarjeta entera
 * es un link (p.ej. Seguidores/Siguiendo → /miembros).
 */
export function ProfileStat({ label, value, href, className }: ProfileStatProps) {
  const content = (
    <Card
      className={cn(
        "p-5",
        href && "transition-colors hover:border-primary/40",
        className,
      )}
    >
      <p className="text-[10px] uppercase tracking-[0.22em] text-muted-foreground">{label}</p>
      <p className="display mt-2 text-3xl tabular-nums">{value}</p>
    </Card>
  );

  if (!href) return content;

  return (
    <Link href={href} className="focus-ring block rounded-2xl">
      {content}
    </Link>
  );
}
