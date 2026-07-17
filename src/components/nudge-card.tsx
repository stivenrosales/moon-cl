"use client";

// ─────────────────────────────────────────────────────────────────────────
// Card de invitación (nudge) — UNA sola por pantalla, nunca dos. Card normal
// del sistema (borde --border, sin barra/borde lateral de acento): la
// jerarquía la hace la tipografía (kicker en --accent-text, título, cuerpo
// en muted). "Ahora no" descarta para siempre (dismissNudge); el CTA llama
// a markNudgeActed y ejecuta la acción real de la invitación.
//
// El copy y la resolución de la acción viven en nudge-card-copy.ts —
// puros y testeados sin DOM ni Prisma (ver nudge-card-copy.test.ts). Este
// archivo solo conecta esa lógica con Card/Button y las server actions.
// ─────────────────────────────────────────────────────────────────────────

import * as React from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { dismissNudge, markNudgeActed } from "@/server/actions/nudges";
import { startReading } from "@/server/actions/shelves";
import { toggleMatchOptIn } from "@/server/actions/match";
import type { Nudge } from "@/server/services/nudge-queue";
import { resolveNudgeAction, resolveNudgeCopy, type NudgeCardContext } from "@/components/nudge-card-copy";

export interface NudgeCardProps {
  nudge: Nudge;
  /** Datos para interpolar copy y resolver el destino del CTA. Todo
   * opcional — ver nudge-card-copy.ts para los fallbacks. */
  context?: NudgeCardContext;
  className?: string;
}

export function NudgeCard({ nudge, context, className }: NudgeCardProps) {
  const router = useRouter();
  const [pending, setPending] = React.useState(false);
  const [dismissing, setDismissing] = React.useState(false);
  const [hidden, setHidden] = React.useState(false);

  if (hidden) return null;

  const copy = resolveNudgeCopy(nudge.key, context);
  const action = resolveNudgeAction(nudge.key, context);
  const busy = pending || dismissing;

  async function handleDismiss() {
    setDismissing(true);
    try {
      await dismissNudge(nudge.key);
      setHidden(true);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "No se pudo descartar");
    } finally {
      setDismissing(false);
    }
  }

  async function handleCta() {
    setPending(true);
    try {
      if (action.type === "start-reading") {
        // action.libroId ya no es opcional (resolveNudgeAction nunca emite
        // start-reading sin id — ver nudge-card-copy.ts, Bug 1). Solo se
        // marca actuado y se muestra éxito DESPUÉS de que el UserBook
        // efectivamente se creó.
        await startReading(action.libroId);
        await markNudgeActed(nudge.key);
        toast.success("Ya está en tu estantería — a leer ✦");
        setHidden(true);
        router.refresh();
        return;
      }

      if (action.type === "toggle-match") {
        await toggleMatchOptIn();
        await markNudgeActed(nudge.key);
        toast.success("Book Match activado — cada lunes te avisamos si hay pareja");
        setHidden(true);
        router.refresh();
        return;
      }

      // navigate: no hay un efecto propio que esperar (la acción real ocurre
      // en la pantalla de destino), así que NO se marca actedAt aquí — eso
      // quemaría el nudge para siempre aunque el usuario nunca complete la
      // acción (Bug 2). Solo se esconde localmente para esta sesión; volverá
      // a evaluarse la próxima vez que se cargue la cola (buildNudgeQueue),
      // y desaparecerá solo cuando su disparador deje de cumplirse.
      setHidden(true);
      router.push(action.href);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Error");
    } finally {
      setPending(false);
    }
  }

  const titleClassName = copy.titleScript ? "hand-script text-2xl" : "display text-xl leading-tight";

  if (nudge.inline) {
    return (
      <div className={cn("space-y-2.5", className)}>
        <p className="text-sm text-muted-foreground">{copy.body}</p>
        <div className="flex flex-wrap items-center gap-3">
          <Button size="sm" onClick={handleCta} disabled={busy}>
            {copy.cta}
          </Button>
          <button
            type="button"
            onClick={handleDismiss}
            disabled={busy}
            className="text-xs text-muted-foreground hover:text-foreground transition-colors disabled:opacity-50"
          >
            Ahora no
          </button>
        </div>
      </div>
    );
  }

  return (
    <Card className={cn("p-5 md:p-6 space-y-3", className)}>
      {copy.kicker ? (
        <span className="text-xs uppercase tracking-[0.24em] text-accent-text">{copy.kicker}</span>
      ) : null}
      {copy.title ? <p className={titleClassName}>{copy.title}</p> : null}
      <p className="text-sm text-muted-foreground">{copy.body}</p>
      <div className="flex flex-wrap items-center gap-3 pt-1">
        <Button size="sm" onClick={handleCta} disabled={busy}>
          {copy.cta}
        </Button>
        <button
          type="button"
          onClick={handleDismiss}
          disabled={busy}
          className="text-xs text-muted-foreground hover:text-foreground transition-colors disabled:opacity-50"
        >
          Ahora no
        </button>
      </div>
    </Card>
  );
}
