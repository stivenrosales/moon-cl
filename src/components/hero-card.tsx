"use client";

// ─────────────────────────────────────────────────────────────────────────
// Card héroe de /hoy. Tres estados — no dos — porque "sin libro" y "hay
// libro pero no lo empecé" necesitan copy y acciones completamente distintas
// (ver services/today.ts para el porqué de cada estado).
//
// El estado "leyendo" pide SIEMPRE página Y capítulo en el formulario
// inline: comment-gating.ts:61 gatea las salas del foro por capítulo, así
// que si esta card solo pidiera página, myChapter se quedaría en null para
// siempre y el foro por salas —la feature más diferenciadora del producto—
// se convertiría en una pantalla de candados sin un solo test rojo.
// ─────────────────────────────────────────────────────────────────────────

import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { BookOpen, Flame, Loader2, MessageSquare, Sparkles } from "lucide-react";
import { toast } from "sonner";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Input } from "@/components/ui/input";
import { Label, Field } from "@/components/ui/label";
import { BookCover } from "@/components/book-cover";
import { startReading } from "@/server/actions/shelves";
import { updateProgress } from "@/server/actions/progress";
import { routes } from "@/lib/routes";
import { resolverAvanceCopy } from "@/lib/reading-progress-copy";
import type { TodayHero } from "@/server/services/today";

function pluralize(count: number, singular: string, plural: string) {
  return count === 1 ? singular : plural;
}

function RachaBadge({ racha }: { racha?: number }) {
  if (!racha) return null;
  return (
    <span className="inline-flex items-center gap-1 text-xs text-accent-text">
      <Flame className="h-3.5 w-3.5" /> {racha} {pluralize(racha, "día seguido", "días seguidos")}
    </span>
  );
}

export function HeroCard({ hero }: { hero: TodayHero }) {
  if (hero.estado === "sin-libro") return <SinLibro />;
  if (hero.estado === "sin-empezar") return <SinEmpezar hero={hero} />;
  return <Leyendo hero={hero} />;
}

// ─── Estado A: sin libro ────────────────────────────────────────────────

function SinLibro() {
  return (
    <Card className="p-6 md:p-8 space-y-3 text-center">
      <Sparkles className="mx-auto h-6 w-6 text-primary/60" />
      <p className="hand-script text-2xl">El club no está leyendo nada ahora</p>
      <p className="text-sm text-muted-foreground">
        Cuando se elija el próximo libro, aparecerá aquí.
      </p>
      <Button asChild className="mt-1">
        <Link href={routes.leer({ vista: "club" })}>Mira qué hay en la mesa</Link>
      </Button>
    </Card>
  );
}

// ─── Estado B: hay libro pero no lo empecé ─────────────────────────────
// CERO input de página, CERO barra en 0%: pedirle a alguien que llegó hace
// 40 segundos en qué página va de un libro que no tiene es absurdo.

function SinEmpezar({ hero }: { hero: Extract<TodayHero, { estado: "sin-empezar" }> }) {
  const router = useRouter();
  const [pending, setPending] = React.useState(false);

  async function onStart() {
    setPending(true);
    try {
      await startReading(hero.libro.id);
      toast.success("Ya está en tu estantería — a leer ✦");
      router.refresh();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Error");
    } finally {
      setPending(false);
    }
  }

  const avanceClub =
    hero.medianaClub != null
      ? `El club va por la pág. ${hero.medianaClub} · ${hero.cuantosLeyendo} ${pluralize(
          hero.cuantosLeyendo,
          "persona leyendo",
          "personas leyendo",
        )}`
      : "Todavía nadie ha marcado su avance — puedes ser la primera";

  return (
    <Card className="p-5 md:p-6">
      <div className="flex flex-col sm:flex-row gap-5">
        <BookCover src={hero.libro.coverUrl} title={hero.libro.title} size="md" />
        <div className="min-w-0 flex-1 space-y-2">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <span className="text-xs uppercase tracking-[0.24em] text-accent-text">
              {hero.kicker}
            </span>
            <RachaBadge racha={hero.racha} />
          </div>
          <h2 className="display text-2xl md:text-3xl leading-tight">{hero.libro.title}</h2>
          {hero.libro.authors.length ? (
            <p className="text-muted-foreground">{hero.libro.authors.join(", ")}</p>
          ) : null}
          <p className="text-sm text-muted-foreground">{avanceClub}</p>

          <div className="flex flex-wrap gap-2 pt-2">
            <Button onClick={onStart} disabled={pending}>
              {pending ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <BookOpen className="h-4 w-4" />
              )}
              Lo voy a leer
            </Button>
            <Button asChild variant="outline">
              <Link href={routes.libro(hero.libro.id)}>Ver de qué va</Link>
            </Button>
          </div>
        </div>
      </div>
    </Card>
  );
}

// ─── Estado C: leyendo ──────────────────────────────────────────────────

