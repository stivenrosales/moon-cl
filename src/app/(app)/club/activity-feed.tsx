import Link from "next/link";
import { Sparkles } from "lucide-react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Card } from "@/components/ui/card";
import { StarRating } from "@/components/star-rating";
import { getInitials, relativeTime } from "@/lib/utils";
import { routes } from "@/lib/routes";
import { joinVerbs, type FeedEntry } from "@/server/services/feed";

export function ActivityFeed({ entries }: { entries: FeedEntry[] }) {
  if (entries.length === 0) {
    return (
      <Card className="p-8 text-center">
        <Sparkles className="mx-auto h-6 w-6 text-primary/60" />
        <p className="mt-2 hand-script text-2xl">Sin actividad todavía</p>
        <p className="mt-1 text-sm text-muted-foreground">
          Sigue a otras lectoras para ver lo que van leyendo, o espera a que avance la lectura del club.
        </p>
      </Card>
    );
  }

  return (
    <ul className="space-y-3">
      {entries.map((entry) => (
        <li key={entry.key}>
          <FeedItem entry={entry} />
        </li>
      ))}
    </ul>
  );
}

function razonLabel(entry: FeedEntry): string | null {
  if (entry.razon === "club") return "Porque es la lectura del club";
  if (entry.razon === "sigues") {
    const name = entry.user.name ?? entry.user.email?.split("@")[0] ?? "alguien";
    return `Porque sigues a ${name}`;
  }
  return null;
}

function FeedItem({ entry }: { entry: FeedEntry }) {
  const label = razonLabel(entry);
  const displayName = entry.user.name ?? entry.user.email?.split("@")[0] ?? "Alguien";

  return (
    <Card className="p-3.5 sm:p-4 space-y-2">
      {label ? <p className="text-xs italic text-muted-foreground/70">{label}</p> : null}
      <div className="flex gap-3">
        <Avatar className="h-9 w-9 shrink-0">
          {entry.user.image ? <AvatarImage src={entry.user.image} alt="" /> : null}
          <AvatarFallback className="text-xs">
            {getInitials(entry.user.name, entry.user.email)}
          </AvatarFallback>
        </Avatar>
        <div className="min-w-0 flex-1 space-y-1.5">
          <p className="text-sm leading-relaxed">
            <span className="font-semibold text-foreground">{displayName}</span>{" "}
            <span className="text-muted-foreground">{joinVerbs(entry.verbs)}</span>{" "}
            <Link
              href={routes.libro(entry.book.id)}
              className="display italic hover:text-primary transition-colors"
            >
              {entry.book.title}
            </Link>
            <span className="ml-2 text-xs text-muted-foreground">{relativeTime(entry.occurredAt)}</span>
          </p>

          {entry.stars != null ? <StarRating value={entry.stars} readOnly size={14} /> : null}

          {entry.quotes.length > 0 ? (
            <div className="space-y-1.5">
              {entry.quotes.map((q) => (
                <p key={q.id} className="display italic text-sm text-muted-foreground/90 leading-snug break-words">
                  &ldquo;{q.content}&rdquo;
                </p>
              ))}
            </div>
          ) : null}
        </div>
      </div>
    </Card>
  );
}
