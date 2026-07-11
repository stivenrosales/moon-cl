"use client";

import * as React from "react";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Input } from "@/components/ui/input";
import { getInitials } from "@/lib/utils";
import { updateKahootScore } from "@/server/actions/kahoot";

export interface KahootMemberOption {
  id: string;
  name: string | null;
  email: string | null;
  image: string | null;
}

export type KahootScoreValues = Record<
  string,
  { points: string; correctAnswers: string }
>;

function MemberIdentity({ member }: { member: KahootMemberOption }) {
  return (
    <div className="flex items-center gap-2.5 min-w-0 flex-1">
      <Avatar className="h-7 w-7 shrink-0">
        {member.image ? <AvatarImage src={member.image} alt="" /> : null}
        <AvatarFallback className="text-[10px]">
          {getInitials(member.name, member.email)}
        </AvatarFallback>
      </Avatar>
      <span className="text-sm truncate">{member.name ?? member.email}</span>
    </div>
  );
}

/**
 * Tabla de miembros con un input numérico de puntos por fila (patrón
 * role-select: una fila por persona, un control por dato). En modo
 * controlado: quien llama guarda el estado y lo manda junto con el resto
 * del formulario de la actividad (createKahootActivity crea todo en una
 * sola transacción).
 */
export function KahootScoresForm({
  members,
  values,
  onChange,
}: {
  members: KahootMemberOption[];
  values: KahootScoreValues;
  onChange: (userId: string, field: "points" | "correctAnswers", value: string) => void;
}) {
  if (members.length === 0) {
    return (
      <p className="text-xs text-muted-foreground">
        Todavía no hay miembros en el club.
      </p>
    );
  }

  return (
    <ul className="divide-y divide-border/40 rounded-xl border border-border/40 bg-card/40 max-h-72 overflow-y-auto">
      {members.map((m) => (
        <li key={m.id} className="px-3 py-2 flex items-center gap-3">
          <MemberIdentity member={m} />
          <Input
            type="number"
            inputMode="numeric"
            min={0}
            placeholder="Puntos"
            aria-label={`Puntos de ${m.name ?? m.email}`}
            className="h-8 w-20 shrink-0 text-right tabular-nums"
            value={values[m.id]?.points ?? ""}
            onChange={(e) => onChange(m.id, "points", e.target.value)}
          />
        </li>
      ))}
    </ul>
  );
}

/**
 * Igual tabla pero para una actividad ya existente: cada fila guarda sola
 * al perder el foco (upsert vía updateKahootScore), sin botón de envío —
 * el mismo patrón "guarda al cambiar" que RoleSelect en Miembros del club.
 */
export function KahootScoresEditor({
  activityId,
  members,
  initialScores,
}: {
  activityId: string;
  members: KahootMemberOption[];
  initialScores: Record<string, { points: number; correctAnswers: number | null }>;
}) {
  if (members.length === 0) {
    return (
      <p className="text-xs text-muted-foreground">
        Todavía no hay miembros en el club.
      </p>
    );
  }

  return (
    <ul className="divide-y divide-border/40 rounded-xl border border-border/40 bg-card/40 max-h-72 overflow-y-auto">
      {members.map((m) => (
        <KahootScoreRow
          key={m.id}
          activityId={activityId}
          member={m}
          initial={initialScores[m.id]}
        />
      ))}
    </ul>
  );
}

function KahootScoreRow({
  activityId,
  member,
  initial,
}: {
  activityId: string;
  member: KahootMemberOption;
  initial?: { points: number; correctAnswers: number | null };
}) {
  const [points, setPoints] = React.useState(
    initial ? String(initial.points) : "",
  );
  const [pending, setPending] = React.useState(false);

  async function save(rawValue: string) {
    if (rawValue.trim() === "") return;
    const parsed = Number(rawValue);
    if (!Number.isFinite(parsed) || parsed < 0) {
      toast.error("Ingresa un número de puntos válido");
      setPoints(initial ? String(initial.points) : "");
      return;
    }
    if (initial && parsed === initial.points) return;

    setPending(true);
    try {
      await updateKahootScore(activityId, {
        userId: member.id,
        points: parsed,
        correctAnswers: initial?.correctAnswers ?? null,
      });
      toast.success(`Puntaje de ${member.name ?? member.email} actualizado`);
    } catch (err) {
      setPoints(initial ? String(initial.points) : "");
      toast.error(err instanceof Error ? err.message : "Error");
    } finally {
      setPending(false);
    }
  }

  return (
    <li className="px-3 py-2 flex items-center gap-3">
      <MemberIdentity member={member} />
      {pending ? <Loader2 className="h-3.5 w-3.5 animate-spin text-muted-foreground" /> : null}
      <Input
        type="number"
        inputMode="numeric"
        min={0}
        placeholder="Puntos"
        aria-label={`Puntos de ${member.name ?? member.email}`}
        className="h-8 w-20 shrink-0 text-right tabular-nums"
        value={points}
        disabled={pending}
        onChange={(e) => setPoints(e.target.value)}
        onBlur={(e) => save(e.target.value)}
      />
    </li>
  );
}
