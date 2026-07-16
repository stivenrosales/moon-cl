import { describe, it, expect } from "vitest";
import { Moon, BookOpen, MessageCircle, CalendarDays } from "lucide-react";

import { getBottomTabItems, isBottomTabActive } from "./bottom-tabs";
import { routes } from "./routes";

describe("isBottomTabActive", () => {
  it("es activo cuando el pathname es exactamente la ruta del tab", () => {
    expect(isBottomTabActive("/hoy", "/hoy")).toBe(true);
  });

  it("es activo cuando el pathname es una subruta anidada", () => {
    expect(isBottomTabActive("/agenda/reunion/r1", "/agenda")).toBe(true);
  });

  it("no es activo para una ruta completamente distinta", () => {
    expect(isBottomTabActive("/perfil", "/hoy")).toBe(false);
  });

  it("no es activo si el pathname solo comparte el prefijo sin límite de segmento", () => {
    // "/agenda-vieja" no es una subruta de "/agenda": falta el "/" de límite.
    expect(isBottomTabActive("/agenda-vieja", "/agenda")).toBe(false);
  });

  it("no es activo si el pathname es más corto que el href", () => {
    expect(isBottomTabActive("/agend", "/agenda")).toBe(false);
  });

  it("resuelve /club como activo contra el destino club", () => {
    expect(isBottomTabActive("/club", routes.club())).toBe(true);
  });

  it("resuelve /club/mensajes/abc como activo contra el destino club (subruta anidada)", () => {
    expect(isBottomTabActive("/club/mensajes/abc", routes.club())).toBe(true);
  });
});

describe("getBottomTabItems", () => {
  const tabs = getBottomTabItems();

  it("expone exactamente 5 tabs", () => {
    expect(tabs).toHaveLength(5);
  });

  it("respeta el orden hoy, leer, club, agenda, perfil", () => {
    expect(tabs.map((t) => t.key)).toEqual(["hoy", "leer", "club", "agenda", "perfil"]);
  });

  it("arma cada href con routes.ts, jamás con strings sueltos", () => {
    expect(tabs.map((t) => t.href)).toEqual([
      routes.hoy(),
      routes.leer(),
      routes.club(),
      routes.agenda(),
      routes.perfil(),
    ]);
  });

  it("usa los labels del contrato", () => {
    expect(tabs.map((t) => t.label)).toEqual(["Hoy", "Leer", "Club", "Agenda", "Perfil"]);
  });

  it("asigna el icono lucide correcto a cada tab, menos perfil que usa el avatar", () => {
    expect(tabs[0].icon).toBe(Moon);
    expect(tabs[1].icon).toBe(BookOpen);
    expect(tabs[2].icon).toBe(MessageCircle);
    expect(tabs[3].icon).toBe(CalendarDays);
    expect(tabs[4].icon).toBeUndefined();
  });
});