function Leyendo({ hero }: { hero: Extract<TodayHero, { estado: "leyendo" }> }) {
  const router = useRouter();
  // miPagina llega null cuando el UserBook recién se creó (startReading) y
  // nadie marcó avance todavía. El input arranca vacío en ese caso — NO en
  // 0 — porque un 0 pre-cargado invita a guardar un avance que el usuario
  // nunca declaró. Sigue siendo un input controlado ("" es un valor válido
  // para React, no undefined), así que nunca salta de no-controlado a
  // controlado.
  const [page, setPage] = React.useState<number | "">(hero.miPagina ?? "");
  const [chapter, setChapter] = React.useState(hero.miCapitulo != null ? String(hero.miCapitulo) : "");
  const [submitting, setSubmitting] = React.useState(false);
  const [reward, setReward] = React.useState(false);
  const prevChapterRef = React.useRef(hero.miCapitulo);

  // Si loadToday trae datos nuevos (post router.refresh()), sincroniza los
  // campos controlados con el avance real ya guardado.
  React.useEffect(() => {
    setPage(hero.miPagina ?? "");
    setChapter(hero.miCapitulo != null ? String(hero.miCapitulo) : "");
  }, [hero.miPagina, hero.miCapitulo]);

  // Recompensa inmediata: si el capítulo avanzó y eso destapó comentarios
  // nuevos, la línea secundaria muta con un fade-up de 200ms. No es una card
  // nueva — es la línea que ya estaba, con otro texto.
  React.useEffect(() => {
    const prev = prevChapterRef.current;
    if (
      prev != null &&
      hero.miCapitulo != null &&
      hero.miCapitulo > prev &&
      hero.comentariosNuevos > 0
    ) {
      setReward(true);
    }
    prevChapterRef.current = hero.miCapitulo;
  }, [hero.miCapitulo, hero.comentariosNuevos]);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (page === "") {
      toast.error("La página es obligatoria");
      return;
    }
    if (!chapter.trim()) {
      toast.error("El capítulo es obligatorio: es lo que abre las salas del foro");
      return;
    }

    setSubmitting(true);
    setReward(false);
    try {
      await updateProgress({
        bookId: hero.libro.id,
        currentPage: page,
        chapter: Number(chapter),
      });
      toast.success("Avance actualizado");
      router.refresh();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Error");
    } finally {
      setSubmitting(false);
    }
  }

  const avanceCopy = resolverAvanceCopy(hero.miPagina);

  const alguienAdelanteTexto = hero.alguienAdelante
    ? `${hero.alguienAdelante.nombre} va ${hero.alguienAdelante.paginasDiferencia} ${pluralize(
        hero.alguienAdelante.paginasDiferencia,
        "página adelante",
        "páginas adelante",
      )}`
    : null;

  return (
    <Card className="p-5 md:p-6">
      <div className="flex flex-col sm:flex-row gap-5">
        <BookCover src={hero.libro.coverUrl} title={hero.libro.title} size="md" />
        <div className="min-w-0 flex-1 space-y-3">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <span className="text-xs uppercase tracking-[0.24em] text-accent-text">
              {hero.kicker}
            </span>
            <RachaBadge racha={hero.racha} />
          </div>
          <h2 className="display text-2xl md:text-3xl leading-tight">{hero.libro.title}</h2>
          {hero.libro.authors.length ? (
            <p className="text-muted-foreground">{hero.libro.authors.join(", ")}</p>
          ) : null}

          <div className="space-y-1.5">
            {avanceCopy.tipo === "con-progreso" ? (
              <>
                <div className="flex items-baseline justify-between text-xs uppercase tracking-[0.18em] text-muted-foreground">
                  <span>
                    pág. {hero.miPagina}
                    {hero.libro.pageCount ? ` de ${hero.libro.pageCount}` : ""}
                    {hero.miCapitulo != null ? ` · cap. ${hero.miCapitulo}` : ""}
                  </span>
                  <span className="tabular-nums text-accent-text">{hero.porcentaje}%</span>
                </div>
                <Progress value={hero.porcentaje ?? 0} className="bg-secondary" indicatorClassName="bg-accent" />
              </>
            ) : (
              <p className="text-sm text-muted-foreground">{avanceCopy.texto}</p>
            )}
          </div>

          {alguienAdelanteTexto ? (
            <p className="text-sm text-muted-foreground">{alguienAdelanteTexto}</p>
          ) : null}

          <Link
            href={routes.libro(hero.libro.id)}
            className="inline-flex items-center gap-1.5 text-sm hover:underline"
          >
            {reward ? (
              <span
                className="inline-flex items-center gap-1.5 text-accent-text animate-fade-up"
                style={{ animationDuration: "200ms" }}
              >
                <MessageSquare className="h-3.5 w-3.5" />
                Se abrió la sala del cap. {hero.miCapitulo} · {hero.comentariosNuevos}{" "}
                {pluralize(hero.comentariosNuevos, "comentario", "comentarios")} →
              </span>
            ) : hero.comentariosNuevos > 0 ? (
              <span className="inline-flex items-center gap-1.5 text-accent-text">
                <MessageSquare className="h-3.5 w-3.5" />
                {hero.comentariosNuevos} {pluralize(hero.comentariosNuevos, "comentario nuevo", "comentarios nuevos")}{" "}
                en tu sala →
              </span>
            ) : (
              <span className="inline-flex items-center gap-1.5 text-muted-foreground">
                <MessageSquare className="h-3.5 w-3.5" />
                Leer y comentar →
              </span>
            )}
          </Link>

          <form onSubmit={onSubmit} className="flex flex-wrap items-end gap-3 pt-1">
            <Field className="w-24">
              <Label htmlFor="hero-page" required>
                Pág.
              </Label>
              <Input
                id="hero-page"
                type="number"
                inputMode="numeric"
                required
                min={0}
                max={hero.libro.pageCount ?? 20000}
                value={page}
                onChange={(e) => {
                  const raw = e.target.value;
                  setPage(raw === "" ? "" : Math.max(0, Number(raw)));
                }}
              />
            </Field>
            <Field className="w-24">
              <Label htmlFor="hero-chapter" required>
                Cap.
              </Label>
              <Input
                id="hero-chapter"
                type="number"
                inputMode="numeric"
                required
                min={1}
                max={2000}
                value={chapter}
                onChange={(e) => setChapter(e.target.value)}
              />
            </Field>
            <Button type="submit" disabled={submitting} size="sm">
              {submitting ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : null}
              Actualizar
            </Button>
          </form>
        </div>
      </div>
    </Card>
  );
}
