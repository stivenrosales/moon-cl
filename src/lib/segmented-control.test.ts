import { describe, it, expect } from "vitest";

import { alineacionSegmento, resolverSegmentoActivo } from "./segmented-control";

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

describe("alineacionSegmento", () => {
  it("alinea el primer segmento a la izquierda (start)", () => {
    expect(alineacionSegmento(0, 2)).toBe("start");
    expect(alineacionSegmento(0, 3)).toBe("start");
  });

  it("alinea el último segmento a la derecha (end)", () => {
    expect(alineacionSegmento(1, 2)).toBe("end");
    expect(alineacionSegmento(2, 3)).toBe("end");
  });

  it("centra los segmentos intermedios de una tupla de 3", () => {
    expect(alineacionSegmento(1, 3)).toBe("center");
  });
});
