import { Moon, BookOpen, MessageCircle, CalendarDays, type LucideIcon } from "lucide-react";

import { routes } from "@/lib/routes";

/**
 * Lógica pura de BottomTabBar (src/components/bottom-tab-bar.tsx), extraída acá
 * porque vitest no puede parsear JSX de un .tsx (tsconfig usa "jsx": "preserve",
 * pensado para el compilador de Next, no para el transform de esbuild/vite).
 * El componente importa este módulo; el JSX queda sin test y está bien.
 */

export type BottomTabKey = "hoy" | "leer" | "club" | "agenda" | "perfil";

export interface BottomTabItem {
  key: BottomTabKey;
  href: string;
  label: string;
  /** undefined solo para "perfil": ese tab renderiza el avatar real, no un icono lucide. */
  icon?: LucideIcon;
}

/**
 * Activo si el pathname es exactamente la ruta del tab, o una subruta anidada.
 * El límite de "/" evita falsos positivos como "/reuniones-viejas" contra "/reuniones".
 */
export function isBottomTabActive(pathname: string, href: string): boolean {
  return pathname === href || pathname.startsWith(`${href}/`);
}

export function getBottomTabItems(): BottomTabItem[] {
  return [
    { key: "hoy", href: routes.hoy(), label: "Hoy", icon: Moon },
    { key: "leer", href: routes.leer(), label: "Leer", icon: BookOpen },
    { key: "club", href: routes.club(), label: "Club", icon: MessageCircle },
    { key: "agenda", href: routes.agenda(), label: "Agenda", icon: CalendarDays },
    { key: "perfil", href: routes.perfil(), label: "Perfil" },
  ];
}
