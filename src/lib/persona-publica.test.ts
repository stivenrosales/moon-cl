import { describe, it, expect } from "vitest";

import { aPersonaPublica, nombreVisible } from "./persona-publica";

describe("nombreVisible", () => {
  it("usa el nombre cuando existe", () => {
    expect(nombreVisible("Ana Torres", "ana@correo-privado.test")).toBe("Ana Torres");
  });

  it("cae al usuario del correo cuando no hay nombre — es lo que la UI ya mostraba", () => {
    expect(nombreVisible(null, "ana.torres@correo-privado.test")).toBe("ana.torres");
  });

  it("devuelve null cuando no hay nombre ni correo: cada pantalla decide su propio texto de reemplazo", () => {
    expect(nombreVisible(null, null)).toBeNull();
  });

  it("trata un nombre en blanco como ausente, igual que las iniciales, para que no se contradigan", () => {
    // getInitials ya hacía `name?.trim() || email…`, así que un nombre de
    // puros espacios sacaba iniciales del correo mientras la fila pintaba
    // un nombre vacío. Un solo criterio para los dos.
    expect(nombreVisible("   ", "ana@correo-privado.test")).toBe("ana");
  });
});

describe("aPersonaPublica", () => {
  const socia = {
    id: "u1",
    name: "Ana Torres",
    email: "ana.torres@correo-privado.test",
    image: "https://cdn.test/ana.jpg",
  };

  it("NUNCA deja el correo en el objeto que viaja al cliente", () => {
    // Esta es la regla, no un detalle: member-list.tsx y match-card.tsx son
    // Client Components, así que todo lo que reciben queda embebido en el
    // payload RSC. Mismo criterio que gateComment(): lo que no debe ver el
    // cliente no sale del servidor. Antes acá viajaba el directorio de
    // correos completo del club.
    const persona = aPersonaPublica(socia);
    expect("email" in persona).toBe(false);
    expect(JSON.stringify(persona)).not.toContain("@");
  });

  it("no filtra el dominio del correo ni siquiera dentro del nombre visible", () => {
    const persona = aPersonaPublica({ ...socia, name: null });
    expect(persona.nombre).toBe("ana.torres");
    expect(JSON.stringify(persona)).not.toContain("correo-privado.test");
  });

  it("resuelve las iniciales en el servidor con el mismo criterio que getInitials", () => {
    expect(aPersonaPublica(socia).iniciales).toBe("AT");
    expect(aPersonaPublica({ ...socia, name: null }).iniciales).toBe("AN");
  });

  it("conserva id e imagen tal cual: el cliente los sigue necesitando", () => {
    const persona = aPersonaPublica(socia);
    expect(persona.id).toBe("u1");
    expect(persona.image).toBe("https://cdn.test/ana.jpg");
  });

  it("distingue 'sin imagen' con null en vez de inventar una cadena vacía", () => {
    expect(aPersonaPublica({ ...socia, image: null }).image).toBeNull();
  });

  it("sin nombre ni correo devuelve nombre null e iniciales '?'", () => {
    const persona = aPersonaPublica({ id: "u2", name: null, email: null, image: null });
    expect(persona.nombre).toBeNull();
    expect(persona.iniciales).toBe("?");
  });
});
