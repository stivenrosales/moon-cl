"use client";

import * as React from "react";
import { Tabs } from "@/components/ui/tabs";

const GoToTabContext = React.createContext<((value: string) => void) | null>(null);

/**
 * Permite que un descendiente (p. ej. la tarjeta de avance dentro de
 * CommentsSection) salte a otra pestaña de la página del libro sin acoplar
 * el Server Component de la página al estado de las tabs. Devuelve `null`
 * si no hay provider por encima (fuera de contexto).
 */
export function useGoToBookTab() {
  return React.useContext(GoToTabContext);
}

/**
 * Envuelve <Tabs> volviéndolo controlado, exponiendo `goTo(value)` vía
 * contexto para que hijos client component (aunque su JSX se haya
 * construido en el Server Component padre) puedan cambiar de pestaña.
 */
export function BookTabsProvider({
  defaultValue,
  children,
}: {
  defaultValue: string;
  children: React.ReactNode;
}) {
  const [value, setValue] = React.useState(defaultValue);

  return (
    <GoToTabContext.Provider value={setValue}>
      <Tabs value={value} onValueChange={setValue}>
        {children}
      </Tabs>
    </GoToTabContext.Provider>
  );
}
