import { describe, expect, it } from "vitest";
import { camposUbicacion, construirUbicacion, slugCiudad } from "./ubicacion";

describe("slugCiudad", () => {
  it("quita tildes y recorta espacios de los extremos", () => {
    expect(slugCiudad("  Bogotá ")).toBe("bogota");
  });

  it("colapsa el espacio entre palabras en un guion", () => {
    expect(slugCiudad("San Isidro")).toBe("san-isidro");
  });

  it("pasa a minusculas una ciudad escrita en mayusculas", () => {
    expect(slugCiudad("CUSCO")).toBe("cusco");
  });

  it("devuelve null si la entrada es solo espacios", () => {
    expect(slugCiudad("   ")).toBeNull();
  });

  it("devuelve null para cadena vacia", () => {
    expect(slugCiudad("")).toBeNull();
  });

  it("devuelve null para null", () => {
    expect(slugCiudad(null)).toBeNull();
  });

  it("devuelve null para undefined", () => {
    expect(slugCiudad(undefined)).toBeNull();
  });

  it("descarta puntuacion sin dejar huecos en el slug", () => {
    expect(slugCiudad("Ciudad de México!!!")).toBe("ciudad-de-mexico");
  });

  it("colapsa varios espacios seguidos en un solo guion", () => {
    expect(slugCiudad("San    Isidro")).toBe("san-isidro");
  });

  it("recorta guiones que quedan en los extremos tras normalizar", () => {
    expect(slugCiudad(" -Lima- ")).toBe("lima");
  });

  it("colapsa guiones consecutivos que resultan de mezclar espacio y guion literal", () => {
    expect(slugCiudad("San - Isidro")).toBe("san-isidro");
  });
});

describe("construirUbicacion", () => {
  it("sin countryCode devuelve sin-ubicacion, sin importar la ciudad", () => {
    expect(construirUbicacion({ city: "Lima" })).toEqual({ tipo: "sin-ubicacion" });
  });

  it("countryCode vacio o solo espacios tambien devuelve sin-ubicacion", () => {
    expect(construirUbicacion({ countryCode: "   ", city: "Lima" })).toEqual({
      tipo: "sin-ubicacion",
    });
  });

  it("countryCode sin ciudad devuelve solo-pais", () => {
    expect(construirUbicacion({ countryCode: "PE" })).toEqual({
      tipo: "solo-pais",
      countryCode: "PE",
    });
  });

  it("countryCode con ciudad vacia (solo espacios) devuelve solo-pais, no completa", () => {
    expect(construirUbicacion({ countryCode: "PE", city: "   " })).toEqual({
      tipo: "solo-pais",
      countryCode: "PE",
    });
  });

  it("countryCode y ciudad validos devuelven completa con el slug derivado", () => {
    expect(construirUbicacion({ countryCode: "PE", city: "Lima" })).toEqual({
      tipo: "completa",
      countryCode: "PE",
      city: "Lima",
      citySlug: "lima",
    });
  });

  it("normaliza countryCode a mayusculas", () => {
    expect(construirUbicacion({ countryCode: "pe", city: "Lima" })).toEqual({
      tipo: "completa",
      countryCode: "PE",
      city: "Lima",
      citySlug: "lima",
    });
  });

  it("preserva la ciudad tal como la escribio, con tildes, no el slug", () => {
    const ubicacion = construirUbicacion({ countryCode: "CO", city: "  Bogotá  " });
    expect(ubicacion).toEqual({
      tipo: "completa",
      countryCode: "CO",
      city: "Bogotá",
      citySlug: "bogota",
    });
  });
});

describe("camposUbicacion", () => {
  it("sin-ubicacion produce los tres campos en null", () => {
    expect(camposUbicacion({ tipo: "sin-ubicacion" })).toEqual({
      countryCode: null,
      city: null,
      citySlug: null,
    });
  });

  it("solo-pais produce countryCode y deja city/citySlug en null", () => {
    expect(camposUbicacion({ tipo: "solo-pais", countryCode: "PE" })).toEqual({
      countryCode: "PE",
      city: null,
      citySlug: null,
    });
  });

  it("completa produce los tres campos con sus valores", () => {
    expect(
      camposUbicacion({ tipo: "completa", countryCode: "PE", city: "Lima", citySlug: "lima" }),
    ).toEqual({ countryCode: "PE", city: "Lima", citySlug: "lima" });
  });

  it("invariante: nunca devuelve city sin citySlug", () => {
    const estados: Parameters<typeof camposUbicacion>[0][] = [
      { tipo: "sin-ubicacion" },
      { tipo: "solo-pais", countryCode: "PE" },
      { tipo: "completa", countryCode: "PE", city: "Lima", citySlug: "lima" },
    ];
    for (const estado of estados) {
      const campos = camposUbicacion(estado);
      expect(campos.city === null).toBe(campos.citySlug === null);
    }
  });

  it("invariante: nunca devuelve una ciudad (city o citySlug) sin countryCode", () => {
    const estados: Parameters<typeof camposUbicacion>[0][] = [
      { tipo: "sin-ubicacion" },
      { tipo: "solo-pais", countryCode: "PE" },
      { tipo: "completa", countryCode: "PE", city: "Lima", citySlug: "lima" },
    ];
    for (const estado of estados) {
      const campos = camposUbicacion(estado);
      if (campos.city !== null || campos.citySlug !== null) {
        expect(campos.countryCode).not.toBeNull();
      }
    }
  });
});
