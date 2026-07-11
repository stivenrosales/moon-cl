"use client";

import * as React from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { LogOut, BookOpen, Vote, Library, BookMarked, CalendarDays, User2, Shield, Home } from "lucide-react";
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
}

const links = [
  { href: "/dashboard", label: "Inicio", icon: BookOpen },
  { href: "/rondas", label: "Votación", icon: Vote },
  { href: "/biblioteca", label: "Biblioteca", icon: Library },
  { href: "/mi-biblioteca", label: "Mi biblioteca", icon: BookMarked },
  { href: "/reuniones", label: "Reuniones", icon: CalendarDays },
];

export function Nav({ user }: NavProps) {
  const pathname = usePathname();
  const isAdmin = user.role === "ADMIN" || user.role === "MODERATOR";
  const inAdmin = pathname === "/admin" || pathname.startsWith("/admin/");

  return (
    <header className="sticky top-0 z-30 border-b border-border/60 bg-background/70 backdrop-blur-xl">
      <div className="container flex h-16 items-center gap-6">
        <Link
          href="/dashboard"
          className="flex items-center gap-3 focus-ring rounded-md py-1"
          aria-label="Inicio Moon Club de Lectura"
        >
          <MoonLogo size={36} className="shrink-0" />
          <div className="hidden sm:flex flex-col leading-none">
            <span className="hand-script text-2xl text-foreground">Moon</span>
            <span className="text-[9px] uppercase tracking-[0.32em] text-muted-foreground -mt-0.5">
              Club de Lectura
            </span>
          </div>
        </Link>

        <nav className="ml-4 hidden md:flex items-center gap-1">
          {links.map(({ href, label, icon: Icon }) => {
            const active = pathname === href || pathname.startsWith(href + "/");
            return (
              <Link
                key={href}
                href={href}
                className={cn(
                  "inline-flex items-center gap-2 rounded-full px-3.5 py-2 text-sm transition-colors focus-ring",
                  active
                    ? "bg-primary/15 text-foreground"
                    : "text-muted-foreground hover:text-foreground hover:bg-muted/60",
                )}
              >
                <Icon className="h-4 w-4" />
                {label}
              </Link>
            );
          })}
        </nav>

        <div className="ml-auto flex items-center gap-2">
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
                <Link href="/perfil"><User2 className="h-4 w-4" /> Mi perfil</Link>
              </DropdownMenuItem>
              {isAdmin ? (
                inAdmin ? (
                  <DropdownMenuItem asChild>
                    <Link href="/dashboard"><Home className="h-4 w-4" /> Vista normal</Link>
                  </DropdownMenuItem>
                ) : (
                  <DropdownMenuItem asChild>
                    <Link href="/admin"><Shield className="h-4 w-4" /> Panel admin</Link>
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

      {/* Mobile nav */}
      <nav className="container -mt-1 flex md:hidden items-center gap-1.5 overflow-x-auto scrollbar-hide pb-2">
        {links.map(({ href, label, icon: Icon }) => {
          const active = pathname === href || pathname.startsWith(href + "/");
          return (
            <Link
              key={href}
              href={href}
              className={cn(
                "inline-flex shrink-0 items-center gap-1.5 rounded-full border px-3 py-2 text-xs transition-colors",
                active
                  ? "border-primary/50 bg-primary/15 text-foreground"
                  : "border-border text-muted-foreground hover:text-foreground",
              )}
            >
              <Icon className="h-3.5 w-3.5" />
              {label}
            </Link>
          );
        })}
      </nav>
    </header>
  );
}
