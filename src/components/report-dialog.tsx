"use client";

import * as React from "react";
import {
  AlertTriangle,
  ArrowLeft,
  Ban,
  Check,
  Loader2,
  MessageSquareWarning,
  ShieldAlert,
  ShieldCheck,
} from "lucide-react";
import { toast } from "sonner";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Field, Label } from "@/components/ui/label";
import { blockUser, reportConversation } from "@/server/actions/moderation";
import {
  REPORT_CATEGORY_DESCRIPTIONS,
  REPORT_CATEGORY_LABELS,
  REPORT_CATEGORY_OPTIONS,
  REPORT_SUB_REASONS,
  type ReportCategory,
} from "@/lib/report-categories";
import { cn } from "@/lib/utils";

// ─────────────────────────────────────────────────────────────────────────
// Flujo Discord de 2 pasos (contrato visual): categoría → sub-razón +
// detalles opcionales, con botón atrás. Al enviar, ofrece bloquear de
// inmediato a quien se reportó — patrón que reduce fricción para que
// reportar y bloquear no sean dos acciones separadas que el usuario tenga
// que repetir. El copy de anonimato es SIEMPRE visible mientras se arma el
// reporte (pasos 1 y 2); ya no aplica en la pantalla de bloqueo, que es
// sobre otra decisión.
// ─────────────────────────────────────────────────────────────────────────

const CATEGORY_ICONS: Record<ReportCategory, React.ComponentType<{ className?: string }>> = {
  ACOSO: ShieldAlert,
  SPAM: Ban,
  CONTENIDO_INAPROPIADO: AlertTriangle,
  OTRO: MessageSquareWarning,
};

type Step = "category" | "details" | "blockOffer";

interface ReportDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  targetUserId: string;
  targetUserName: string;
  messageId?: string | null;
  onBlocked?: () => void;
}

