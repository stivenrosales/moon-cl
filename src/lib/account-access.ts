import { isModeratorOrAbove } from "@/lib/permissions";
import type { Role } from "@prisma/client";

export type AccountAccessKey = "apariencia" | "admin" | "cerrar-sesion";

export interface AccountAccessItem {
  key: AccountAccessKey;
  label: string;
  visible: boolean;
}

/**
 * Los accesos de cuenta que SIEMPRE deben existir en algún lugar alcanzable
 * por el usuario: apariencia, panel admin (gateado por rol) y cerrar sesión.
 *
 * src/app/(app)/perfil/page.tsx consume esta lista porque es la única
 * pantalla garantizada en <768px — el dropdown de escritorio en nav.tsx es
 * redundante, no la única puerta. Si mañana se agrega, quita o regatea un
 * acceso de cuenta, este es el único lugar a tocar: la página y sus tests
 * derivan de esta fuente única en vez de reimplementar la regla.
 */
export function getAccountAccessItems(role?: Role | null): AccountAccessItem[] {
  return [
    { key: "apariencia", label: "Apariencia", visible: true },
    { key: "admin", label: "Herramientas del club", visible: isModeratorOrAbove(role) },
    { key: "cerrar-sesion", label: "Cerrar sesión", visible: true },
  ];
}
