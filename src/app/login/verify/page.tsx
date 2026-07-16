import Link from "next/link";
import { Mail } from "lucide-react";
import { MoonLogo } from "@/components/moon-logo";
import { Button } from "@/components/ui/button";
import { routes } from "@/lib/routes";

export default function VerifyPage() {
  return (
    <div className="container flex min-h-dvh items-center justify-center py-16">
      <div className="w-full max-w-md text-center space-y-8 animate-fade-up">
        <MoonLogo size={84} className="mx-auto" />
        <div>
          <div className="mx-auto inline-flex h-12 w-12 items-center justify-center rounded-full bg-primary/15 text-primary">
            <Mail className="h-5 w-5" />
          </div>
          <h1 className="display mt-6 text-3xl md:text-4xl leading-tight">
            Revisa tu correo
          </h1>
          <p className="mt-3 text-sm text-muted-foreground leading-relaxed">
            Te acabamos de enviar un <strong>enlace mágico</strong>. Toca el botón
            del correo para entrar al club. El enlace caduca en 24 h y solo funciona una vez.
          </p>
        </div>

        <Button asChild variant="outline">
          <Link href={routes.login()}>Reenviar enlace</Link>
        </Button>

        <p className="text-[10px] uppercase tracking-[0.32em] text-muted-foreground">
          ¿No llega? Revisa spam o promociones.
        </p>
      </div>
    </div>
  );
}
