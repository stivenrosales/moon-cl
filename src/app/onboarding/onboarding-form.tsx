"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { ArrowLeft, ArrowRight, Check, Loader2 } from "lucide-react";
import { MoonLogo } from "@/components/moon-logo";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import { Label, Field } from "@/components/ui/label";
import { GENEROS } from "@/lib/genres";
import { cn } from "@/lib/utils";
import { completeOnboarding } from "@/server/actions/profile";

const MAX_GENRES = 10;
const STOPPING_CUE_AT = 3;

interface OnboardingFormProps {
  initialName: string;
}

export function OnboardingForm({ initialName }: OnboardingFormProps) {
  const router = useRouter();
  const [step, setStep] = React.useState<1 | 2>(1);
  const [ageConfirmed, setAgeConfirmed] = React.useState(false);
  const [name, setName] = React.useState(initialName);
  const [genres, setGenres] = React.useState<string[]>([]);
  const [submitting, setSubmitting] = React.useState(false);

  const nameValid = name.trim().length >= 2;

  function toggleGenre(genre: string) {
    setGenres((prev) => {
      if (prev.includes(genre)) return prev.filter((g) => g !== genre);
      if (prev.length >= MAX_GENRES) return prev;
      return [...prev, genre];
    });
  }

  async function finish(favoriteGenres: string[]) {
    setSubmitting(true);
    try {
      await completeOnboarding({
        ageConfirmed: true,
        favoriteGenres,
        name: nameValid ? name.trim() : undefined,
      });
      toast.success("Preferencias guardadas");
      router.push("/dashboard");
      router.refresh();
    } catch (err) {
      const msg = err instanceof Error ? err.message : "No se pudo guardar";
      toast.error(msg);
      setSubmitting(false);
    }
  }

  if (step === 1) {
    return (
      <div className="w-full max-w-md space-y-8 animate-fade-up">
        <div className="text-center">
          <MoonLogo size={72} className="mx-auto" />
          <h1 className="display mt-6 text-3xl leading-tight">
            Antes de <span className="hand-script text-primary">empezar</span>
          </h1>
          <p className="mt-2 text-sm text-muted-foreground">
            Solo dos pasos rápidos para dejar todo listo.
          </p>
        </div>

        <div className="space-y-5 rounded-2xl border border-border/70 bg-card/60 backdrop-blur-md p-6 shadow-2xl">
          <Field>
            <Label htmlFor="name" required>Tu nombre</Label>
            <Input
              id="name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="¿Cómo te llamamos?"
              maxLength={60}
              autoComplete="name"
            />
          </Field>

          <Checkbox
            checked={ageConfirmed}
            onChange={(e) => setAgeConfirmed(e.target.checked)}
            label="Confirmo que tengo 18 años o más"
          />

          <Button
            className="w-full"
            size="lg"
            disabled={!ageConfirmed}
            onClick={() => setStep(2)}
          >
            Continuar
            <ArrowRight className="h-4 w-4" />
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="w-full max-w-lg space-y-8 animate-fade-up">
      <div className="text-center">
        <span className="text-xs uppercase tracking-[0.32em] text-accent-text">Paso 2 de 2</span>
        <h1 className="display mt-3 text-3xl leading-tight">
          ¿Qué te gusta <span className="hand-script text-primary">leer</span>?
        </h1>
        <p className="mt-2 text-sm text-muted-foreground">
          Elige tus géneros favoritos. Es opcional.
        </p>
      </div>

      <div className="space-y-5 rounded-2xl border border-border/70 bg-card/60 backdrop-blur-md p-6 shadow-2xl">
        <div className="flex flex-wrap gap-2">
          {GENEROS.map((genre) => {
            const selected = genres.includes(genre);
            return (
              <button
                key={genre}
                type="button"
                onClick={() => toggleGenre(genre)}
                aria-pressed={selected}
                className={cn(
                  "inline-flex items-center rounded-full border px-3.5 py-1.5 text-xs font-medium transition-colors focus-ring",
                  selected
                    ? "border-primary bg-primary text-primary-foreground"
                    : "border-border text-muted-foreground hover:border-primary/50 hover:text-foreground",
                )}
              >
                {genre}
              </button>
            );
          })}
        </div>

        <p className="min-h-[1rem] text-center text-xs text-muted-foreground" aria-live="polite">
          {genres.length >= STOPPING_CUE_AT
            ? `Elegiste ${genres.length} géneros. Listo.`
            : genres.length > 0
              ? `Elegiste ${genres.length} género${genres.length === 1 ? "" : "s"}.`
              : " "}
        </p>

        <div className="flex flex-col gap-2 sm:flex-row">
          <Button
            variant="ghost"
            size="icon"
            aria-label="Atrás"
            onClick={() => setStep(1)}
            disabled={submitting}
          >
            <ArrowLeft className="h-4 w-4" />
          </Button>
          <Button
            type="button"
            variant="outline"
            className="flex-1"
            onClick={() => finish([])}
            disabled={submitting}
          >
            Puedes saltar este paso
          </Button>
          <Button
            type="button"
            className="flex-1"
            onClick={() => finish(genres)}
            disabled={submitting}
          >
            {submitting ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Check className="h-4 w-4" />
            )}
            Guardar preferencias
          </Button>
        </div>
      </div>
    </div>
  );
}
