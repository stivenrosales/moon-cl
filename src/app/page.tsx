import Link from "next/link";
import { ArrowRight, BookHeart, CalendarDays, Sparkles, Vote } from "lucide-react";
import { Button } from "@/components/ui/button";
import { MoonLogo } from "@/components/moon-logo";
import { ThemeToggle } from "@/components/theme-toggle";
import { getSession } from "@/lib/session";
import { redirect } from "next/navigation";
import { routes } from "@/lib/routes";

export default async function Landing() {
  const session = await getSession();
  if (session?.user) redirect(routes.hoy());

  return (
    <div className="relative">
      <header className="container flex items-center justify-between py-5">
        <div className="flex items-center gap-3">
          <MoonLogo size={40} />
          <div className="flex flex-col leading-none">
            <span className="hand-script text-2xl">Moon</span>
            <span className="text-[9px] uppercase tracking-[0.32em] text-muted-foreground -mt-0.5">
              Club de Lectura
            </span>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <ThemeToggle />
          <Button asChild size="sm" variant="outline">
            <Link href={routes.login()}>Entrar</Link>
          </Button>
        </div>
      </header>

      <main className="container relative">
        {/* Hero */}
        <section className="relative grid grid-cols-1 lg:grid-cols-[1.1fr_0.9fr] items-center gap-10 lg:gap-14 py-8 md:py-14 lg:py-16">
          <div className="space-y-6 animate-fade-up">
            <div className="inline-flex items-center gap-2 rounded-full border border-primary/30 bg-primary/5 px-3 py-1 text-xs uppercase tracking-[0.22em] text-primary">
              <Sparkles className="h-3.5 w-3.5" />
              Un club de lectura íntimo
            </div>

            <h1 className="display leading-[1.05] tracking-tight text-[clamp(2.25rem,8vw,4.5rem)]">
              Leemos <span className="hand-script italic text-primary">juntos</span>,
              <br />
              bajo la <span className="gold-shimmer font-semibold">misma luna</span>.
            </h1>

            <p className="display text-lg italic text-primary sm:text-xl">
              Lecturas simples, conversaciones profundas.
            </p>

            <p className="max-w-xl text-base md:text-lg text-muted-foreground leading-relaxed">
              Sugiere libros que te están llamando, vota por los que quieres leer
              y acompaña al club mes a mes con comentarios, valoraciones, avance
              de lectura y reuniones cuidadas.
            </p>

            <div className="flex flex-wrap items-center gap-3">
              <Button asChild size="lg">
                <Link href={routes.login()}>
                  Entrar al club
                  <ArrowRight className="h-4 w-4" />
                </Link>
              </Button>
              <Button asChild size="lg" variant="outline">
                <Link href="#como-funciona">Cómo funciona</Link>
              </Button>
            </div>

            <div className="flex items-center gap-6 pt-1 text-xs uppercase tracking-[0.22em] text-muted-foreground">
              <span className="flex items-center gap-2">
                <span className="h-1.5 w-1.5 rounded-full bg-primary animate-pulse" />
                Acceso por enlace mágico
              </span>
              <span className="hidden md:inline">·</span>
              <span className="hidden md:inline">Sin contraseñas</span>
            </div>
          </div>

          {/* Hero visual */}
          <div className="relative aspect-square w-full max-w-[320px] sm:max-w-[420px] lg:max-w-[520px] mx-auto">
            <div className="absolute inset-0 rounded-full bg-primary/10 blur-3xl" />
            <div className="absolute inset-6 rounded-full border border-primary/20" />
            <div className="absolute inset-12 rounded-full border border-primary/10" />
            <div className="absolute inset-0 flex items-center justify-center">
              <MoonLogo className="animate-float h-[70%] w-auto" />
            </div>
          </div>
        </section>

        <div className="ornate-divider my-6" />

        {/* Features */}
        <section id="como-funciona" className="py-12 md:py-16">
          <div className="mb-8 md:mb-10 max-w-2xl">
            <span className="text-xs uppercase tracking-[0.32em] text-accent-text">Cómo funciona</span>
            <h2 className="display mt-2 text-3xl md:text-4xl lg:text-5xl leading-tight">
              Un ritual de lectura,
              <br />
              <span className="hand-script italic text-primary">mes a mes</span>.
            </h2>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-px overflow-hidden rounded-3xl border border-border bg-border">
            <Feature
              icon={Vote}
              kicker="01 — Elige"
              title="Sugiere y vota"
              description="Cuando se abre la ronda, propón libros y vota por los que más te llaman. Votos múltiples, sin límite."
            />
            <Feature
              icon={BookHeart}
              kicker="02 — Lee"
              title="Acompáñate"
              description="Marca tu avance, comenta por capítulos y oculta spoilers para quien va más atrás. La lectura, compartida."
            />
            <Feature
              icon={CalendarDays}
              kicker="03 — Reúnete"
              title="Reuniones cuidadas"
              description="Encuentros con fecha, lugar o enlace y RSVP. Todo el club al mismo tiempo, sin caos de mensajes."
            />
          </div>
        </section>

        <div className="ornate-divider my-6" />

        {/* CTA */}
        <section className="relative my-10 overflow-hidden rounded-3xl border border-border bg-card/50 p-8 md:p-12 text-center">
          <div className="absolute inset-0 moon-glow" aria-hidden />
          <div className="relative space-y-5">
            <span className="hand-script text-2xl text-primary">
              ¿Lista para leer bajo la luna?
            </span>
            <h3 className="display text-3xl md:text-4xl lg:text-5xl leading-tight">
              Tu próximo libro favorito
              <br className="hidden md:block" />{" "}
              <span className="italic">empieza con un voto</span>.
            </h3>
            <Button asChild size="lg" variant="gold">
              <Link href={routes.login()}>
                Recibir mi enlace mágico
                <ArrowRight className="h-4 w-4" />
              </Link>
            </Button>
          </div>
        </section>
      </main>

      <footer className="container py-7 text-center text-xs uppercase tracking-[0.28em] text-muted-foreground">
        Moon Club de Lectura · Hecho con cariño bajo la luna ✦
      </footer>
    </div>
  );
}

function Feature({
  icon: Icon,
  kicker,
  title,
  description,
}: {
  icon: React.ComponentType<{ className?: string }>;
  kicker: string;
  title: string;
  description: string;
}) {
  return (
    <div className="group relative bg-card p-6 md:p-7 transition-colors hover:bg-card/80">
      <div className="flex items-center gap-3 text-xs uppercase tracking-[0.24em] text-accent-text">
        <Icon className="h-4 w-4" />
        {kicker}
      </div>
      <h3 className="display mt-3 text-2xl leading-tight">{title}</h3>
      <p className="mt-2.5 text-sm text-muted-foreground leading-relaxed">{description}</p>
      <div className="absolute inset-x-0 bottom-0 h-px bg-gradient-to-r from-transparent via-primary/30 to-transparent opacity-0 transition-opacity group-hover:opacity-100" />
    </div>
  );
}
