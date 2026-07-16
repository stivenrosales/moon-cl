"use client";

import * as React from "react";
import { MessageSquareQuote } from "lucide-react";
import { Select } from "@/components/ui/select";
import { Card } from "@/components/ui/card";
import { QuoteCard, type QuoteCardData } from "@/components/quote-card";
import { ShareQuoteDialog, type ShareableBook } from "@/components/share-quote-dialog";

interface QuotesPanelProps {
  quotes: QuoteCardData[];
  books: ShareableBook[];
  currentUserId: string;
  isModerator: boolean;
}

export function QuotesPanel({ quotes, books, currentUserId, isModerator }: QuotesPanelProps) {
  const [filterBookId, setFilterBookId] = React.useState("");

  const filterOptions = React.useMemo(() => {
    const map = new Map<string, string>();
    for (const q of quotes) map.set(q.book.id, q.book.title);
    return Array.from(map.entries()).map(([id, title]) => ({ id, title }));
  }, [quotes]);

  const filtered = filterBookId ? quotes.filter((q) => q.book.id === filterBookId) : quotes;

  return (
    <div className="space-y-4">
      <div className="flex flex-col sm:flex-row sm:items-center gap-3 sm:justify-between">
        {filterOptions.length > 1 ? (
          <Select
            value={filterBookId}
            onChange={(e) => setFilterBookId(e.target.value)}
            className="sm:w-64"
            aria-label="Filtrar frases por libro"
          >
            <option value="">Todos los libros</option>
            {filterOptions.map((b) => (
              <option key={b.id} value={b.id}>
                {b.title}
              </option>
            ))}
          </Select>
        ) : (
          <span />
        )}
        <ShareQuoteDialog books={books} />
      </div>

      {filtered.length === 0 ? (
        <Card className="p-8 text-center">
          <MessageSquareQuote className="mx-auto h-6 w-6 text-primary/60" />
          <p className="mt-2 hand-script text-2xl">
            {quotes.length === 0 ? "Sin frases todavía" : "Nada con ese filtro"}
          </p>
          <p className="mt-1 text-sm text-muted-foreground">
            {quotes.length === 0
              ? "Sé la primera en compartir un fragmento memorable."
              : "Prueba con otro libro."}
          </p>
        </Card>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
          {filtered.map((q) => (
            <QuoteCard key={q.id} quote={q} currentUserId={currentUserId} isModerator={isModerator} />
          ))}
        </div>
      )}
    </div>
  );
}
