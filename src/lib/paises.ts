// Catálogo de países para ubicación de usuaria (ver
// docs/superpowers/specs/2026-08-14-ciudad-pais-usuaria-design.md).
//
// CRITICO: esta lista se escribe A MANO, curada, no se deriva en runtime
// iterando AA-ZZ contra Intl.DisplayNames. Se verificó que ese enfoque
// devuelve 280 entradas e incluye cosas que NO son países: EU (Unión
// Europea), EZ (zona del euro), UN (Naciones Unidas), QO (Territorios
// alejados de Oceanía), ZZ (Región desconocida), XA (Pseudoacentos), XB
// (Pseudobidi), AC/CP/DG/IC/TA (territorios sin ISO 3166-1 propio que CLDR
// igual traduce), más una decena de códigos obsoletos que ISO ya retiró
// (AN, BU, CS, DD, FX, HV, NH, RH, SU, TP, UK, VD, YD, YU, ZR). Nadie vive
// en Pseudoacentos. Intl.DisplayNames SOLO traduce código -> nombre; qué
// códigos son países reales es un dato de negocio que se cura acá.
//
// Sigue el precedente de src/lib/genres.ts: constante fija, 'as const'.
export const CODIGOS_PAIS = [
  "AD", "AE", "AF", "AG", "AI", "AL", "AM", "AO", "AQ", "AR", "AS", "AT", "AU", "AW", "AX", "AZ",
  "BA", "BB", "BD", "BE", "BF", "BG", "BH", "BI", "BJ", "BL", "BM", "BN", "BO", "BQ", "BR", "BS",
  "BT", "BV", "BW", "BY", "BZ",
  "CA", "CC", "CD", "CF", "CG", "CH", "CI", "CK", "CL", "CM", "CN", "CO", "CR", "CU", "CV", "CW",
  "CX", "CY", "CZ",
  "DE", "DJ", "DK", "DM", "DO", "DZ",
  "EC", "EE", "EG", "EH", "ER", "ES", "ET",
  "FI", "FJ", "FK", "FM", "FO", "FR",
  "GA", "GB", "GD", "GE", "GF", "GG", "GH", "GI", "GL", "GM", "GN", "GP", "GQ", "GR", "GS", "GT",
  "GU", "GW", "GY",
  "HK", "HM", "HN", "HR", "HT", "HU",
  "ID", "IE", "IL", "IM", "IN", "IO", "IQ", "IR", "IS", "IT",
  "JE", "JM", "JO", "JP",
  "KE", "KG", "KH", "KI", "KM", "KN", "KP", "KR", "KW", "KY", "KZ",
  "LA", "LB", "LC", "LI", "LK", "LR", "LS", "LT", "LU", "LV", "LY",
  "MA", "MC", "MD", "ME", "MF", "MG", "MH", "MK", "ML", "MM", "MN", "MO", "MP", "MQ", "MR", "MS",
  "MT", "MU", "MV", "MW", "MX", "MY", "MZ",
  "NA", "NC", "NE", "NF", "NG", "NI", "NL", "NO", "NP", "NR", "NU", "NZ",
  "OM",
  "PA", "PE", "PF", "PG", "PH", "PK", "PL", "PM", "PN", "PR", "PS", "PT", "PW", "PY",
  "QA",
  "RE", "RO", "RS", "RU", "RW",
  "SA", "SB", "SC", "SD", "SE", "SG", "SH", "SI", "SJ", "SK", "SL", "SM", "SN", "SO", "SR", "SS",
  "ST", "SV", "SX", "SY", "SZ",
  "TC", "TD", "TF", "TG", "TH", "TJ", "TK", "TL", "TM", "TN", "TO", "TR", "TT", "TV", "TW", "TZ",
  "UA", "UG", "UM", "US", "UY", "UZ",
  "VA", "VC", "VE", "VG", "VI", "VN", "VU",
  "WF", "WS",
  "YE", "YT",
  "ZA", "ZM", "ZW",
] as const;

export type CodigoPais = (typeof CODIGOS_PAIS)[number];

const CODIGOS_SET = new Set<string>(CODIGOS_PAIS);

/** Type guard: valida contra la lista curada, no contra lo que Intl.DisplayNames sepa traducir. */
export function esCodigoPais(v: unknown): v is CodigoPais {
  return typeof v === "string" && CODIGOS_SET.has(v);
}

// new Intl.DisplayNames(['es'], { type: 'region' }) está verificado en
// node:20-alpine (la imagen de producción, ver Dockerfile): la imagen trae
// ICU completo y devuelve "Perú", "Argentina", etc. correctamente.
const TRADUCTOR_PAISES = new Intl.DisplayNames(["es"], { type: "region" });

/** Traduce un código a su nombre en español. null si no está en CODIGOS_PAIS (nunca lanza). */
export function nombrePais(codigo: string): string | null {
  if (!esCodigoPais(codigo)) return null;
  return TRADUCTOR_PAISES.of(codigo) ?? null;
}

/**
 * Perú primero, resto alfabético por nombre en español (localeCompare,
 * locale 'es'). El club es peruano: pedirle a la usuaria que baje hasta la
 * P para el caso del 90% es fricción gratis.
 */
export function paisesOrdenados(): { codigo: CodigoPais; nombre: string }[] {
  const PERU: CodigoPais = "PE";
  const nombrePeru = nombrePais(PERU) ?? PERU;

  const resto = CODIGOS_PAIS.filter((codigo) => codigo !== PERU)
    .map((codigo) => ({ codigo, nombre: nombrePais(codigo) ?? codigo }))
    .sort((a, b) => a.nombre.localeCompare(b.nombre, "es"));

  return [{ codigo: PERU, nombre: nombrePeru }, ...resto];
}
