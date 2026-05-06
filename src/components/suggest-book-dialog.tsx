"use client";

import * as React from "react";
import { Plus } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { BookSearch } from "@/components/book-search";

interface SuggestBookDialogProps {
  roundId: string;
  triggerLabel?: string;
}

export function SuggestBookDialog({ roundId, triggerLabel = "Sugerir un libro" }: SuggestBookDialogProps) {
  const [open, setOpen] = React.useState(false);

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="gold">
          <Plus className="h-4 w-4" />
          {triggerLabel}
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>Sugiere un libro</DialogTitle>
          <DialogDescription>
            Búscalo en Google Books y, si quieres, cuéntale al club por qué te gustó.
          </DialogDescription>
        </DialogHeader>
        <BookSearch roundId={roundId} onSuggested={() => setOpen(false)} />
      </DialogContent>
    </Dialog>
  );
}
