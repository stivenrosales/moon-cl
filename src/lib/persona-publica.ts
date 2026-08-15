import { getInitials } from "@/lib/utils";
import { construirUbicacion } from "@/lib/ubicacion";
import { nombrePais } from "@/lib/paises";

// ─────────────────────────────────────────────────────────────────────────
// Frontera entre lo que el servidor SABE de una socia y lo que puede viajar
// al navegador.
//
// El bug que esto arregla: /club?vista=personas mandaba el `email` de TODAS
// las usuarias a <MemberList>, que es un Client Component. Todo lo que
// recibe un Client Component queda embebido en el payload RSC y por lo tanto
// en el HTML: cualquier socia con sesión abría el inspector y se llevaba el
// directorio de correos completo del club. Lo mismo pasaba en la card de
// Book Match y en las sugerencias de una ronda.
//
// El criterio es el mismo de gateComment() (services/comment-gating.ts): lo
// que el cliente no debe ver NO SALE del servidor. Ocultarlo en la UI no
// sirve — el dato viaja igual.
//
// Por eso el cliente recibe lo DERIVADO (nombre visible, iniciales), nunca
// la materia prima. Si aparece una pantalla nueva que necesita algo más del
// correo, se calcula acá y se agrega a PersonaPublica; el correo se queda.
// ─────────────────────────────────────────────────────────────────────────

/** Fila de usuaria tal como sale de Prisma. Solo para uso en el servidor. */
export interface PersonaConCorreo {
  id: string;
  name: string | null;
  email: string | null;
  image: string | null;
  /**
   * Opcionales: no todas las llamadas seleccionan ubicación (p. ej. la
   * pareja de Book Match o la autora de una frase no la necesitan). Ausentes
   * equivale a "sin ubicación", el mismo resultado que countryCode: null.
   */
  countryCode?: string | null;
  city?: string | null;
}

/** Lo único de una socia ajena que puede cruzar hacia el cliente. */
export interface PersonaPublica {
  id: string;
  /**
   * Nombre ya resuelto en el servidor. `null` = no hay ninguno (ni nombre ni
   * correo): cada pantalla decide su propio texto de reemplazo, porque no es
   * el mismo en la fila del directorio que en la card de Book Match.
   */
  nombre: string | null;
  /** Iniciales del avatar, ya resueltas: el cliente no puede calcularlas sin el correo. */
  iniciales: string;
  image: string | null;
  /** Ciudad tal como la escribió ella, con tildes. Nunca el slug (es interno). */
  ciudad: string | null;
  /** País ya traducido en el servidor ("Perú"), nunca el código ISO ("PE"). */
  pais: string | null;
  /**
   * Prohibición explícita, no un campo. Construir la persona campo por campo
   * no alcanza: `{ ...u, ...aPersonaPublica(u) }` vuelve a colar el correo y
   * TypeScript lo deja pasar, porque a las propiedades que vienen de un
   * spread no les aplica el chequeo de propiedades de más. Se comprobó: con
   * ese spread, `tsc` y el test de frontera daban los dos en verde mientras
   * /club publicaba el directorio de correos del club.
   *
   * Declarándolo `never`, un objeto que traiga `email: string | null` deja de
   * ser asignable y el error salta en el gate de tipos, que es donde tiene
   * que saltar.
   */
  email?: never;
}

/**
 * El nombre que la UI ya venía mostrando: el nombre propio, y si no hay, el
 * usuario del correo (nunca el dominio — eso sí es el correo).
 *
 * Un nombre en blanco cuenta como ausente, mismo criterio que getInitials():
 * antes las iniciales caían al correo mientras la fila pintaba un nombre
 * vacío, y quedaban contradiciéndose.
 */
export function nombreVisible(name: string | null, email: string | null): string | null {
  return name?.trim() || email?.split("@")[0] || null;
}

/**
 * Construida campo por campo a propósito: con `...u` el correo se colaba de
 * vuelta sin que nadie lo notara, que es exactamente el bug original.
 *
 * ciudad/pais se derivan con construirUbicacion(): reusa la misma invariante
 * de src/lib/ubicacion.ts (ciudad sin país es imposible de escribir) en vez
 * de confiar en que u.city y u.countryCode ya lleguen consistentes.
 */
export function aPersonaPublica(u: PersonaConCorreo): PersonaPublica {
  const ubicacion = construirUbicacion({ countryCode: u.countryCode, city: u.city });
  const pais = ubicacion.tipo === "sin-ubicacion" ? null : nombrePais(ubicacion.countryCode);
  const ciudad = ubicacion.tipo === "completa" ? ubicacion.city : null;

  return {
    id: u.id,
    nombre: nombreVisible(u.name, u.email),
    iniciales: getInitials(u.name, u.email),
    image: u.image,
    ciudad,
    pais,
  };
}
