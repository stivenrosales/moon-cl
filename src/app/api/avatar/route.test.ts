import { beforeEach, describe, expect, it, vi } from "vitest";

const getSessionMock = vi.fn();
const crearUrlDeSubidaMock = vi.fn();
const resolverUrlPublicaMock = vi.fn();

vi.mock("@/lib/session", () => ({
  getSession: (...args: unknown[]) => getSessionMock(...args),
}));

vi.mock("@/lib/storage/s3-adapter", () => ({
  s3StorageAdapter: {
    crearUrlDeSubida: (...args: unknown[]) => crearUrlDeSubidaMock(...args),
    resolverUrlPublica: (...args: unknown[]) => resolverUrlPublicaMock(...args),
    borrar: vi.fn(),
  },
}));

import { POST } from "@/app/api/avatar/route";

function makeRequest(body: unknown) {
  return new Request("http://localhost/api/avatar", {
    method: "POST",
    body: JSON.stringify(body),
  });
}

function makeRawRequest(rawBody: string) {
  return new Request("http://localhost/api/avatar", {
    method: "POST",
    body: rawBody,
  });
}

const USER_ID = "cme111111111111111111111";

beforeEach(() => {
  getSessionMock.mockReset();
  crearUrlDeSubidaMock.mockReset();
  resolverUrlPublicaMock.mockReset();
});

describe("POST /api/avatar", () => {
  it("responde 401 si no hay sesión iniciada", async () => {
    getSessionMock.mockResolvedValue(null);

    const response = await POST(
      makeRequest({ fileName: "foto.png", contentType: "image/png", size: 1024 }),
    );

    expect(response.status).toBe(401);
    expect(crearUrlDeSubidaMock).not.toHaveBeenCalled();
  });

  it("responde 400 si el body no es JSON válido", async () => {
    getSessionMock.mockResolvedValue({ user: { id: USER_ID } });

    const response = await POST(makeRawRequest("esto no es json"));

    expect(response.status).toBe(400);
    expect(crearUrlDeSubidaMock).not.toHaveBeenCalled();
  });

  it("responde 400 si falta el campo size — antes se colaba porque undefined > MAX es false", async () => {
    getSessionMock.mockResolvedValue({ user: { id: USER_ID } });

    const response = await POST(makeRequest({ fileName: "foto.png", contentType: "image/png" }));

    expect(response.status).toBe(400);
    expect(crearUrlDeSubidaMock).not.toHaveBeenCalled();
  });

  it("responde 400 si size llega como string en vez de number", async () => {
    getSessionMock.mockResolvedValue({ user: { id: USER_ID } });

    const response = await POST(
      makeRequest({ fileName: "foto.png", contentType: "image/png", size: "1024" }),
    );

    expect(response.status).toBe(400);
    expect(crearUrlDeSubidaMock).not.toHaveBeenCalled();
  });

  it("responde 400 si el tipo de archivo no está permitido", async () => {
    getSessionMock.mockResolvedValue({ user: { id: USER_ID } });

    const response = await POST(
      makeRequest({ fileName: "foto.gif", contentType: "image/gif", size: 1024 }),
    );

    expect(response.status).toBe(400);
    const body = await response.json();
    expect(body.error).toMatch(/no permitido/);
    expect(crearUrlDeSubidaMock).not.toHaveBeenCalled();
  });

  it("responde 400 si el archivo supera el tamaño máximo", async () => {
    getSessionMock.mockResolvedValue({ user: { id: USER_ID } });

    const response = await POST(
      makeRequest({ fileName: "foto.png", contentType: "image/png", size: 5 * 1024 * 1024 }),
    );

    expect(response.status).toBe(400);
    expect(crearUrlDeSubidaMock).not.toHaveBeenCalled();
  });

  it("devuelve uploadUrl y publicUrl cuando el archivo es válido", async () => {
    getSessionMock.mockResolvedValue({ user: { id: USER_ID } });
    crearUrlDeSubidaMock.mockResolvedValue("https://r2.example.com/firmada");
    resolverUrlPublicaMock.mockReturnValue("https://storage.example.com/avatars/foo.png");

    const response = await POST(
      makeRequest({ fileName: "foto.png", contentType: "image/png", size: 1024 }),
    );

    expect(response.status).toBe(200);
    const body = await response.json();
    expect(body).toEqual({
      uploadUrl: "https://r2.example.com/firmada",
      publicUrl: "https://storage.example.com/avatars/foo.png",
    });
    expect(crearUrlDeSubidaMock).toHaveBeenCalledWith({
      key: expect.stringMatching(new RegExp(`^avatars/${USER_ID}-\\d+-foto\\.png$`)),
      contentType: "image/png",
      // El límite de tamaño no puede ser cosmético: se firma el
      // Content-Length exacto para que SigV4 rechace cualquier PUT cuyo
      // body real no coincida con lo declarado acá.
      contentLength: 1024,
    });
  });

  it("responde 500 si el adaptador de storage falla (p.ej. envs faltantes)", async () => {
    getSessionMock.mockResolvedValue({ user: { id: USER_ID } });
    crearUrlDeSubidaMock.mockRejectedValue(new Error("Faltan variables de entorno de storage"));

    const response = await POST(
      makeRequest({ fileName: "foto.png", contentType: "image/png", size: 1024 }),
    );

    expect(response.status).toBe(500);
  });

  // Los errores del SDK de S3 traen el endpoint, el bucket y a veces parte
  // de la config en el mensaje. Eso es diagnóstico para nosotros y un mapa
  // del storage para cualquiera que golpee el endpoint: el detalle va al
  // log del servidor, al cliente le llega algo genérico.
  it("no filtra al cliente el mensaje interno del error de storage", async () => {
    getSessionMock.mockResolvedValue({ user: { id: USER_ID } });
    crearUrlDeSubidaMock.mockRejectedValue(
      new Error("connect ECONNREFUSED bucket=moon-avatars endpoint=https://interno.r2"),
    );

    const response = await POST(
      makeRequest({ fileName: "foto.png", contentType: "image/png", size: 1024 }),
    );
    const cuerpo = await response.json();

    expect(response.status).toBe(500);
    expect(JSON.stringify(cuerpo)).not.toContain("moon-avatars");
    expect(JSON.stringify(cuerpo)).not.toContain("interno.r2");
  });
});
