"use client";

import * as React from "react";
import { Camera, Check, Loader2, Pencil } from "lucide-react";
import { toast } from "sonner";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select } from "@/components/ui/select";
import { Label, Field, FieldDescription } from "@/components/ui/label";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { GENEROS } from "@/lib/genres";
import { nombresDeMeses } from "@/lib/months";
import { cn, getInitials } from "@/lib/utils";
import { setAvatar, updateProfile } from "@/server/actions/profile";
import { toggleMatchOptIn } from "@/server/actions/match";

const MAX_GENRES = 10;
// El índice de cada etiqueta ES el mes que se guarda (`<option value={i}>`
// alimenta el Date.UTC de handleSubmit), así que la lista tiene que armarse
// en UTC. Ver src/lib/months.ts: hacerlo en la zona del navegador la corría
// un lugar y elegir "Marzo" guardaba abril.
const MONTHS = nombresDeMeses();

function daysInMonth(monthIndex: number) {
  return new Date(Date.UTC(2000, monthIndex + 1, 0)).getUTCDate();
}

interface ProfileEditDialogProps {
  user: {
    id: string;
    name: string | null;
    email: string | null;
    image: string | null;
    bio: string | null;
    birthday: Date | null;
    favoriteGenres: string[];
    isMatchOptIn: boolean;
  };
}

export function ProfileEditDialog({ user }: ProfileEditDialogProps) {
  const [open, setOpen] = React.useState(false);
  // Contador de aperturas: es la key del formulario, así que abrir el
  // diálogo lo REMONTA y su estado vuelve a derivarse de `user`. Antes el
  // estado vivía acá, en un componente que no se desmonta nunca: lo que
  // tocabas y cerrabas SIN guardar sobrevivía para siempre, y el select de
  // cumpleaños quedaba mostrando un mes que la base nunca tuvo mientras el
  // perfil, dos centímetros más abajo, pintaba el valor real.
  //
  // No alcanza con que Radix desmonte DialogContent al cerrar: durante la
  // animación de salida sigue montado, y reabrir dentro de esa ventana
  // reusaría la instancia vieja.
  const [aperturas, setAperturas] = React.useState(0);

  return (
    <Dialog
      open={open}
      onOpenChange={(siguiente) => {
        if (siguiente) setAperturas((n) => n + 1);
        setOpen(siguiente);
      }}
    >
      <DialogTrigger asChild>
        <Button variant="outline" size="sm">
          <Pencil className="h-3.5 w-3.5" />
          Editar perfil
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-lg">
        <ProfileEditForm key={aperturas} user={user} onClose={() => setOpen(false)} />
      </DialogContent>
    </Dialog>
  );
}

