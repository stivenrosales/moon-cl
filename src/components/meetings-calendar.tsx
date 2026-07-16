"use client";

import * as React from "react";
import Link from "next/link";
import { ChevronLeft, ChevronRight } from "lucide-react";
import {
  addMonths,
  eachDayOfInterval,
  endOfMonth,
  endOfWeek,
  format,
  isSameDay,
  isSameMonth,
  isToday,
  startOfMonth,
  startOfWeek,
  subMonths,
} from "date-fns";
import { es } from "date-fns/locale";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { RsvpButtons } from "@/components/rsvp-buttons";
import { routes } from "@/lib/routes";
import { cn, formatDateTime } from "@/lib/utils";
import {
  MEETING_TYPE_BADGE_VARIANT,
  MEETING_TYPE_DOT_CLASS,
  MEETING_TYPE_LABELS,
  MEETING_TYPE_OPTIONS,
} from "@/lib/meeting-types";
import type { MeetingType, RsvpStatus } from "@prisma/client";

export interface CalendarMeeting {
  id: string;
  title: string;
  type: MeetingType;
  startsAt: Date;
  myRsvp: RsvpStatus | null;
}

const WEEKDAYS = ["L", "M", "M", "J", "V", "S", "D"];

export function MeetingsCalendar({ meetings }: { meetings: CalendarMeeting[] }) {
  const [cursor, setCursor] = React.useState(() => startOfMonth(new Date()));
  const [selected, setSelected] = React.useState<Date | null>(null);

  const days = React.useMemo(() => {
    const start = startOfWeek(startOfMonth(cursor), { weekStartsOn: 1 });
    const end = endOfWeek(endOfMonth(cursor), { weekStartsOn: 1 });
    return eachDayOfInterval({ start, end });
  }, [cursor]);

  const byDay = React.useMemo(() => {
    const map = new Map<string, CalendarMeeting[]>();
    for (const m of meetings) {
      const key = format(m.startsAt, "yyyy-MM-dd");
      const list = map.get(key) ?? [];
      list.push(m);
      map.set(key, list);
    }
    return map;
  }, [meetings]);

  const selectedKey = selected ? format(selected, "yyyy-MM-dd") : null;
  const selectedMeetings = selectedKey ? byDay.get(selectedKey) ?? [] : [];

  return (
    <div className="space-y-4">
      <Card className="p-4 sm:p-5">
        <div className="flex items-center justify-between mb-4">
          <h3 className="display text-lg capitalize">
            {format(cursor, "MMMM yyyy", { locale: es })}
          </h3>
          <div className="flex items-center gap-1">
            <button
              type="button"
              onClick={() => setCursor((c) => subMonths(c, 1))}
              className="inline-flex items-center justify-center h-8 w-8 rounded-full hover:bg-muted transition-colors focus-ring"
              aria-label="Mes anterior"
            >
              <ChevronLeft className="h-4 w-4" />
            </button>
            <button
              type="button"
              onClick={() => setCursor((c) => addMonths(c, 1))}
              className="inline-flex items-center justify-center h-8 w-8 rounded-full hover:bg-muted transition-colors focus-ring"
              aria-label="Mes siguiente"
            >
              <ChevronRight className="h-4 w-4" />
            </button>
          </div>
        </div>

        <div className="grid grid-cols-7 gap-1 text-center text-[10px] uppercase tracking-[0.18em] text-muted-foreground mb-2">
          {WEEKDAYS.map((d, i) => (
            <span key={i}>{d}</span>
          ))}
        </div>

        <div className="grid grid-cols-7 gap-1">
          {days.map((day) => {
            const key = format(day, "yyyy-MM-dd");
            const dayMeetings = byDay.get(key) ?? [];
            const inMonth = isSameMonth(day, cursor);
            const active = selectedKey === key;
            return (
              <button
                key={key}
                type="button"
                onClick={() => setSelected(active ? null : day)}
                className={cn(
                  "aspect-square rounded-lg flex flex-col items-center justify-center gap-1 text-sm transition-colors focus-ring",
                  inMonth ? "text-foreground" : "text-muted-foreground/40",
                  active ? "bg-primary text-primary-foreground" : "hover:bg-muted",
                  isToday(day) && !active ? "ring-1 ring-primary/50" : "",
                )}
              >
                <span className="tabular-nums">{format(day, "d")}</span>
                <span className="inline-flex items-center gap-0.5 h-1.5">
                  {dayMeetings.slice(0, 3).map((m) => (
                    <span
                      key={m.id}
                      className={cn(
                        "h-1.5 w-1.5 rounded-full",
                        active ? "bg-primary-foreground" : MEETING_TYPE_DOT_CLASS[m.type],
                      )}
                    />
                  ))}
                </span>
              </button>
            );
          })}
        </div>

        <div className="mt-4 flex flex-wrap items-center gap-3 text-[11px] text-muted-foreground border-t border-border/60 pt-3">
          {MEETING_TYPE_OPTIONS.map((t) => (
            <span key={t.value} className="inline-flex items-center gap-1.5">
              <span className={cn("h-1.5 w-1.5 rounded-full", MEETING_TYPE_DOT_CLASS[t.value])} />
              {t.label}
            </span>
          ))}
        </div>
      </Card>

      {selected ? (
        <Card className="p-5 space-y-4">
          <h4 className="text-xs uppercase tracking-[0.24em] text-muted-foreground">
            {format(selected, "EEEE d 'de' MMMM", { locale: es })}
          </h4>
          {selectedMeetings.length === 0 ? (
            <p className="text-sm text-muted-foreground">Sin actividades este día.</p>
          ) : (
            <ul className="space-y-4">
              {selectedMeetings.map((m) => (
                <li key={m.id} className="space-y-2">
                  <div className="flex items-center gap-2 flex-wrap">
                    <Badge variant={MEETING_TYPE_BADGE_VARIANT[m.type]}>
                      {MEETING_TYPE_LABELS[m.type]}
                    </Badge>
                    <Link href={routes.reunion(m.id)} className="font-medium hover:text-primary">
                      {m.title}
                    </Link>
                    <span className="ml-auto text-xs text-muted-foreground tabular-nums">
                      {formatDateTime(m.startsAt)}
                    </span>
                  </div>
                  <RsvpButtons meetingId={m.id} initial={m.myRsvp} />
                </li>
              ))}
            </ul>
          )}
        </Card>
      ) : null}
    </div>
  );
}
