"use client";

import { LogOut } from "lucide-react";
import { signOut } from "next-auth/react";
import { Button } from "@/components/ui/button";

/**
 * Cerrar sesión es un onSelect de React (signOut), no una URL: sin este
 * botón visible en /perfil, un usuario en móvil queda atrapado en su
 * cuenta (nav.tsx solo lo exponía en el dropdown de escritorio).
 */
export function SignOutButton() {
  return (
    <Button
      type="button"
      variant="outline"
      onClick={() => signOut({ callbackUrl: "/" })}
    >
      <LogOut className="h-4 w-4" />
      Cerrar sesión
    </Button>
  );
}