function ProfileEditForm({
  user,
  onClose,
}: {
  user: ProfileEditDialogProps["user"];
  onClose: () => void;
}) {
  const [avatarUrl, setAvatarUrl] = React.useState(user.image ?? "");
  const [uploadingAvatar, setUploadingAvatar] = React.useState(false);
  const [name, setName] = React.useState(user.name ?? "");
  const [bio, setBio] = React.useState(user.bio ?? "");
  const [day, setDay] = React.useState(
    user.birthday ? String(new Date(user.birthday).getUTCDate()) : "",
  );
  const [month, setMonth] = React.useState(
    user.birthday ? String(new Date(user.birthday).getUTCMonth()) : "",
  );
  const [genres, setGenres] = React.useState<string[]>(user.favoriteGenres);
  const [matchOptIn, setMatchOptIn] = React.useState(user.isMatchOptIn);
  const [matchToggling, setMatchToggling] = React.useState(false);
  const [submitting, setSubmitting] = React.useState(false);
  const fileInputRef = React.useRef<HTMLInputElement>(null);

  const monthIndex = month === "" ? null : Number(month);
  const availableDays = monthIndex === null ? 31 : daysInMonth(monthIndex);

  function toggleGenre(genre: string) {
    setGenres((prev) => {
      if (prev.includes(genre)) return prev.filter((g) => g !== genre);
      if (prev.length >= MAX_GENRES) return prev;
      return [...prev, genre];
    });
  }

  async function handleAvatarFile(file: File) {
    setUploadingAvatar(true);
    try {
      // Subida en dos pasos: primero pedimos una URL firmada (el server
      // valida tipo/tamaño y arma la key), después el archivo va directo
      // al storage sin pasar por nuestro servidor — necesario porque un
      // avatar de hasta 4MB no entra en el límite de 2MB de los server
      // actions (experimental.serverActions.bodySizeLimit en next.config.ts).
      const solicitud = await fetch("/api/avatar", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ fileName: file.name, contentType: file.type, size: file.size }),
      });
      if (!solicitud.ok) {
        const data = (await solicitud.json().catch(() => ({}))) as { error?: string };
        throw new Error(data.error ?? "No se pudo preparar la subida del avatar");
      }
      const { uploadUrl, publicUrl } = (await solicitud.json()) as {
        uploadUrl: string;
        publicUrl: string;
      };

      const subida = await fetch(uploadUrl, {
        method: "PUT",
        headers: { "Content-Type": file.type },
        body: file,
      });
      if (!subida.ok) {
        throw new Error("No se pudo subir el avatar al storage");
      }

      await setAvatar(publicUrl);
      setAvatarUrl(publicUrl);
      toast.success("Avatar actualizado");
    } catch (err) {
      const msg = err instanceof Error ? err.message : "No se pudo subir el avatar";
      toast.error(msg);
    } finally {
      setUploadingAvatar(false);
    }
  }

  async function handleToggleMatch() {
    setMatchToggling(true);
    const optimistic = !matchOptIn;
    setMatchOptIn(optimistic);
    try {
      const result = await toggleMatchOptIn();
      setMatchOptIn(result.isMatchOptIn);
    } catch (err) {
      setMatchOptIn(!optimistic);
      toast.error(err instanceof Error ? err.message : "No se pudo actualizar tu Book Match");
    } finally {
      setMatchToggling(false);
    }
  }

  async function handleSubmit() {
    setSubmitting(true);
    try {
      const birthday =
        day !== "" && month !== ""
          ? new Date(Date.UTC(2000, Number(month), Number(day)))
          : null;
      await updateProfile({
        name: name.trim(),
        bio: bio.trim() || null,
        birthday,
        favoriteGenres: genres,
      });
      toast.success("Perfil actualizado");
      onClose();
    } catch (err) {
      const msg = err instanceof Error ? err.message : "No se pudo guardar";
      toast.error(msg);
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <>
      <DialogHeader>
        <DialogTitle>Editar perfil</DialogTitle>
        <DialogDescription>
          Actualiza tu avatar, nombre, bio, cumpleaños y géneros favoritos.
        </DialogDescription>
      </DialogHeader>

      <div className="space-y-5">
        <div className="flex items-center gap-4">
          <Avatar className="h-16 w-16">
            {avatarUrl ? <AvatarImage src={avatarUrl} alt="" /> : null}
            <AvatarFallback className="text-lg">
              {getInitials(name, user.email)}
            </AvatarFallback>
          </Avatar>
          <div className="flex flex-col gap-2">
            <input
              ref={fileInputRef}
              type="file"
              accept="image/jpeg,image/png,image/webp"
              className="hidden"
              onChange={(e) => {
                const file = e.target.files?.[0];
                if (file) void handleAvatarFile(file);
                e.target.value = "";
              }}
            />
            <Button
              type="button"
              variant="ghost"
              size="sm"
              className="self-start"
              disabled={uploadingAvatar}
              onClick={() => fileInputRef.current?.click()}
            >
              {uploadingAvatar ? (
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
              ) : (
                <Camera className="h-3.5 w-3.5" />
              )}
              Cambiar avatar
            </Button>
            <FieldDescription>JPG, PNG o WEBP, máx. 4MB.</FieldDescription>
          </div>
        </div>

        <Field>
          <Label htmlFor="name" required>Nombre</Label>
          <Input id="name" value={name} onChange={(e) => setName(e.target.value)} maxLength={60} />
        </Field>

        <Field>
          <Label htmlFor="bio" optional>Bio</Label>
          <Textarea
            id="bio"
            rows={3}
            value={bio}
            onChange={(e) => setBio(e.target.value)}
            maxLength={280}
            placeholder="Cuéntanos un poco de ti…"
          />
        </Field>

        <Field>
          <Label optional>Cumpleaños</Label>
          <div className="grid grid-cols-2 gap-3">
            <Select
              aria-label="Día"
              value={day}
              onChange={(e) => setDay(e.target.value)}
            >
              <option value="">Día</option>
              {Array.from({ length: availableDays }, (_, i) => i + 1).map((d) => (
                <option key={d} value={d}>
                  {d}
                </option>
              ))}
            </Select>
            <Select
              aria-label="Mes"
              value={month}
              onChange={(e) => {
                const nextMonth = e.target.value;
                setMonth(nextMonth);
                if (nextMonth !== "" && Number(day) > daysInMonth(Number(nextMonth))) {
                  setDay("");
                }
              }}
            >
              <option value="">Mes</option>
              {MONTHS.map((m, i) => (
                <option key={m} value={i}>
                  {m.charAt(0).toUpperCase() + m.slice(1)}
                </option>
              ))}
            </Select>
          </div>
          <FieldDescription>Solo día y mes — no pedimos el año.</FieldDescription>
        </Field>

        <Field>
          <Label optional>Géneros favoritos</Label>
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
                    "inline-flex items-center rounded-full border px-3 py-1 text-xs font-medium transition-colors focus-ring",
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
        </Field>

        <Field>
          <div className="flex items-center justify-between gap-4 rounded-xl border border-border/60 bg-card/40 px-3.5 py-3">
            <div className="space-y-0.5">
              <Label>Book Match semanal</Label>
              <FieldDescription>
                Cada lunes te presentamos a alguien del club con quien compartes gustos de lectura, con un
                correo para romper el hielo. Es opcional — puedes desactivarlo cuando quieras.
              </FieldDescription>
            </div>
            <button
              type="button"
              role="switch"
              aria-checked={matchOptIn}
              aria-label="Book Match semanal"
              disabled={matchToggling}
              onClick={handleToggleMatch}
              className={cn(
                "relative inline-flex h-6 w-10 shrink-0 items-center rounded-full border transition-colors focus-ring disabled:opacity-50",
                matchOptIn ? "border-primary bg-primary" : "border-border bg-muted",
              )}
            >
              <span
                className={cn(
                  "pointer-events-none inline-block h-4 w-4 transform rounded-full bg-background shadow transition-transform",
                  matchOptIn ? "translate-x-[18px]" : "translate-x-0.5",
                )}
              />
            </button>
          </div>
        </Field>
      </div>

      <DialogFooter>
        <Button variant="ghost" onClick={onClose}>
          Cancelar
        </Button>
        <Button onClick={handleSubmit} disabled={submitting || name.trim().length < 2}>
          {submitting ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <Check className="h-4 w-4" />
          )}
          Guardar cambios
        </Button>
      </DialogFooter>
    </>
  );
}