export function ReportDialog({
  open,
  onOpenChange,
  targetUserId,
  targetUserName,
  messageId = null,
  onBlocked,
}: ReportDialogProps) {
  const [step, setStep] = React.useState<Step>("category");
  const [category, setCategory] = React.useState<ReportCategory | null>(null);
  const [subReason, setSubReason] = React.useState<string | null>(null);
  const [details, setDetails] = React.useState("");
  const [submitting, setSubmitting] = React.useState(false);
  const [blocking, setBlocking] = React.useState(false);

  React.useEffect(() => {
    if (open) {
      setStep("category");
      setCategory(null);
      setSubReason(null);
      setDetails("");
    }
  }, [open]);

  function chooseCategory(value: ReportCategory) {
    setCategory(value);
    setSubReason(null);
    setStep("details");
  }

  async function handleSubmit() {
    if (!category || !subReason) return;
    setSubmitting(true);
    try {
      await reportConversation({
        reportedUserId: targetUserId,
        category,
        subReason,
        details: details.trim() || null,
        messageId,
      });
      toast.success("Reporte enviado");
      setStep("blockOffer");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "No se pudo enviar el reporte");
    } finally {
      setSubmitting(false);
    }
  }

  async function handleBlock() {
    setBlocking(true);
    try {
      await blockUser(targetUserId);
      toast.success(`Bloqueaste a ${targetUserName}`);
      onOpenChange(false);
      onBlocked?.();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "No se pudo bloquear");
    } finally {
      setBlocking(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        {step === "category" ? (
          <>
            <DialogHeader>
              <DialogTitle>Reportar a {targetUserName}</DialogTitle>
              <DialogDescription>¿Qué está pasando en esta conversación?</DialogDescription>
            </DialogHeader>

            <div className="space-y-2">
              {REPORT_CATEGORY_OPTIONS.map((value) => {
                const Icon = CATEGORY_ICONS[value];
                return (
                  <button
                    key={value}
                    type="button"
                    onClick={() => chooseCategory(value)}
                    className="flex w-full items-start gap-3 rounded-xl border border-border/50 bg-card/40 px-3.5 py-3 text-left transition-colors hover:border-primary/50 hover:bg-primary/5 focus-ring"
                  >
                    <Icon className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground" />
                    <span>
                      <span className="block text-sm font-medium">
                        {REPORT_CATEGORY_LABELS[value]}
                      </span>
                      <span className="block text-xs text-muted-foreground">
                        {REPORT_CATEGORY_DESCRIPTIONS[value]}
                      </span>
                    </span>
                  </button>
                );
              })}
            </div>

            <IdentityNotice />
          </>
        ) : null}

        {step === "details" && category ? (
          <>
            <DialogHeader>
              <button
                type="button"
                onClick={() => setStep("category")}
                className="inline-flex w-fit items-center gap-1 text-xs text-muted-foreground transition-colors hover:text-foreground"
              >
                <ArrowLeft className="h-3.5 w-3.5" /> Cambiar categoría
              </button>
              <DialogTitle>{REPORT_CATEGORY_LABELS[category]}</DialogTitle>
              <DialogDescription>Elige el motivo que mejor describe lo ocurrido.</DialogDescription>
            </DialogHeader>

            <div role="radiogroup" aria-label="Sub-razón del reporte" className="space-y-2">
              {REPORT_SUB_REASONS[category].map((reason) => {
                const selected = subReason === reason;
                return (
                  <button
                    key={reason}
                    type="button"
                    role="radio"
                    aria-checked={selected}
                    onClick={() => setSubReason(reason)}
                    className={cn(
                      "flex w-full items-center gap-2.5 rounded-lg border px-3.5 py-2.5 text-left text-sm transition-colors focus-ring",
                      selected
                        ? "border-primary bg-primary/10 text-foreground"
                        : "border-border/50 hover:border-border",
                    )}
                  >
                    <span className="flex-1">{reason}</span>
                    {selected ? <Check className="h-4 w-4 shrink-0 text-primary" /> : null}
                  </button>
                );
              })}
            </div>

            <Field>
              <Label htmlFor="report-details" optional>
                Detalles
              </Label>
              <Textarea
                id="report-details"
                value={details}
                onChange={(e) => setDetails(e.target.value)}
                placeholder="Agrega contexto que ayude a moderación…"
                maxLength={1000}
                rows={3}
              />
            </Field>

            <IdentityNotice />

            <DialogFooter>
              <Button type="button" variant="ghost" onClick={() => onOpenChange(false)}>
                Cancelar
              </Button>
              <Button type="button" onClick={handleSubmit} disabled={submitting || !subReason}>
                {submitting ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
                Enviar reporte
              </Button>
            </DialogFooter>
          </>
        ) : null}

        {step === "blockOffer" ? (
          <>
            <DialogHeader>
              <DialogTitle>¿Bloquear también a {targetUserName}?</DialogTitle>
              <DialogDescription>
                No podrá enviarte mensajes. Puedes deshacerlo cuando quieras.
              </DialogDescription>
            </DialogHeader>
            <DialogFooter>
              <Button type="button" variant="ghost" onClick={() => onOpenChange(false)}>
                No, solo reportar
              </Button>
              <Button type="button" variant="destructive" onClick={handleBlock} disabled={blocking}>
                {blocking ? <Loader2 className="h-4 w-4 animate-spin" /> : <Ban className="h-4 w-4" />}
                Bloquear
              </Button>
            </DialogFooter>
          </>
        ) : null}
      </DialogContent>
    </Dialog>
  );
}

function IdentityNotice() {
  return (
    <p className="flex items-start gap-2 rounded-lg bg-muted/40 px-3 py-2.5 text-xs text-muted-foreground">
      <ShieldCheck className="mt-0.5 h-3.5 w-3.5 shrink-0 text-accent-text" />
      Tu identidad no se comparte con quien reportas.
    </p>
  );
}
