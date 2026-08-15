"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { ArrowLeft, ArrowRight, Check, Loader2 } from "lucide-react";
import { MoonLogo } from "@/components/moon-logo";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import { Select } from "@/components/ui/select";
import { Label, Field } from "@/components/ui/label";
import { GENEROS } from "@/lib/genres";
import { paisesOrdenados } from "@/lib/paises";
import { cn } from "@/lib/utils";
import { routes } from "@/lib/routes";
import { completeOnboarding } from "@/server/actions/profile";

const MAX_GENRES = 10;
const STOPPING_CUE_AT = 3;
// Perú primero, resto alfabético — ver paisesOrdenados(). Se calcula una
// sola vez fuera del componente porque la lista no depende de ningún estado.
const PAISES = paisesOrdenados();

interface OnboardingFormProps {
  initialName: string;
}

export function OnboardingForm({ initialName }: OnboardingFormProps) {
  const router = useRouter();
  const [step, setStep] = React.useState<1 | 2 | 3>(1);
  const [ageConfirmed, setAgeConfirmed] = React.useState(false);
  const [name, setName] = React.useState(initialName);
  const [genres, setGenres] = React.useState<string[]>([]);
  const [countryCode, setCountryCode] = React.useState("");
  const [city, setCity] = React.useState("");
  const [submitting, setSubmitting] = React.useState(false);

  const nameValid = name.trim().length >= 2;
  // Ubicación obligatoria (a diferencia de los géneros del paso 2, que sí
  // se pueden saltar): sin país y ciudad válidos, no hay forma de terminar.
  const ubicacionValida = countryCode !== "" && city.trim().length >= 2;

  function toggleGenre(genre: string) {
    setGenres((prev) => {
      if (prev.includes(genre)) return prev.filter((g) => g !== genre);
      if (prev.length >= MAX_GENRES) return prev;
      return [...prev, genre];
    });
  }

  async function finish() {
    setSubmitting(true);
    try {
      await completeOnboarding({
        ageConfirmed: true,
        favoriteGenres: genres,
        ubicacion: { countryCode, city: city.trim() },
        name: nameValid ? name.trim() : undefined,
      });
      toast.success("Preferencias guardadas");
      router.push(routes.hoy());
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
            Solo tres pasos rápidos para dejar todo listo.
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

  if (step === 2) {
    return (
      <div className="w-full max-w-lg space-y-8 animate-fade-up">
        <div className="text-center">
          <span className="text-xs uppercase tracking-[0.32em] text-accent-text">Paso 2 de 3</span>
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
                : " "}
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
              onClick={() => {
                setGenres([]);
                setStep(3);
              }}
              disabled={submitting}
            >
              Puedes saltar este paso
            </Button>
            <Button type="button" className="flex-1" onClick={() => setStep(3)} disabled={submitting}>
              Continuar
              <ArrowRight className="h-4 w-4" />
            </Button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="w-full max-w-lg space-y-8 animate-fade-up">
      <div className="text-center">
        <span className="text-xs uppercase tracking-[0.32em] text-accent-text">Paso 3 de 3</span>
        <h1 className="display mt-3 text-3xl leading-tight">
          ¿Desde dónde <span className="hand-script text-primary">lees</span>?
        </h1>
        <p className="mt-2 text-sm text-muted-foreground">
          Así otras socias del club pueden encontrarte por cercanía.
        </p>
      </div>

      <div className="space-y-5 rounded-2xl border border-border/70 bg-card/60 backdrop-blur-md p-6 shadow-2xl">
        <Field>
          <Label htmlFor="country" required>País</Label>
          <Select id="country" value={countryCode} onChange={(e) => setCountryCode(e.target.value)}>
            <option value="">Elige tu país</option>
            {PAISES.map(({ codigo, nombre }) => (
              <option key={codigo} value={codigo}>
                {nombre}
              </option>
            ))}
          </Select>
        </Field>

        <Field>
          <Label htmlFor="city" required>Ciudad</Label>
          <Input
            id="city"
            value={city}
            onChange={(e) => setCity(e.target.value)}
            placeholder="Solo la ciudad, ej. Lima (el país ya lo elegiste arriba)"
            maxLength={80}
            autoComplete="address-level2"
          />
        </Field>

        <div className="flex flex-col gap-2 sm:flex-row">
          <Button
            variant="ghost"
            size="icon"
            aria-label="Atrás"
            onClick={() => setStep(2)}
            disabled={submitting}
          >
            <ArrowLeft className="h-4 w-4" />
          </Button>
          <Button
            type="button"
            className="flex-1"
            onClick={() => finish()}
            disabled={submitting || !ubicacionValida}
          >
            {submitting ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Check className="h-4 w-4" />
            )}
            Terminar
          </Button>
        </div>
      </div>
    </div>
  );
}
