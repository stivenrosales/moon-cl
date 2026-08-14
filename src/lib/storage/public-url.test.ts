import { describe, it, expect } from "vitest";

import { extraerKeyDeUrl, resolverUrlPublica } from "./public-url";

describe("resolverUrlPublica", () => {
  it("une el host base con la key", () => {
    expect(resolverUrlPublica("https://storage.example.com", "avatars/user1-1000-foto.png")).toBe(
      "https://storage.example.com/avatars/user1-1000-foto.png",
    );
  });

  it("no duplica la barra cuando el host base ya termina en /", () => {
    expect(resolverUrlPublica("https://storage.example.com/", "avatars/foto.png")).toBe(
      "https://storage.example.com/avatars/foto.png",
    );
  });

  it("no duplica la barra cuando la key empieza con /", () => {
    expect(resolverUrlPublica("https://storage.example.com", "/avatars/foto.png")).toBe(
      "https://storage.example.com/avatars/foto.png",
    );
  });
});

describe("extraerKeyDeUrl", () => {
  it("extrae la key cuando la URL pertenece al host base", () => {
    expect(
      extraerKeyDeUrl("https://storage.example.com", "https://storage.example.com/avatars/foto.png"),
    ).toBe("avatars/foto.png");
  });

  it("devuelve null cuando la URL es de otro host (p.ej. avatar de OAuth de Google)", () => {
    expect(
      extraerKeyDeUrl("https://storage.example.com", "https://lh3.googleusercontent.com/a/foto"),
    ).toBeNull();
  });

  it("es la inversa de resolverUrlPublica", () => {
    const base = "https://storage.example.com";
    const key = "avatars/user1-1000-foto.png";
    expect(extraerKeyDeUrl(base, resolverUrlPublica(base, key))).toBe(key);
  });

  it("devuelve null si la URL coincide solo como prefijo pero no como subruta (mismo host, otro bucket lógico)", () => {
    expect(
      extraerKeyDeUrl("https://storage.example.com/bucket-a", "https://storage.example.com/bucket-ab/foto.png"),
    ).toBeNull();
  });
});
