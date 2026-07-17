import { routes } from "@/lib/routes";
import type { NudgeScreen } from "@/server/services/nudge-queue";

/**
 * Traduce el screen semántico de la invitación a la ruta real que hay que
 * revalidar. SIEMPRE un path pelado — nunca con query string ni fragmento
 * (ver el contrato de revalidatePath en routes.ts:5-8 y routes.test.ts).
 * revalidatePath("/club?vista=personas") NO invalida "/club": por eso
 * club-actividad y club-personas comparten el mismo path pelado /club,
 * igual que hace toggleMatchOptIn en server/actions/match.ts.
 *
 * Vive acá y no en server/actions/nudges.ts porque en un archivo "use server"
 * todo export debe ser una función async: exportar esta función síncrona desde
 * allá rompía el build de Next ("Server Actions must be async functions") sin
 * que vitest ni tsc lo notaran.
 */
export function pathForScreen(screen: NudgeScreen): string {
  switch (screen) {
    case "hoy":
      return routes.hoy();
    case "leer-mios":
      return routes.leer();
    case "club-actividad":
    case "club-personas":
      return routes.club();
  }
}
