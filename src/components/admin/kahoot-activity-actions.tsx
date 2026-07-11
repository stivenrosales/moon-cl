"use client";

import * as React from "react";
import { ChevronDown, ChevronUp, Loader2, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  KahootScoresEditor,
  type KahootMemberOption,
} from "@/components/admin/kahoot-scores-form";
import { deleteKahootActivity } from "@/server/actions/kahoot";

interface KahootActivityActionsProps {
  activityId: string;
  title: string;
  isAdmin: boolean;
  members: KahootMemberOption[];
  initialScores: Record<string, { points: number; correctAnswers: number | null }>;
}

/**
 * Acciones de una actividad ya existente en "Existentes": expandir para
 * corregir puntajes (updateKahootScore, patrón role-select) y, solo para
 * admin, borrarla por completo (deleteKahootActivity).
 */
export function KahootActivityActions({
  activityId,
  title,
  isAdmin,
  members,
  initialScores,
}: KahootActivityActionsProps) {
  const [expanded, setExpanded] = React.useState(false);
  const [deleting, setDeleting] = React.useState(false);

  async function onDelete() {
    if (!confirm(`¿Borrar "${title}" y todos sus puntajes? Esta acción no se puede deshacer.`)) {
      return;
    }
    setDeleting(true);
    try {
      await deleteKahootActivity(activityId);
      toast.success("Actividad borrada");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Error");
    } finally {
      setDeleting(false);
    }
  }

  return (
    <div className="space-y-2">
      <div className="flex items-center gap-1.5">
        <Button
          type="button"
          size="sm"
          variant="ghost"
          onClick={() => setExpanded((v) => !v)}
        >
          {expanded ? <ChevronUp className="h-3.5 w-3.5" /> : <ChevronDown className="h-3.5 w-3.5" />}
          <span className="hidden sm:inline">Puntajes</span>
        </Button>
        {isAdmin ? (
          <Button
            type="button"
            size="sm"
            variant="ghost"
            disabled={deleting}
            onClick={onDelete}
            aria-label={`Borrar ${title}`}
            className="text-destructive hover:text-destructive hover:bg-destructive/10"
          >
            {deleting ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Trash2 className="h-3.5 w-3.5" />}
          </Button>
        ) : null}
      </div>

      {expanded ? (
        <KahootScoresEditor
          activityId={activityId}
          members={members}
          initialScores={initialScores}
        />
      ) : null}
    </div>
  );
}
