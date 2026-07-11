"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { Check, Loader2, Pencil, Trash2 } from "lucide-react";
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
import { Label, Field, FieldDescription } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Select } from "@/components/ui/select";
import { DateTimeInput } from "@/components/ui/datetime-input";
import { deleteMeeting, updateMeeting } from "@/server/actions/meetings";
import { MEETING_TYPE_OPTIONS } from "@/lib/meeting-types";
import type { MeetingType } from "@prisma/client";

interface BookOption {
  id: string;
  title: string;
}

interface MeetingEditDialogProps {
  meeting: {
    id: string;
    title: string;
    description: string | null;
    bookId: string | null;
    type: MeetingType;
    startsAt: Date;
    endsAt: Date | null;
    location: string | null;
    meetingUrl: string | null;
    isVirtual: boolean;
  };
  books: BookOption[];
  /** Tras eliminar, a dónde navegar. Si se omite, no navega (p. ej. lista del admin). */
  redirectOnDeleteTo?: string;
}

function dateToInput(d: Date) {
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

export function MeetingEditDialog({ meeting, books, redirectOnDeleteTo }: MeetingEditDialogProps) {
  const router = useRouter();
  const [open, setOpen] = React.useState(false);
  const [title, setTitle] = React.useState(meeting.title);
  const [description, setDescription] = React.useState(meeting.description ?? "");
  const [bookId, setBookId] = React.useState(meeting.bookId ?? "");
  const [type, setType] = React.useState<string>(meeting.type);
  const [startsAt, setStartsAt] = React.useState(dateToInput(new Date(meeting.startsAt)));
  const [endsAt, setEndsAt] = React.useState(
    meeting.endsAt ? dateToInput(new Date(meeting.endsAt)) : "",
  );
  const [location, setLocation] = React.useState(meeting.location ?? "");
  const [meetingUrl, setMeetingUrl] = React.useState(meeting.meetingUrl ?? "");
  const [isVirtual, setIsVirtual] = React.useState(meeting.isVirtual);
  const [submitting, setSubmitting] = React.useState(false);
  const [deleting, setDeleting] = React.useState(false);

  async function handleSubmit() {
    setSubmitting(true);
    try {
      await updateMeeting(meeting.id, {
        title: title.trim(),
        description: description.trim() || null,
        bookId: bookId || null,
        type,
        startsAt: new Date(startsAt),
        endsAt: endsAt ? new Date(endsAt) : null,
        location: (location || "").trim() || null,
        meetingUrl: (meetingUrl || "").trim() || null,
        isVirtual,
      });
      toast.success("Reunión actualizada");
      setOpen(false);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "No se pudo guardar");
    } finally {
      setSubmitting(false);
    }
  }

  async function handleDelete() {
    if (!confirm(`¿Eliminar "${meeting.title}"? Se borrarán también sus confirmaciones.`)) return;
    setDeleting(true);
    try {
      await deleteMeeting(meeting.id);
      toast.success("Reunión eliminada");
      setOpen(false);
      if (redirectOnDeleteTo) router.push(redirectOnDeleteTo);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "No se pudo eliminar");
    } finally {
      setDeleting(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm" className="shrink-0">
          <Pencil className="h-3.5 w-3.5" />
          <span className="hidden sm:inline">Editar</span>
          <span className="sm:hidden sr-only">Editar reunión</span>
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Editar reunión</DialogTitle>
          <DialogDescription>Cambia fecha, tipo, lugar o enlace.</DialogDescription>
        </DialogHeader>

        <div className="space-y-5">
          <Field>
            <Label htmlFor="me-title">Título</Label>
            <Input id="me-title" value={title} onChange={(e) => setTitle(e.target.value)} />
          </Field>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <Field>
              <Label htmlFor="me-type">Tipo</Label>
              <Select id="me-type" value={type} onChange={(e) => setType(e.target.value)}>
                {MEETING_TYPE_OPTIONS.map((t) => (
                  <option key={t.value} value={t.value}>
                    {t.label}
                  </option>
                ))}
              </Select>
            </Field>
            <Field>
              <Label htmlFor="me-bookId" optional>Libro asociado</Label>
              <Select id="me-bookId" value={bookId} onChange={(e) => setBookId(e.target.value)}>
                <option value="">— Sin libro —</option>
                {books.map((b) => (
                  <option key={b.id} value={b.id}>
                    {b.title}
                  </option>
                ))}
              </Select>
            </Field>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <Field>
              <Label htmlFor="me-startsAt">Inicio</Label>
              <DateTimeInput
                id="me-startsAt"
                value={startsAt}
                onChange={(e) => setStartsAt(e.target.value)}
              />
              <FieldDescription>Si cambias la fecha, el recordatorio automático vuelve a activarse.</FieldDescription>
            </Field>
            <Field>
              <Label htmlFor="me-endsAt" optional>Fin</Label>
              <DateTimeInput
                id="me-endsAt"
                value={endsAt}
                onChange={(e) => setEndsAt(e.target.value)}
              />
            </Field>
          </div>

          <Checkbox
            checked={isVirtual}
            onChange={(e) => setIsVirtual(e.currentTarget.checked)}
            label="Reunión virtual"
            description="Si se desactiva, pediremos una dirección física en lugar del enlace."
          />

          {isVirtual ? (
            <Field>
              <Label htmlFor="me-meetingUrl">Enlace</Label>
              <Input
                id="me-meetingUrl"
                type="url"
                value={meetingUrl}
                onChange={(e) => setMeetingUrl(e.target.value)}
                placeholder="https://meet.google.com/..."
              />
            </Field>
          ) : (
            <Field>
              <Label htmlFor="me-location">Lugar</Label>
              <Input
                id="me-location"
                value={location}
                onChange={(e) => setLocation(e.target.value)}
                placeholder="Café de la luna, Calle 123"
              />
            </Field>
          )}

          <Field>
            <Label htmlFor="me-description" optional>Descripción</Label>
            <Textarea
              id="me-description"
              rows={3}
              maxLength={2000}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
            />
          </Field>
        </div>

        <DialogFooter className="sm:justify-between">
          <Button
            variant="ghost"
            disabled={deleting || submitting}
            className="text-muted-foreground hover:text-destructive"
            onClick={handleDelete}
          >
            {deleting ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Trash2 className="h-3.5 w-3.5" />}
            Eliminar
          </Button>
          <div className="flex flex-col-reverse gap-2 sm:flex-row">
            <Button variant="ghost" onClick={() => setOpen(false)}>
              Cancelar
            </Button>
            <Button onClick={handleSubmit} disabled={submitting || deleting || !title.trim()}>
              {submitting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Check className="h-4 w-4" />}
              Guardar cambios
            </Button>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
