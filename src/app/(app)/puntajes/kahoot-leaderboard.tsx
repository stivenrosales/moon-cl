"use client";

import * as React from "react";
import { Crown } from "lucide-react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Select } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { cn, formatDate, getInitials } from "@/lib/utils";

export interface LeaderboardEntry {
  rank: number;
  userId: string;
  name: string;
  image: string | null;
  points: number;
  caption: string;
}

export interface ActivityLeaderboard {
  id: string;
  title: string;
  playedAt: Date;
  entries: LeaderboardEntry[];
}

interface KahootLeaderboardProps {
  accumulated: LeaderboardEntry[];
  activities: ActivityLeaderboard[];
  lastActivity: { title: string; playedAt: Date } | null;
}

export function KahootLeaderboard({ accumulated, activities, lastActivity }: KahootLeaderboardProps) {
  const [selectedActivityId, setSelectedActivityId] = React.useState(activities[0]?.id ?? "");
  const selectedActivity = activities.find((a) => a.id === selectedActivityId) ?? activities[0] ?? null;

  return (
    <div className="space-y-5">
      <Tabs defaultValue="acumulado">
        <TabsList className="w-full grid grid-cols-2 sm:inline-flex sm:w-auto">
          <TabsTrigger value="acumulado">Acumulado</TabsTrigger>
          <TabsTrigger value="actividad">Por actividad</TabsTrigger>
        </TabsList>

        <TabsContent value="acumulado" className="space-y-5">
          <Board
            entries={accumulated}
            emptyMessage="Aún nadie tiene puntaje acumulado. Aparecerá acá en cuanto se carguen los primeros puntajes."
          />
        </TabsContent>

        <TabsContent value="actividad" className="space-y-5">
          {activities.length > 0 ? (
            <div className="max-w-sm">
              <Select
                value={selectedActivity?.id}
                onChange={(e) => setSelectedActivityId(e.target.value)}
                aria-label="Elegir actividad de Kahoot"
              >
                {activities.map((a) => (
                  <option key={a.id} value={a.id}>
                    {a.title} — {formatDate(a.playedAt)}
                  </option>
                ))}
              </Select>
            </div>
          ) : null}

          <Board
            entries={selectedActivity?.entries ?? []}
            emptyMessage="Todavía no se cargaron puntajes para esta actividad."
          />
        </TabsContent>
      </Tabs>

      {lastActivity ? (
        <p className="text-xs text-muted-foreground">
          Última actividad:{" "}
          <span className="text-foreground">{lastActivity.title}</span> ·{" "}
          {formatDate(lastActivity.playedAt)}
        </p>
      ) : null}
    </div>
  );
}

function Board({ entries, emptyMessage }: { entries: LeaderboardEntry[]; emptyMessage: string }) {
  if (entries.length === 0) {
    return <p className="py-6 text-center text-sm text-muted-foreground">{emptyMessage}</p>;
  }

  const top3 = entries.slice(0, 3);
  const rest = entries.slice(3);

  return (
    <div className="space-y-5">
      <Podium top3={top3} />
      {rest.length > 0 ? <ScoreTable entries={rest} /> : null}
    </div>
  );
}

const PODIUM_HEIGHTS = ["h-16", "h-24", "h-11"] as const;

function Podium({ top3 }: { top3: LeaderboardEntry[] }) {
  // Orden visual clásico de podio: segundo, primero, tercero.
  const order = [top3[1] ?? null, top3[0] ?? null, top3[2] ?? null];

  return (
    <div className="flex items-end justify-center gap-3 sm:gap-5">
      {order.map((entry, idx) =>
        entry ? (
          <div key={entry.userId} className="flex w-24 flex-col items-center gap-2 sm:w-28">
            <Avatar
              className={cn(
                "ring-2",
                entry.rank === 1 ? "h-14 w-14 ring-accent/60" : "h-11 w-11 ring-border",
              )}
            >
              {entry.image ? <AvatarImage src={entry.image} alt="" /> : null}
              <AvatarFallback className={entry.rank === 1 ? "text-sm" : "text-xs"}>
                {getInitials(entry.name, null)}
              </AvatarFallback>
            </Avatar>
            <div className="text-center">
              <p className="flex items-center justify-center gap-1 text-sm font-medium truncate max-w-[6.5rem]">
                {entry.rank === 1 ? (
                  <Crown className="h-3 w-3 shrink-0 text-accent-text" aria-hidden />
                ) : null}
                <span className="truncate">{entry.name}</span>
              </p>
              <p className="text-xs text-muted-foreground tabular-nums">{entry.points} pts</p>
            </div>
            <div
              className={cn(
                "flex w-full items-start justify-center rounded-t-xl border pt-2",
                PODIUM_HEIGHTS[idx],
                entry.rank === 1
                  ? "border-accent/30 bg-accent/15"
                  : "border-border/40 bg-muted/40",
              )}
            >
              <span
                className={cn(
                  "inline-flex h-6 w-6 items-center justify-center rounded-full text-xs font-semibold tabular-nums",
                  entry.rank === 1
                    ? "bg-accent/25 text-accent-text"
                    : "bg-card text-muted-foreground",
                )}
              >
                {entry.rank}
              </span>
            </div>
          </div>
        ) : (
          <div key={idx} className="w-24 sm:w-28" aria-hidden />
        ),
      )}
    </div>
  );
}

function ScoreTable({ entries }: { entries: LeaderboardEntry[] }) {
  return (
    <ul className="divide-y divide-border/40 rounded-xl border border-border/40 bg-card/40">
      {entries.map((e) => (
        <li key={e.userId} className="flex items-center gap-3 px-4 py-2.5">
          <span className="w-6 shrink-0 text-center text-xs text-muted-foreground tabular-nums">
            {e.rank}
          </span>
          <Avatar className="h-8 w-8 shrink-0">
            {e.image ? <AvatarImage src={e.image} alt="" /> : null}
            <AvatarFallback className="text-[10px]">{getInitials(e.name, null)}</AvatarFallback>
          </Avatar>
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-medium">{e.name}</p>
            {e.caption ? (
              <p className="truncate text-xs text-muted-foreground">{e.caption}</p>
            ) : null}
          </div>
          <span className="shrink-0 text-sm font-semibold tabular-nums">{e.points} pts</span>
        </li>
      ))}
    </ul>
  );
}
