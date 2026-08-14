import { describe, it, expect } from "vitest";

import { construirKeyAvatar, keyPerteneceAUsuario } from "./avatar-key";

describe("construirKeyAvatar", () => {
  it("arma la key con el prefijo avatars/, el userId y el timestamp", () => {
    expect(construirKeyAvatar("user1", "foto.png", 1000)).toBe("avatars/user1-1000-foto.png");
  });

  it("sanitiza espacios y acentos del nombre de archivo", () => {
    expect(construirKeyAvatar("user1", "mi foto é.png", 1000)).toBe("avatars/user1-1000-mi-foto--.png");
  });

  it("sanitiza caracteres que no son seguros en una key S3", () => {
    expect(construirKeyAvatar("user1", "foto/raro?.png", 1000)).toBe("avatars/user1-1000-foto-raro-.png");
  });

  it("conserva puntos y guiones porque son válidos en una key S3", () => {
    expect(construirKeyAvatar("user1", "mi-foto.final.png", 1000)).toBe(
      "avatars/user1-1000-mi-foto.final.png",
    );
  });

  it("usa Date.now() cuando no se pasa un timestamp explícito", () => {
    const key = construirKeyAvatar("user1", "foto.png");
    expect(key).toMatch(/^avatars\/user1-\d+-foto\.png$/);
  });

  it("dos usuarios distintos con el mismo archivo generan keys distintas", () => {
    const keyA = construirKeyAvatar("userA", "foto.png", 1000);
    const keyB = construirKeyAvatar("userB", "foto.png", 1000);
    expect(keyA).not.toBe(keyB);
  });
});

describe("keyPerteneceAUsuario", () => {
  it("acepta la key que el propio usuario generó", () => {
    const key = construirKeyAvatar("userA", "foto.png", 1000);
    expect(keyPerteneceAUsuario(key, "userA")).toBe(true);
  });

  it("rechaza la key de otro usuario", () => {
    const ajena = construirKeyAvatar("userB", "foto.png", 1000);
    expect(keyPerteneceAUsuario(ajena, "userA")).toBe(false);
  });

  // Las URLs de avatar son públicas y viajan en el HTML de cualquier perfil,
  // así que un id ajeno no es un secreto: la comprobación tiene que ser de
  // pertenencia real, no de que el id "parezca" propio.
  it("no se deja engañar por un userId que es prefijo de otro", () => {
    const key = construirKeyAvatar("user10", "foto.png", 1000);
    expect(keyPerteneceAUsuario(key, "user1")).toBe(false);
  });

  it("rechaza una key fuera del prefijo avatars/", () => {
    expect(keyPerteneceAUsuario("otros/userA-1000-foto.png", "userA")).toBe(false);
  });

  it("rechaza una key que mete el id del usuario después del suyo", () => {
    expect(keyPerteneceAUsuario("avatars/userB-1000-userA-foto.png", "userA")).toBe(false);
  });
});
