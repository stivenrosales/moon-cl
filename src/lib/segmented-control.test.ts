import { describe, it, expect } from "vitest";

import { resolverSegmentoActivo } from "./segmented-control";

describe("resolverSegmentoActivo", () => {
  const dosSegmentos = [
    { valor: "mios", label: "Mis libros" },
    { valor: "club", label: "Del club" },
  ] as const;

  const tresSegmentos = [
    { valor: "reuniones", label: "Reuniones" },
    { valor: "votaciones", label: "Votaciones" },
    { valor: "trivia", label: "Trivia" },
  ] as const;

  it("devuelve el valor cuando coincide con el primer segmento", () => {
    expect(resolverSegmentoActivo(dosSegmentos, "mios")).toBe("mios");
  });

  it("devuelve el valor cuando coincide con el segundo segmento", () => {
    expect(resolverSegmentoActivo(dosSegmentos, "club")).toBe("club");
  });

  it("funciona con tuplas de 3 segmentos", () => {
    expect(resolverSegmentoActivo(tresSegmentos, "trivia")).toBe("trivia");
  });

  it("cae al primer segmento cuando el activo no coincide con ninguno", () => {
    // ej: el query param viene corrupto o manipulado a mano en la URL —
    // nunca debe quedar la navegación sin un segmento marcado como activo.
    expect(resolverSegmentoActivo(dosSegmentos, "inexistente")).toBe("mios");
  });

  it("cae al primer segmento cuando el activo viene vacío", () => {
    // ej: searchParams.vista es undefined y el caller pasa "" en vez de default.
    expect(resolverSegmentoActivo(dosSegmentos, "")).toBe("mios");
  });

  it("es sensible a mayúsculas: no normaliza el valor recibido", () => {
    expect(resolverSegmentoActivo(dosSegmentos, "Club")).toBe("mios");
  });
});
