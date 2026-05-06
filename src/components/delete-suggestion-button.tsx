"use client";

import * as React from "react";
import { Trash2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { deleteSuggestion } from "@/server/actions/suggestions";

export function DeleteSuggestionButton({ suggestionId }: { suggestionId: string }) {
  const [loading, setLoading] = React.useState(false);

  async function onClick() {
    if (!confirm("¿Eliminar esta sugerencia?")) return;
    setLoading(true);
    try {
      await deleteSuggestion(suggestionId);
      toast.success("Sugerencia eliminada");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Error");
    } finally {
      setLoading(false);
    }
  }

  return (
    <Button
      variant="ghost"
      size="icon"
      onClick={onClick}
      disabled={loading}
      aria-label="Eliminar sugerencia"
      className="text-muted-foreground hover:text-destructive"
    >
      <Trash2 className="h-4 w-4" />
    </Button>
  );
}
