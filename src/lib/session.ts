import { cache } from "react";
import { auth } from "@/lib/auth";

// auth() de NextAuth v5 no está envuelto en React.cache: con session
// strategy "database" cada llamada dispara un lookup Session+User a
// Postgres. Envolviéndolo así, todas las llamadas a getSession() dentro
// del mismo request de React (layout + page + server actions del mismo
// render) reusan el mismo resultado en vez de repetir la query.
export const getSession = cache(() => auth());
