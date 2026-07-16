"use client";

import * as React from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { LogOut, User2, Shield, Home, Mail } from "lucide-react";
import { signOut } from "next-auth/react";
import { MoonLogo } from "@/components/moon-logo";
import { ThemeToggle } from "@/components/theme-toggle";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { getBottomTabItems, isBottomTabActive } from "@/lib/bottom-tabs";
import { routes } from "@/lib/routes";
import { cn, getInitials } from "@/lib/utils";
import type { Role } from "@prisma/client";

interface NavProps {
  user: {
    id: string;
    name?: string | null;
    email?: string | null;
    image?: string | null;
    role: Role;
  };
  unreadCount?: number;
}

/**
 * Los 4 destinos de escritorio son los mismos 4 primeros tabs de
 * BottomTabBar (src/lib/bottom-tabs.ts): una sola fuente de verdad para
 * "qué destinos existen" y "cuándo está activo uno", sin duplicar la
 * tabla. El 5º tab ("perfil") lo excluimos acá porque en escritorio no es
 * un link con icono: es el avatar con dropdown de la derecha.
 */
const desktopDestinations = getBottomTabItems().filter((tab) => tab.key !== "perfil");

export function Nav({ user, unreadCount = 0 }: NavProps) {
  const pathname = usePathname();
  const isAdmin = user.role === "ADMIN" || user.role === "MODERATOR";
  const inAdmin = pathname === "/admin" || pathname.startsWith("/admin/");
  const mensajesActive = isBottomTabActive(pathname, routes.mensajes());

  return (
    <header className="sticky top-0 z-30 border-b border-border/60 bg-background/70 backdrop-blur-xl">
      {/* Header móvil: 48px, solo logo + mensajes. El theme-toggle vive en
          /perfil y la navegación la da BottomTabBar (ver (app)/layout.tsx). */}
      <div className="flex h-12 items-center justify-between px-4 md:hidden">
        <Link
          href={routes.hoy()}
          className="flex items-center gap-2 rounded-md py-1 focus-ring"
          aria-label="Inicio Moon Club de Lectura"
        >
          <MoonLogo size={28} className="shrink-0" />
          <span className="hand-script text-xl text-foreground">Moon</span>
        </Link>

        <Link
          href={routes.mensajes()}
          aria-label={unreadCount > 0 ? `Mensajes, ${unreadCount} sin leer` : "Mensajes"}
          className={cn(
            "relative inline-flex h-10 w-10 items-center justify-center rounded-full transition-colors focus-ring",
            mensajesActive
              ? "bg-primary/15 text-foreground"
              : "text-muted-foreground hover:bg-muted/60 hover:text-foreground",
          )}
        >
          <Mail className="h-5 w-5" />
          {unreadCount > 0 ? (
            <span
              aria-hidden
              className="absolute right-1.5 top-1.5 h-2.5 w-2.5 rounded-full bg-accent ring-2 ring-background"
            />
          ) : null}
        </Link>
      </div>

      {/* Header de escritorio: logo + 4 destinos + mensajes/theme/avatar. */}
      <div className="container hidden h-16 items-center gap-6 md:flex">
        <Link
          href={routes.hoy()}
          className="flex items-center gap-3 rounded-md py-1 focus-ring"
          aria-label="Inicio Moon Club de Lectura"
        >
          <MoonLogo size={36} className="shrink-0" />
          <div className="hidden flex-col leading-none sm:flex">
            <span className="hand-script text-2xl text-foreground">Moon</span>
            <span className="-mt-0.5 text-[9px] uppercase tracking-[0.32em] text-muted-foreground">
              Club de Lectura
            </span>
          </div>
        </Link>

        <nav className="ml-4 flex items-center gap-1">
          {desktopDestinations.map(({ key, href, label, icon: Icon }) => {
            const active = isBottomTabActive(pathname, href);
            return (
              <Link
                key={key}
                href={href}
                className={cn(
                  "inline-flex items-center gap-2 rounded-full px-3.5 py-2 text-sm transition-colors focus-ring",
                  active
                    ? "bg-primary/15 text-foreground"
                    : "text-muted-foreground hover:bg-muted/60 hover:text-foreground",
                )}
              >
                {Icon ? <Icon className="h-4 w-4" /> : null}
                {label}
              </Link>
            );
          })}
        </nav>

        <div className="ml-auto flex items-center gap-2">
          <Link
            href={routes.mensajes()}
            aria-label={unreadCount > 0 ? `Mensajes, ${unreadCount} sin leer` : "Mensajes"}
            className={cn(
              "relative inline-flex h-10 w-10 items-center justify-center rounded-full transition-colors focus-ring",
              mensajesActive
                ? "bg-primary/15 text-foreground"
                : "text-muted-foreground hover:bg-muted/60 hover:text-foreground",
            )}
          >
            <Mail className="h-5 w-5" />
            {unreadCount > 0 ? (
              <span
                aria-hidden
                className="absolute right-1.5 top-1.5 h-2.5 w-2.5 rounded-full bg-accent ring-2 ring-background"
              />
            ) : null}
          </Link>
          <ThemeToggle />
          <DropdownMenu>
            <DropdownMenuTrigger className="rounded-full focus-ring" aria-label="Menú de usuario">
              <Avatar className="h-10 w-10">
                {user.image ? <AvatarImage src={user.image} alt={user.name ?? ""} /> : null}
                <AvatarFallback>{getInitials(user.name, user.email)}</AvatarFallback>
              </Avatar>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-56">
              <DropdownMenuLabel>
                <div className="flex flex-col gap-0.5 normal-case tracking-normal">
                  <span className="text-sm font-medium text-foreground">
                    {user.name ?? user.email}
                  </span>
                  <span className="text-xs text-muted-foreground">{user.email}</span>
                </div>
              </DropdownMenuLabel>
              <DropdownMenuSeparator />
              <DropdownMenuItem asChild>
                <Link href={routes.perfil()}>
                  <User2 className="h-4 w-4" /> Mi perfil
                </Link>
              </DropdownMenuItem>
              {isAdmin ? (
                inAdmin ? (
                  <DropdownMenuItem asChild>
                    <Link href={routes.hoy()}>
                      <Home className="h-4 w-4" /> Vista normal
                    </Link>
                  </DropdownMenuItem>
                ) : (
                  <DropdownMenuItem asChild>
                    <Link href={routes.admin()}>
                      <Shield className="h-4 w-4" /> Panel admin
                    </Link>
                  </DropdownMenuItem>
                )
              ) : null}
              <DropdownMenuSeparator />
              <DropdownMenuItem onSelect={() => signOut({ callbackUrl: "/" })}>
                <LogOut className="h-4 w-4" /> Cerrar sesión
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>
    </header>
  );
}
