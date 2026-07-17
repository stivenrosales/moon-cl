import { describe, it, expect } from "vitest";

import { getAccountAccessItems } from "./account-access";

describe("getAccountAccessItems", () => {
  it("expone exactamente los 3 accesos de cuenta: apariencia, admin, cerrar-sesion", () => {
    const items = getAccountAccessItems("MEMBER");
    expect(items.map((i) => i.key)).toEqual(["apariencia", "admin", "cerrar-sesion"]);
  });

  it("apariencia es siempre visible, sin importar el rol", () => {
    expect(getAccountAccessItems("MEMBER").find((i) => i.key === "apariencia")?.visible).toBe(
      true,
    );
    expect(getAccountAccessItems("ADMIN").find((i) => i.key === "apariencia")?.visible).toBe(
      true,
    );
    expect(getAccountAccessItems(undefined).find((i) => i.key === "apariencia")?.visible).toBe(
      true,
    );
  });

  it("cerrar-sesion es siempre visible, sin importar el rol", () => {
    expect(getAccountAccessItems("MEMBER").find((i) => i.key === "cerrar-sesion")?.visible).toBe(
      true,
    );
    expect(getAccountAccessItems(undefined).find((i) => i.key === "cerrar-sesion")?.visible).toBe(
      true,
    );
  });

  it("admin es visible para ADMIN", () => {
    expect(getAccountAccessItems("ADMIN").find((i) => i.key === "admin")?.visible).toBe(true);
  });

  it("admin es visible para MODERATOR", () => {
    expect(getAccountAccessItems("MODERATOR").find((i) => i.key === "admin")?.visible).toBe(
      true,
    );
  });

  it("admin NO es visible para MEMBER", () => {
    expect(getAccountAccessItems("MEMBER").find((i) => i.key === "admin")?.visible).toBe(false);
  });

  it("admin NO es visible sin rol (undefined/null)", () => {
    expect(getAccountAccessItems(undefined).find((i) => i.key === "admin")?.visible).toBe(false);
    expect(getAccountAccessItems(null).find((i) => i.key === "admin")?.visible).toBe(false);
  });

  it("cada item trae un label no vacío", () => {
    for (const item of getAccountAccessItems("ADMIN")) {
      expect(item.label.length).toBeGreaterThan(0);
    }
  });
});
