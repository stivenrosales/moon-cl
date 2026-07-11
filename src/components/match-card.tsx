"use client";

import * as React from "react";
import Link from "next/link";
import { Heart, Sparkles } from "lucide-react";
import { toast } from "sonner";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { getInitials } from "@/lib/utils";
import { toggleMatchOptIn } from "@/server/actions/match";

export interface MatchCardMatch {
  otherUserId: string;
  otherUserName: string | null;
  otherUserEmail: string | null;
  otherUserImage: string | null;
  score: number;
  label: string;
  evidence: { librosEnComun: number; generosEnComun: string[] };
}

interface MatchCardProps {
  /** Si el usuario actual ya activó Book Match. */
  isOptedIn: boolean;
  /**
   * Match de esta semana ya resuelto en el servidor (afinidad nunca se
   * inventa en el cliente). null si no hay pareja esta semana — por ser
   * impar, por afinidad nula, o por no estar activado todavía.
   */
  match: MatchCardMatch | null;
}

export function MatchCard({ isOptedIn: initialOptedIn, match }: MatchCardProps) {
  const [isOptedIn, setIsOptedIn] = React.useState(initialOptedIn);
  const [loading, setLoading] = React.useState(false);

  async function handleActivate() {
    setLoading(true);
    try {
      const result = await toggleMatchOptIn();
      setIsOptedIn(result.isMatchOptIn);
      if (result.isMatchOptIn) {
        toast.success("Book Match activado — cada lunes te avisamos si hay pareja");
      }
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "No se pudo activar tu Book Match");
    } finally {
      setLoading(false);
    }
  }

  if (match) {
    const name = match.otherUserName ?? match.otherUserEmail?.split("@")[0] ?? "alguien del club";
    const evidenceParts: string[] = [];
    if (match.evidence.librosEnComun > 0) {
      evidenceParts.push(
        `${match.evidence.librosEnComun} libro${match.evidence.librosEnComun === 1 ? "" : "s"} en común`,
      );
    }
    if (match.evidence.generosEnComun.length > 0) {
      evidenceParts.push(`Les gusta ${match.evidence.generosEnComun.slice(0, 3).join(", ")}`);
    }

    return (
      <Card className="p-5 sm:p-6 space-y-4">
        <div className="flex items-center gap-2 text-xs uppercase tracking-[0.28em] text-accent-text">
          <Heart className="h-3.5 w-3.5" />
          Tu Book Match de esta semana
        </div>

        <div className="flex items-center gap-4">
          <Avatar className="h-14 w-14 shrink-0">
            {match.otherUserImage ? <AvatarImage src={match.otherUserImage} alt="" /> : null}
            <AvatarFallback className="text-base">
              {getInitials(match.otherUserName, match.otherUserEmail)}
            </AvatarFallback>
          </Avatar>
          <div className="space-y-1.5">
            <p className="text-4xl font-bold tabular-nums leading-none text-accent-text">{match.score}%</p>
            <Badge variant="default">{match.label}</Badge>
          </div>
        </div>

        <div className="space-y-1">
          <p className="text-sm font-medium">con {name}</p>
          {evidenceParts.length > 0 ? (
            <p className="text-xs text-muted-foreground">{evidenceParts.join(" · ")}</p>
          ) : (
            <p className="text-xs text-muted-foreground">
              Aún no comparten libros ni géneros — una buena excusa para descubrir algo nuevo juntos.
            </p>
          )}
        </div>

        <Button asChild size="sm" className="w-full sm:w-auto">
          <Link href={`/mensajes/${match.otherUserId}`}>Saludar a {name}</Link>
        </Button>
      </Card>
    );
  }

  if (isOptedIn) {
    return (
      <Card className="p-5 sm:p-6 text-center space-y-1.5">
        <Sparkles className="mx-auto h-5 w-5 text-primary/60" />
        <p className="hand-script text-2xl">Tu Book Match está activo</p>
        <p className="mx-auto max-w-sm text-sm text-muted-foreground">
          Cada lunes revisamos si hay alguien del club con quien hacer match. Esta semana todavía no te tocó pareja.
        </p>
      </Card>
    );
  }

  return (
    <Card className="p-5 sm:p-6 text-center space-y-3">
      <Sparkles className="mx-auto h-5 w-5 text-primary/60" />
      <div className="space-y-1">
        <p className="hand-script text-2xl">Descubre tu Book Match</p>
        <p className="mx-auto max-w-sm text-sm text-muted-foreground">
          Cada lunes te presentamos a alguien del club con quien compartes gustos de lectura, con un correo para
          romper el hielo. Es opcional y puedes desactivarlo cuando quieras.
        </p>
      </div>
      <Button size="sm" onClick={handleActivate} disabled={loading}>
        {loading ? "Activando…" : "Activar mi Book Match"}
      </Button>
    </Card>
  );
}
