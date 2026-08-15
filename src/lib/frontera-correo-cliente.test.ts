import { readdirSync, readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { describe, expect, it } from "vitest";

// ─────────────────────────────────────────────────────────────────────────
// El guardián del leak de correos.
//
// persona-publica.test.ts prueba que el HELPER no filtra. Esto prueba que
// los CALL SITES lo usen, que es otra cosa muy distinta: el suite estuvo
// verde con diez tests del helper mientras /club?vista=frases seguía
// publicando el directorio de correos completo del club. Un test del
// helper no es un test del sistema.
//
// La regla que se defiende: todo lo que recibe un Client Component queda
// embebido en el payload RSC y por lo tanto en el HTML servido. No hace
// falta ser admin ni tener sesión de moderadora — se abre el inspector y
// ahí está. Mismo criterio que gateComment() (services/comment-gating.ts):
// lo que el cliente no debe ver NO SALE del servidor.
//
// Por eso el chequeo es sobre el CÓDIGO FUENTE y no sobre un objeto de
// prueba: no hay forma de instanciar "todas las pantallas" en un test de
// Node (Vitest ni siquiera parsea JSX en este repo), pero sí de leer los
// archivos y exigir que ninguno declare la puerta por donde entró el bug.
//
// El patrón es a propósito grueso — la palabra "email" en cualquier parte
// del archivo, no una gramática fina de tipos. `userEmail`, `emailAddress`
// o un `email:` en un objeto literal filtran exactamente igual que un
// `email: string | null` en las props, y un guardián que solo entiende una
// de las formas es un guardián que se puede rodear sin querer.
// ─────────────────────────────────────────────────────────────────────────

const SRC = fileURLToPath(new URL("..", import.meta.url));

/**
 * Únicas excepciones: componentes que reciben el correo PROPIO de quien
 * mira. Verse el correo de una misma en su propia pantalla no es un leak;
 * el leak es verse el de las demás.
 *
 * Cada entrada vive acá con su justificación o se borra. Si agregas una,
 * escribe POR QUÉ el correo que entra es el de la sesión — no alcanza con
 * "es una pantalla de admin": reports-panel.tsx y kahoot-scores-form.tsx
 * eran solo-admin y estaban igual de mal.
 */
const EXCEPCIONES: Record<string, string> = {
  "components/nav.tsx":
    "Menú de usuario: (app)/layout.tsx le pasa session.user, o sea el correo de quien mira.",
  "components/bottom-tab-bar.tsx":
    "El mismo session.user que Nav, y solo para las iniciales del avatar propio.",
  "components/profile-edit-dialog.tsx":
    "Edición del perfil propio: /perfil le pasa la fila de la usuaria con sesión.",
};

/**
 * Muestra de control. Si el escaneo se rompe (cambia una ruta, se mueve
 * una carpeta) devolvería una lista vacía y TODOS los demás tests pasarían
 * sin mirar nada. Un guardián que no encuentra nada que vigilar tiene que
 * fallar, no aprobar.
 */
const CLIENTES_ESPERADOS = [
  "components/quote-card.tsx",
  "components/comments-section.tsx",
  "components/member-list.tsx",
  "components/admin/reports-panel.tsx",
  "app/(app)/club/quotes-panel.tsx",
];

function archivosFuente(dir: string): string[] {
  const salida: string[] = [];
  for (const entrada of readdirSync(dir, { withFileTypes: true })) {
    const completo = path.join(dir, entrada.name);
    if (entrada.isDirectory()) {
      salida.push(...archivosFuente(completo));
    } else if (/\.tsx?$/.test(entrada.name)) {
      salida.push(completo);
    }
  }
  return salida;
}

/**
 * La directiva solo cuenta si es lo primero del archivo (después de
 * comentarios): un "use client" citado dentro de un comentario no vuelve
 * cliente a nadie, y contarlo llenaría el guardián de ruido.
 */
function esClientComponent(fuente: string): boolean {
  const sinComentariosIniciales = fuente.replace(
    /^(?:\s*(?:\/\/[^\n]*\n|\/\*[\s\S]*?\*\/))*/,
    "",
  );
  return /^\s*['"]use client['"]/.test(sinComentariosIniciales);
}

function lineasQueMencionanCorreo(fuente: string): { n: number; texto: string }[] {
  return fuente
    .split("\n")
    .map((texto, i) => ({ n: i + 1, texto }))
    .filter((l) => /email/i.test(l.texto));
}

interface ClientComponent {
  ruta: string;
  fuente: string;
}

const clientes: ClientComponent[] = archivosFuente(SRC)
  .map((completo) => ({
    ruta: path.relative(SRC, completo).split(path.sep).join("/"),
    fuente: readFileSync(completo, "utf8"),
  }))
  .filter((archivo) => esClientComponent(archivo.fuente))
  .sort((a, b) => a.ruta.localeCompare(b.ruta));

describe("frontera del correo hacia el cliente", () => {
  it("el escaneo encuentra los Client Components del repo — sin esto los demás tests pasan en falso", () => {
    expect(clientes.length).toBeGreaterThan(20);
    const rutas = clientes.map((c) => c.ruta);
    for (const esperado of CLIENTES_ESPERADOS) {
      expect(rutas).toContain(esperado);
    }
  });

  it("ningún Client Component menciona el correo, salvo los de la lista justificada", () => {
    const infractores = clientes
      .filter((c) => !(c.ruta in EXCEPCIONES))
      .flatMap((c) =>
        lineasQueMencionanCorreo(c.fuente).map(
          (l) => `${c.ruta}:${l.n}  ${l.texto.trim()}`,
        ),
      );

    // Si esto sale en rojo: el correo NO se arregla ocultándolo en la UI
    // (el dato viaja igual en el HTML). Se arregla mandando lo derivado
    // desde el servidor con aPersonaPublica() — nombre visible e iniciales
    // ya resueltos — y dejando el correo en el servidor.
    expect(infractores).toEqual([]);
  });

  it("ningún Client Component importa PersonaConCorreo: ese tipo es solo de servidor", () => {
    // La otra puerta: tipar las props con PersonaConCorreo pasa el chequeo
    // de arriba (nunca se escribe la palabra "email") y filtra igual.
    const infractores = clientes
      .filter((c) => /\bPersonaConCorreo\b/.test(c.fuente))
      .map((c) => c.ruta);

    expect(infractores).toEqual([]);
  });

  it("la lista de excepciones no tiene entradas muertas", () => {
    // Una excepción que ya no aplica es una puerta abierta esperando a que
    // alguien vuelva a meter el correo por ahí sin que nadie se entere.
    const rutas = clientes.map((c) => c.ruta);
    for (const [ruta, motivo] of Object.entries(EXCEPCIONES)) {
      expect(motivo.length).toBeGreaterThan(20);
      expect(rutas, `${ruta} ya no es un Client Component: saca la excepción`).toContain(ruta);

      const cliente = clientes.find((c) => c.ruta === ruta)!;
      expect(
        lineasQueMencionanCorreo(cliente.fuente).length,
        `${ruta} ya no menciona el correo: saca la excepción`,
      ).toBeGreaterThan(0);
    }
  });
});
