import { getSession } from "@/lib/session";
import type { Role } from "@prisma/client";

export class AuthError extends Error {
  constructor(message = "No autorizado") {
    super(message);
    this.name = "AuthError";
  }
}

export async function requireUser() {
  const session = await getSession();
  if (!session?.user?.id) {
    throw new AuthError("Debes iniciar sesión");
  }
  return session.user as {
    id: string;
    name?: string | null;
    email?: string | null;
    image?: string | null;
    role: Role;
  };
}

export async function requireRole(...roles: Role[]) {
  const user = await requireUser();
  if (!roles.includes(user.role)) {
    throw new AuthError("No tienes permisos para esta acción");
  }
  return user;
}

export async function requireAdmin() {
  return requireRole("ADMIN");
}

export async function requireModerator() {
  return requireRole("ADMIN", "MODERATOR");
}
