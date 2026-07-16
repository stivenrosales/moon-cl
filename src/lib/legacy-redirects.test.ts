import { describe, it, expect } from "vitest";

import { getLegacyRedirects } from "./legacy-redirects";

describe("getLegacyRedirects", () => {
  const rules = getLegacyRedirects();

  it("expone exactamente las 14 rutas viejas del contrato", () => {
    expect(rules).toHaveLength(14);
  });

  it("usa 307 (permanent: false) en todas, jamás 308", () => {
    // 308 lo cachea el navegador para siempre; si la hipótesis de IA sale
    // mal en Fase 4 no hay marcha atrás. 307 se promueve a 308 con datos.
    for (const rule of rules) {
      expect(rule.permanent).toBe(false);
    }
  });

  it("jamás incluye una regla para /perfil exacto", () => {
    // /perfil (sin id) no cambia de ruta: no debe redirigir a sí mismo.
    expect(rules.some((r) => r.source === "/perfil")).toBe(false);
  });

  it("jamás incluye una regla para /admin", () => {
    expect(rules.some((r) => r.source === "/admin")).toBe(false);
  });

  it("redirige las rutas estáticas del contrato", () => {
    const bySource = Object.fromEntries(rules.map((r) => [r.source, r.destination]));
    expect(bySource["/dashboard"]).toBe("/hoy");
    expect(bySource["/mi-biblioteca"]).toBe("/leer");
    expect(bySource["/biblioteca"]).toBe("/leer?vista=club");
    expect(bySource["/comunidad"]).toBe("/club");
    expect(bySource["/miembros"]).toBe("/club?vista=personas");
    expect(bySource["/mensajes"]).toBe("/club/mensajes");
    expect(bySource["/reuniones"]).toBe("/agenda");
    expect(bySource["/rondas"]).toBe("/agenda?vista=votaciones");
    expect(bySource["/puntajes"]).toBe("/agenda?vista=trivia");
  });

  it("redirige las rutas dinámicas del contrato preservando el parámetro", () => {
    const bySource = Object.fromEntries(rules.map((r) => [r.source, r.destination]));
    expect(bySource["/libros/:id"]).toBe("/leer/libro/:id");
    expect(bySource["/mensajes/:userId"]).toBe("/club/mensajes/:userId");
    expect(bySource["/perfil/:id"]).toBe("/club/persona/:id");
    expect(bySource["/reuniones/:id"]).toBe("/agenda/reunion/:id");
    expect(bySource["/rondas/:id"]).toBe("/agenda/ronda/:id");
  });

  it("ordena la regla estática antes que su hija dinámica (reuniones)", () => {
    const sources = rules.map((r) => r.source);
    expect(sources.indexOf("/reuniones")).toBeLessThan(sources.indexOf("/reuniones/:id"));
  });

  it("ordena la regla estática antes que su hija dinámica (rondas)", () => {
    const sources = rules.map((r) => r.source);
    expect(sources.indexOf("/rondas")).toBeLessThan(sources.indexOf("/rondas/:id"));
  });
});
