import { describe, it, expect } from "vitest";

import { calcularDimensiones } from "./image-optimizer";

describe("calcularDimensiones", () => {
  it("escala proporcionalmente cuando la imagen es más grande que el máximo", () => {
    expect(calcularDimensiones(1200, 800, 600)).toEqual({ ancho: 600, alto: 400 });
  });

  it("no agranda una imagen más chica que el máximo", () => {
    // agrandar solo agrega peso sin agregar detalle real.
    expect(calcularDimensiones(300, 200, 600)).toEqual({ ancho: 300, alto: 200 });
  });

  it("no toca la imagen cuando el ancho es exactamente igual al máximo", () => {
    expect(calcularDimensiones(600, 400, 600)).toEqual({ ancho: 600, alto: 400 });
  });

  it("redondea el alto a enteros al escalar", () => {
    expect(calcularDimensiones(1000, 333, 600)).toEqual({ ancho: 600, alto: 200 });
  });

  it("nunca deja el alto en 0 para una imagen extremadamente apaisada", () => {
    // 1 de alto por cada 5000 de ancho: escalado directo redondearía a 0.
    expect(calcularDimensiones(5000, 1, 600)).toEqual({ ancho: 600, alto: 1 });
  });

  it("devuelve 1x1 cuando el ancho original es 0", () => {
    // Caso degenerado que no debería ocurrir con un bitmap real, pero la
    // función es pura y no debe propagar NaN.
    expect(calcularDimensiones(0, 400, 600)).toEqual({ ancho: 1, alto: 1 });
  });

  it("devuelve 1x1 cuando el alto original es negativo", () => {
    expect(calcularDimensiones(400, -10, 600)).toEqual({ ancho: 1, alto: 1 });
  });

  it("devuelve 1x1 cuando el ancho original es NaN", () => {
    expect(calcularDimensiones(NaN, 400, 600)).toEqual({ ancho: 1, alto: 1 });
  });

  it("ignora un ancho máximo inválido y devuelve la imagen original", () => {
    // un máximo en 0, negativo o NaN no es un límite utilizable: se trata
    // como "sin límite".
    expect(calcularDimensiones(1200, 800, 0)).toEqual({ ancho: 1200, alto: 800 });
    expect(calcularDimensiones(1200, 800, -600)).toEqual({ ancho: 1200, alto: 800 });
    expect(calcularDimensiones(1200, 800, NaN)).toEqual({ ancho: 1200, alto: 800 });
  });
});
