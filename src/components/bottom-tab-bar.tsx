"use client";

import * as React from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";

import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { getBottomTabItems, isBottomTabActive } from "@/lib/bottom-tabs";
import { cn, getInitials } from "@/lib/utils";

export interface BottomTabBarProps {
  user: {
    name?: string | null;
    email?: string | null;
    image?: string | null;
  };
}

export function BottomTabBar({ user }: BottomTabBarProps) {
  const pathname = usePathname();
  const tabs = getBottomTabItems();

  return (
    <nav
      aria-label="Navegación principal"
      className="fixed inset-x-0 bottom-0 z-40 box-content flex h-14 border-t border-border/60 bg-background/85 pb-[env(safe-area-inset-bottom)] backdrop-blur-xl md:hidden"
    >
      {tabs.map((tab) => {
        const active = isBottomTabActive(pathname, tab.href);
        const Icon = tab.icon;

        return (
          <Link
            key={tab.key}
            href={tab.href}
            aria-current={active ? "page" : undefined}
            className="focus-ring flex flex-1 flex-col items-center justify-center gap-[3px]"
          >
            {tab.key === "perfil" ? (
              <Avatar
                className={cn(
                  "h-6 w-6 ring-1 ring-border",
                  active && "ring-2 ring-primary",
                )}
              >
                {user.image ? <AvatarImage src={user.image} alt="" /> : null}
                <AvatarFallback className="text-[9px]">
                  {getInitials(user.name, user.email)}
                </AvatarFallback>
              </Avatar>
            ) : Icon ? (
              <Icon
                className={cn(
                  "h-[22px] w-[22px] transition-colors duration-150",
                  active ? "text-primary" : "text-muted-foreground",
                )}
              />
            ) : null}
            <span
              className={cn(
                "font-sans text-[10px] leading-none transition-colors duration-150",
                active ? "text-foreground" : "text-muted-foreground",
              )}
            >
              {tab.label}
            </span>
          </Link>
        );
      })}
    </nav>
  );
}
