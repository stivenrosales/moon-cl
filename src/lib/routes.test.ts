import { describe, it, expect } from "vitest";

import { routes } from "./routes";

describe("routes", () => {
  describe("hoy", () => {
    it("apunta a /hoy", () => {
      expect(routes.hoy()).toBe("/hoy");
    });
  });

  describe("leer", () => {
    it("sin argumentos devuelve el path de mi biblioteca", () => {
      expect(routes.leer()).toBe("/leer");
    });

    it("con objeto vacío devuelve el mismo path", () => {
      expect(routes.leer({})).toBe("/leer");
    });

    it("con vista mios devuelve mi biblioteca", () => {
      expect(routes.leer({ vista: "mios" })).toBe("/leer");
    });

    it("con vista club devuelve la biblioteca del club", () => {
      expect(routes.leer({ vista: "club" })).toBe("/leer?vista=club");
    });
  });

  describe("libro", () => {
    it("arma el path con el id", () => {
      expect(routes.libro("abc123")).toBe("/leer/libro/abc123");
    });
  });

  describe("club", () => {
    it("sin argumentos devuelve club sin query", () => {
      expect(routes.club()).toBe("/club");
    });

    it("con objeto vacío devuelve club sin query", () => {
      expect(routes.club({})).toBe("/club");
    });

    it("con vista actividad devuelve club sin query (es el default)", () => {
      expect(routes.club({ vista: "actividad" })).toBe("/club");
    });

    it("con vista personas devuelve la query de personas", () => {
      expect(routes.club({ vista: "personas" })).toBe("/club?vista=personas");
    });

    it("con vista frases devuelve la query de frases", () => {
      expect(routes.club({ vista: "frases" })).toBe("/club?vista=frases");
    });
  });

  describe("mensajes", () => {
    it("apunta a la bandeja", () => {
      expect(routes.mensajes()).toBe("/club/mensajes");
    });
  });

  describe("mensajeCon", () => {
    it("arma el path con el userId", () => {
      expect(routes.mensajeCon("user-1")).toBe("/club/mensajes/user-1");
    });
  });

  describe("persona", () => {
    it("arma el path del perfil ajeno", () => {
      expect(routes.persona("user-2")).toBe("/club/persona/user-2");
    });
  });

  describe("agenda", () => {
    it("sin argumentos devuelve reuniones", () => {
      expect(routes.agenda()).toBe("/agenda");
    });

    it("con objeto vacío devuelve reuniones", () => {
      expect(routes.agenda({})).toBe("/agenda");
    });

    it("con vista reuniones devuelve agenda sin query (es el default)", () => {
      expect(routes.agenda({ vista: "reuniones" })).toBe("/agenda");
    });

    it("con vista votaciones devuelve la query de votaciones", () => {
      expect(routes.agenda({ vista: "votaciones" })).toBe("/agenda?vista=votaciones");
    });

    it("con vista trivia devuelve la query de trivia", () => {
      expect(routes.agenda({ vista: "trivia" })).toBe("/agenda?vista=trivia");
    });
  });

  describe("reunion", () => {
    it("arma el path con el id", () => {
      expect(routes.reunion("r1")).toBe("/agenda/reunion/r1");
    });
  });

  describe("ronda", () => {
    it("arma el path con el id", () => {
      expect(routes.ronda("ronda-9")).toBe("/agenda/ronda/ronda-9");
    });
  });

  describe("perfil", () => {
    it("apunta al perfil propio", () => {
      expect(routes.perfil()).toBe("/perfil");
    });
  });

  describe("admin", () => {
    it("sin ancla devuelve el panel pelado", () => {
      expect(routes.admin()).toBe("/admin");
    });

    it("con ancla reportes devuelve el fragmento", () => {
      expect(routes.admin("reportes")).toBe("/admin#reportes");
    });

    it("con ancla rondas devuelve el fragmento", () => {
      expect(routes.admin("rondas")).toBe("/admin#rondas");
    });

    it("con ancla vacía no agrega el numeral", () => {
      expect(routes.admin("")).toBe("/admin");
    });
  });

  describe("onboarding", () => {
    it("apunta al onboarding", () => {
      expect(routes.onboarding()).toBe("/onboarding");
    });
  });

  describe("login", () => {
    it("apunta al login", () => {
      expect(routes.login()).toBe("/login");
    });
  });

  describe("contrato de revalidatePath", () => {
    it("los builders con vista no emiten query cuando se llaman sin argumentos", () => {
      // revalidatePath necesita un path pelado: "/leer?vista=club" no invalida "/leer".
      for (const path of [routes.leer(), routes.club(), routes.agenda()]) {
        expect(path).not.toContain("?");
        expect(path).not.toContain("#");
      }
    });
  });
});
