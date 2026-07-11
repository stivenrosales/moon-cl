import { afterEach, describe, expect, it } from "vitest";
import {
  getInitialAdminEmails,
  isAdmin,
  isModeratorOrAbove,
} from "@/lib/permissions";

describe("isAdmin", () => {
  it("retorna true cuando el rol es ADMIN", () => {
    expect(isAdmin("ADMIN")).toBe(true);
  });

  it("retorna false cuando el rol es MODERATOR", () => {
    expect(isAdmin("MODERATOR")).toBe(false);
  });

  it("retorna false cuando el rol es MEMBER", () => {
    expect(isAdmin("MEMBER")).toBe(false);
  });

  it("retorna false cuando el rol es undefined", () => {
    expect(isAdmin(undefined)).toBe(false);
  });

  it("retorna false cuando el rol es null", () => {
    expect(isAdmin(null)).toBe(false);
  });
});

describe("isModeratorOrAbove", () => {
  it("retorna true cuando el rol es ADMIN", () => {
    expect(isModeratorOrAbove("ADMIN")).toBe(true);
  });

  it("retorna true cuando el rol es MODERATOR", () => {
    expect(isModeratorOrAbove("MODERATOR")).toBe(true);
  });

  it("retorna false cuando el rol es MEMBER", () => {
    expect(isModeratorOrAbove("MEMBER")).toBe(false);
  });

  it("retorna false cuando el rol es undefined", () => {
    expect(isModeratorOrAbove(undefined)).toBe(false);
  });

  it("retorna false cuando el rol es null", () => {
    expect(isModeratorOrAbove(null)).toBe(false);
  });
});

describe("getInitialAdminEmails", () => {
  const originalValue = process.env.ADMIN_EMAILS;

  afterEach(() => {
    if (originalValue === undefined) {
      delete process.env.ADMIN_EMAILS;
    } else {
      process.env.ADMIN_EMAILS = originalValue;
    }
  });

  it("retorna arreglo vacío cuando la variable de entorno no está definida", () => {
    delete process.env.ADMIN_EMAILS;
    expect(getInitialAdminEmails()).toEqual([]);
  });

  it("retorna arreglo vacío cuando la variable de entorno está vacía", () => {
    process.env.ADMIN_EMAILS = "";
    expect(getInitialAdminEmails()).toEqual([]);
  });

  it("parsea una lista separada por comas y normaliza a minúsculas", () => {
    process.env.ADMIN_EMAILS = "Admin@Example.com,Otro@Example.com";
    expect(getInitialAdminEmails()).toEqual([
      "admin@example.com",
      "otro@example.com",
    ]);
  });

  it("recorta espacios en blanco alrededor de cada correo", () => {
    process.env.ADMIN_EMAILS = " admin@example.com , otro@example.com ";
    expect(getInitialAdminEmails()).toEqual([
      "admin@example.com",
      "otro@example.com",
    ]);
  });

  it("filtra entradas vacías producidas por comas repetidas", () => {
    process.env.ADMIN_EMAILS = "admin@example.com,,otro@example.com,";
    expect(getInitialAdminEmails()).toEqual([
      "admin@example.com",
      "otro@example.com",
    ]);
  });
});
