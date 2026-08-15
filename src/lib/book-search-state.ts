import type { BookCandidate, BookSearchResult } from "@/lib/google-books";

/**
 * Estado de una búsqueda de libros en la UI. "Sin resultados" y "la
 * búsqueda falló" son estados DISTINTOS a propósito (ver BookSearchResult
 * en @/lib/google-books): antes un 429 de Google Books se mostraba igual
 * que "ese libro no existe". Un solo discriminated union en vez de
 * resultados/buscando/error sueltos evita que se puedan pisar entre sí.
 *
 * `degradado` viaja desde BookSearchResult: marca que una fuente (Google
 * Books u Open Library) no respondió pero la otra sí, así que hay
 * resultados pero el catálogo cubierto es parcial. book-search.tsx,
 * add-to-shelf-dialog.tsx, admin/add-book-dialog.tsx y el buscador de
 * portadas de book-edit-dialog.tsx lo muestran como un aviso corto junto a
 * la lista — antes se calculaba y testeaba en google-books.ts pero ninguna
 * UI lo leía, que es peor que no tenerlo: la usuaria se quedaba con una
 * búsqueda incompleta sin saber que convenía reintentar.
 *
 * "resultados" y "sin-resultados" están separados a propósito, y no
 * colapsados en un solo "ok" con `books: []`: el bug original era justo
 * eso — los cuatro componentes anidaban el aviso de `degradado` DENTRO de
 * la condición de "hay resultados", así que cuando una fuente caía y la
 * otra respondía vacío, la usuaria caía derecho al "ese libro no existe"
 * sin enterarse de que la búsqueda quedó incompleta. Con la lista vacía
 * como rama propia del discriminated union, ambos casos cargan su propio
 * `degradado` y ningún componente puede volver a "olvidar" el aviso.
 */
export type EstadoBusqueda =
  | { tipo: "vacio" }
  | { tipo: "buscando" }
  | { tipo: "resultados"; books: BookCandidate[]; degradado: boolean }
  | { tipo: "sin-resultados"; degradado: boolean }
  | { tipo: "error" };

/**
 * Traduce un BookSearchResult ya resuelto al estado de UI. Pura y
 * testeable: no toca red, solo decide la forma a partir de una respuesta
 * ya cargada.
 */
export function estadoDesdeResultado(resultado: BookSearchResult): EstadoBusqueda {
  if (resultado.status === "error") return { tipo: "error" };
  return resultado.books.length > 0
    ? { tipo: "resultados", books: resultado.books, degradado: resultado.degradado }
    : { tipo: "sin-resultados", degradado: resultado.degradado };
}

/**
 * Ejecuta una búsqueda (inyectada como `buscar`, normalmente
 * searchBooksAction) y devuelve el estado resultante. searchBooks
 * (@/lib/google-books) nunca lanza, pero si la llamada RPC a la Server
 * Action falla antes de llegar a responder — sin red, por ejemplo — es el
 * mismo caso para la usuaria: la búsqueda falló, no que no haya
 * resultados. Antes este try/catch vivía copiado en cada componente, cada
 * uno con su propio `err` de catch sin usar.
 */
export async function ejecutarBusqueda(
  query: string,
  buscar: (q: string) => Promise<BookSearchResult>,
): Promise<EstadoBusqueda> {
  try {
    return estadoDesdeResultado(await buscar(query));
  } catch {
    return { tipo: "error" };
  }
}
