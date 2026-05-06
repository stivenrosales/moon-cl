import Link from "next/link";
import { ArrowRight, BookHeart, CalendarDays, Sparkles, Vote } from "lucide-react";
import { Button } from "@/components/ui/button";
import { MoonLogo } from "@/components/moon-logo";
import { ThemeToggle } from "@/components/theme-toggle";
import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";

export default async function Landing() {
  const session = await auth();
  if (session?.user) redirect("/dashboard");

  return (
    <div className="relative">
      <header className="container flex items-center justify-between py-6">
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
            <Link href="/login">Entrar</Link>
          </Button>
        </div>
      </header>

      <main className="container relative">
        {/* Hero */}
        <section className="relative grid grid-cols-1 lg:grid-cols-[1.1fr_0.9fr] items-center gap-12 py-16 md:py-24">
          <div className="space-y-8 animate-fade-up">
            <div className="inline-flex items-center gap-2 rounded-full border border-primary/30 bg-primary/5 px-3 py-1 text-xs uppercase tracking-[0.22em] text-primary">
              <Sparkles className="h-3.5 w-3.5" />
              Un club de lectura íntimo
            </div>

            <h1 className="display leading-[1.05] tracking-tight text-[clamp(2.25rem,8vw,4.5rem)]">
              Leemos <span className="hand-script italic text-primary">juntos</span>,
              <br />
              bajo la <span className="gold-shimmer font-semibold">misma luna</span>.
            </h1>

            <p className="max-w-xl text-lg text-muted-foreground leading-relaxed">
              Sugiere libros que te están llamando, vota por los que quieres leer
              y acompaña al club mes a mes con comentarios, valoraciones, avance
              de lectura y reuniones cuidadas.
            </p>

            <div className="flex flex-wrap items-center gap-3">
              <Button asChild size="lg">
                <Link href="/login">
                  Entrar al club
                  <ArrowRight className="h-4 w-4" />
                </Link>
              </Button>
              <Button asChild size="lg" variant="outline">
                <Link href="#como-funciona">Cómo funciona</Link>
              </Button>
            </div>

            <div className="flex items-center gap-6 pt-2 text-xs uppercase tracking-[0.22em] text-muted-foreground">
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

        <div className="ornate-divider my-8" />

        {/* Features */}
        <section id="como-funciona" className="py-16 md:py-24">
          <div className="mb-12 max-w-2xl">
            <span className="text-xs uppercase tracking-[0.32em] text-accent">Cómo funciona</span>
            <h2 className="display mt-3 text-4xl md:text-5xl leading-tight">
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

        <div className="ornate-divider my-8" />

        {/* CTA */}
        <section className="relative my-12 overflow-hidden rounded-3xl border border-border bg-card/50 p-8 md:p-16 text-center">
          <div className="absolute inset-0 moon-glow" aria-hidden />
          <div className="relative space-y-6">
            <span className="hand-script text-2xl text-primary">
              ¿Lista para leer bajo la luna?
            </span>
            <h3 className="display text-3xl md:text-5xl leading-tight">
              Tu próximo libro favorito
              <br className="hidden md:block" />{" "}
              <span className="italic">empieza con un voto</span>.
            </h3>
            <Button asChild size="lg" variant="gold">
              <Link href="/login">
                Recibir mi enlace mágico
                <ArrowRight className="h-4 w-4" />
              </Link>
            </Button>
          </div>
        </section>
      </main>

      <footer className="container py-10 text-center text-xs uppercase tracking-[0.28em] text-muted-foreground">
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
    <div className="group relative bg-card p-8 transition-colors hover:bg-card/80">
      <div className="flex items-center gap-3 text-xs uppercase tracking-[0.24em] text-accent">
        <Icon className="h-4 w-4" />
        {kicker}
      </div>
      <h3 className="display mt-4 text-2xl leading-tight">{title}</h3>
      <p className="mt-3 text-sm text-muted-foreground leading-relaxed">{description}</p>
      <div className="absolute inset-x-0 bottom-0 h-px bg-gradient-to-r from-transparent via-primary/30 to-transparent opacity-0 transition-opacity group-hover:opacity-100" />
    </div>
  );
}
