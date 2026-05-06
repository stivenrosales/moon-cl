import type { Role } from "@prisma/client";

export function isAdmin(role?: Role | null) {
  return role === "ADMIN";
}

export function isModeratorOrAbove(role?: Role | null) {
  return role === "ADMIN" || role === "MODERATOR";
}

export function getInitialAdminEmails(): string[] {
  const raw = process.env.ADMIN_EMAILS ?? "";
  return raw
    .split(",")
    .map((e) => e.trim().toLowerCase())
    .filter(Boolean);
}
