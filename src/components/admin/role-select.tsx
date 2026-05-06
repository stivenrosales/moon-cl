"use client";

import * as React from "react";
import { toast } from "sonner";
import { setUserRole } from "@/server/actions/admin";
import type { Role } from "@prisma/client";

export function RoleSelect({
  userId,
  current,
  disabled,
}: {
  userId: string;
  current: Role;
  disabled?: boolean;
}) {
  const [pending, setPending] = React.useState(false);
  const [value, setValue] = React.useState<Role>(current);

  async function onChange(e: React.ChangeEvent<HTMLSelectElement>) {
    const next = e.target.value as Role;
    setPending(true);
    const prev = value;
    setValue(next);
    try {
      await setUserRole(userId, next);
      toast.success("Rol actualizado");
    } catch (err) {
      setValue(prev);
      toast.error(err instanceof Error ? err.message : "Error");
    } finally {
      setPending(false);
    }
  }

  return (
    <select
      value={value}
      onChange={onChange}
      disabled={disabled || pending}
      className="rounded-md border border-input bg-background/60 px-2 py-1 text-xs focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:opacity-50"
    >
      <option value="MEMBER">Miembro</option>
      <option value="MODERATOR">Moderador</option>
      <option value="ADMIN">Admin</option>
    </select>
  );
}
