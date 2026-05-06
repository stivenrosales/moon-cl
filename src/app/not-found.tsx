import Link from "next/link";
import { MoonLogo } from "@/components/moon-logo";
import { Button } from "@/components/ui/button";

export default function NotFound() {
  return (
    <div className="container flex min-h-dvh items-center justify-center py-16">
      <div className="text-center space-y-6 animate-fade-up max-w-md">
        <MoonLogo size={96} className="mx-auto" />
        <h1 className="display text-5xl">404</h1>
        <p className="hand-script text-2xl text-primary">
          Esta página se perdió bajo la luna
        </p>
        <p className="text-sm text-muted-foreground">
          La sugerencia que buscas no existe o fue retirada.
        </p>
        <Button asChild>
          <Link href="/">Volver al inicio</Link>
        </Button>
      </div>
    </div>
  );
}
