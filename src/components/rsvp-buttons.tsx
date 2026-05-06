"use client";

import * as React from "react";
import { Check, HelpCircle, Loader2, X } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { setRsvp } from "@/server/actions/meetings";
import { cn } from "@/lib/utils";
import type { RsvpStatus } from "@prisma/client";

interface RsvpButtonsProps {
  meetingId: string;
  initial: RsvpStatus | null;
}

const options: Array<{ status: RsvpStatus; label: string; icon: React.ComponentType<{ className?: string }> }> = [
  { status: "YES", label: "Voy", icon: Check },
  { status: "MAYBE", label: "Quizás", icon: HelpCircle },
  { status: "NO", label: "No puedo", icon: X },
];

export function RsvpButtons({ meetingId, initial }: RsvpButtonsProps) {
  const [current, setCurrent] = React.useState<RsvpStatus | null>(initial);
  const [pending, setPending] = React.useState<RsvpStatus | null>(null);

  async function choose(status: RsvpStatus) {
    setPending(status);
    const prev = current;
    setCurrent(status);
    try {
      await setRsvp({ meetingId, status });
      toast.success("Respuesta guardada");
    } catch (err) {
      setCurrent(prev);
      toast.error(err instanceof Error ? err.message : "Error");
    } finally {
      setPending(null);
    }
  }

  return (
    <div className="inline-flex gap-2 rounded-full border border-border bg-card/60 p-1">
      {options.map(({ status, label, icon: Icon }) => {
        const active = current === status;
        return (
          <Button
            key={status}
            type="button"
            size="sm"
            variant={active ? "default" : "ghost"}
            onClick={() => choose(status)}
            disabled={pending !== null}
            className={cn("rounded-full", active && status === "YES" && "bg-emerald-500 text-white hover:bg-emerald-500/90 shadow-none")}
          >
            {pending === status ? (
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
            ) : (
              <Icon className="h-3.5 w-3.5" />
            )}
            {label}
          </Button>
        );
      })}
    </div>
  );
}
