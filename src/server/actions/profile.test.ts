import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const userFindUniqueMock = vi.fn();
const userUpdateMock = vi.fn();
const requireUserMock = vi.fn();
const revalidatePathMock = vi.fn();
const storageBorrarMock = vi.fn();

vi.mock("@/lib/db", () => ({
  db: {
    user: {
      findUnique: (...args: unknown[]) => userFindUniqueMock(...args),
      update: (...args: unknown[]) => userUpdateMock(...args),
    },
  },
}));

vi.mock("@/server/auth-helpers", () => ({
  requireUser: (...args: unknown[]) => requireUserMock(...args),
}));

vi.mock("next/cache", () => ({
  revalidatePath: (...args: unknown[]) => revalidatePathMock(...args),
}));

// El adaptador S3 es I/O real (aislado en s3-adapter.ts); acá solo nos
// importa que setAvatar lo llame con la key correcta. extraerKeyDeUrl es
// pura y se usa tal cual, sin mockear (mismo criterio que el resto del
// repo: los tests de actions no mockean lib puro).
vi.mock("@/lib/storage/s3-adapter", () => ({
  s3StorageAdapter: {
    borrar: (...args: unknown[]) => storageBorrarMock(...args),
    crearUrlDeSubida: vi.fn(),
    resolverUrlPublica: vi.fn(),
  },
}));

import { completeOnboarding, setAvatar, updateProfile } from "@/server/actions/profile";

const ME = { id: "cme111111111111111111111", role: "MEMBER" };
const OTRA_PERSONA = "cme999999999999999999999";
const ORIGINAL_PUBLIC_URL = process.env.STORAGE_PUBLIC_URL;

// Las keys reales llevan el formato avatars/{userId}-{timestamp}-{nombre}
// (ver construirKeyAvatar). Los tests las escriben completas a propósito:
// con keys de fantasía tipo "avatars/vieja.png" no se puede comprobar la
// pertenencia, que es justo la regla que protege el borrado.
const URL_VIEJA = `https://storage.example.com/avatars/${ME.id}-1000-vieja.png`;
const URL_NUEVA = `https://storage.example.com/avatars/${ME.id}-2000-nueva.png`;
const URL_MISMA = `https://storage.example.com/avatars/${ME.id}-1000-misma.png`;

beforeEach(() => {
  userFindUniqueMock.mockReset();
  userUpdateMock.mockReset();
  requireUserMock.mockReset();
  revalidatePathMock.mockReset();
  storageBorrarMock.mockReset();
  requireUserMock.mockResolvedValue(ME);
  process.env.STORAGE_PUBLIC_URL = "https://storage.example.com";
});

afterEach(() => {
  process.env.STORAGE_PUBLIC_URL = ORIGINAL_PUBLIC_URL;
});

describe("setAvatar", () => {
  it("requiere sesión iniciada", async () => {
    requireUserMock.mockRejectedValue(new Error("Debes iniciar sesión"));

    await expect(setAvatar("https://storage.example.com/avatars/foo.png")).rejects.toThrow(
      "Debes iniciar sesión",
    );
    expect(userUpdateMock).not.toHaveBeenCalled();
  });

  it("rechaza una URL inválida", async () => {
    await expect(setAvatar("no-es-una-url")).rejects.toThrow();
    expect(userUpdateMock).not.toHaveBeenCalled();
  });

  it("guarda la nueva URL en el usuario y revalida /perfil", async () => {
    userFindUniqueMock.mockResolvedValue({ image: null });
    userUpdateMock.mockResolvedValue({});

    const result = await setAvatar(URL_NUEVA);

    expect(result).toBe(URL_NUEVA);
    expect(userUpdateMock).toHaveBeenCalledWith({
      where: { id: ME.id },
      data: { image: URL_NUEVA },
    });
    expect(revalidatePathMock).toHaveBeenCalledWith("/perfil");
  });

  it("borra el avatar anterior del storage cuando cambia y vive en nuestro bucket", async () => {
    userFindUniqueMock.mockResolvedValue({ image: URL_VIEJA });
    userUpdateMock.mockResolvedValue({});

    await setAvatar(URL_NUEVA);

    expect(storageBorrarMock).toHaveBeenCalledWith(`avatars/${ME.id}-1000-vieja.png`);
  });

  it("no intenta borrar cuando el avatar anterior es externo (OAuth de Google)", async () => {
    userFindUniqueMock.mockResolvedValue({ image: "https://lh3.googleusercontent.com/a/foto" });
    userUpdateMock.mockResolvedValue({});

    await setAvatar(URL_NUEVA);

    expect(storageBorrarMock).not.toHaveBeenCalled();
  });

  it("no borra nada cuando la URL nueva es igual a la anterior", async () => {
    userFindUniqueMock.mockResolvedValue({ image: URL_MISMA });
    userUpdateMock.mockResolvedValue({});

    await setAvatar(URL_MISMA);

    expect(storageBorrarMock).not.toHaveBeenCalled();
  });

  // ─────────────────────────────────────────────────────────────────────
  // Las URLs de avatar son públicas: cualquiera las ve en el HTML de un
  // perfil. Si setAvatar acepta una URL de nuestro storage sin comprobar a
  // quién pertenece la key, un miembro del club puede guardarse la URL de
  // otra persona y, al cambiar su avatar después, disparar el borrado del
  // archivo ajeno. La key ya lleva el userId — hay que usarlo.
  // ─────────────────────────────────────────────────────────────────────
  it("rechaza una URL de nuestro storage cuya key es de otra persona", async () => {
    userFindUniqueMock.mockResolvedValue({ image: null });

    await expect(
      setAvatar(`https://storage.example.com/avatars/${OTRA_PERSONA}-1000-foto.png`),
    ).rejects.toThrow();

    expect(userUpdateMock).not.toHaveBeenCalled();
  });

  it("no borra del storage un avatar previo que no le pertenece", async () => {
    userFindUniqueMock.mockResolvedValue({
      image: `https://storage.example.com/avatars/${OTRA_PERSONA}-1000-vieja.png`,
    });
    userUpdateMock.mockResolvedValue({});

    await setAvatar(`https://storage.example.com/avatars/${ME.id}-2000-nueva.png`);

    expect(storageBorrarMock).not.toHaveBeenCalled();
  });

  it("no falla en la primera subida, cuando no hay avatar previo", async () => {
    userFindUniqueMock.mockResolvedValue({ image: null });
    userUpdateMock.mockResolvedValue({});

    await expect(setAvatar(URL_NUEVA)).resolves.toBe(
      URL_NUEVA,
    );
    expect(storageBorrarMock).not.toHaveBeenCalled();
  });
});

describe("completeOnboarding", () => {
  // countryCode, city y citySlug se escriben JUNTOS vía camposUbicacion():
  // la invariante es que nadie los arma a mano (misma doctrina que
  // ReadingProgress + UserBook en updateProgress).
  it("escribe countryCode, city y citySlug juntos usando camposUbicacion", async () => {
    userUpdateMock.mockResolvedValue({});

    await completeOnboarding({
      ageConfirmed: true,
      favoriteGenres: [],
      ubicacion: { countryCode: "PE", city: "Lima" },
    });

    expect(userUpdateMock).toHaveBeenCalledWith({
      where: { id: ME.id },
      data: expect.objectContaining({
        countryCode: "PE",
        city: "Lima",
        citySlug: "lima",
      }),
    });
  });

  it("rechaza un countryCode inventado y no escribe nada", async () => {
    await expect(
      completeOnboarding({
        ageConfirmed: true,
        favoriteGenres: [],
        ubicacion: { countryCode: "XX", city: "Lima" },
      }),
    ).rejects.toThrow();

    expect(userUpdateMock).not.toHaveBeenCalled();
  });

  // La ubicación es obligatoria en el onboarding (ver ubicacionSchema en
  // validators.ts): sin ella el schema rechaza antes de tocar la base.
  it("rechaza cuando falta la ubicación", async () => {
    await expect(
      completeOnboarding({ ageConfirmed: true, favoriteGenres: [] }),
    ).rejects.toThrow();

    expect(userUpdateMock).not.toHaveBeenCalled();
  });
});

describe("updateProfile", () => {
  it("escribe countryCode, city y citySlug juntos al guardar una ubicación válida", async () => {
    userUpdateMock.mockResolvedValue({});

    await updateProfile({
      name: "María Pérez",
      ubicacion: { countryCode: "PE", city: "Arequipa" },
    });

    expect(userUpdateMock).toHaveBeenCalledWith({
      where: { id: ME.id },
      data: expect.objectContaining({
        countryCode: "PE",
        city: "Arequipa",
        citySlug: "arequipa",
      }),
    });
  });

  it("borrar la ubicación (ubicacion: null) escribe null en los tres campos", async () => {
    userUpdateMock.mockResolvedValue({});

    await updateProfile({ name: "María Pérez", ubicacion: null });

    expect(userUpdateMock).toHaveBeenCalledWith({
      where: { id: ME.id },
      data: expect.objectContaining({
        countryCode: null,
        city: null,
        citySlug: null,
      }),
    });
  });

  it("omitir ubicacion también escribe null en los tres campos (no hay estado 'sin tocar' en la escritura)", async () => {
    userUpdateMock.mockResolvedValue({});

    await updateProfile({ name: "María Pérez" });

    expect(userUpdateMock).toHaveBeenCalledWith({
      where: { id: ME.id },
      data: expect.objectContaining({
        countryCode: null,
        city: null,
        citySlug: null,
      }),
    });
  });

  // El directorio de /club ahora muestra la ciudad, así que updateProfile
  // tiene que revalidarlo además de /perfil.
  it("revalida /perfil y /club", async () => {
    userUpdateMock.mockResolvedValue({});

    await updateProfile({ name: "María Pérez" });

    expect(revalidatePathMock).toHaveBeenCalledWith("/perfil");
    expect(revalidatePathMock).toHaveBeenCalledWith("/club");
  });

  it("rechaza un countryCode inventado y no escribe nada", async () => {
    await expect(
      updateProfile({
        name: "María Pérez",
        ubicacion: { countryCode: "XX", city: "Arequipa" },
      }),
    ).rejects.toThrow();

    expect(userUpdateMock).not.toHaveBeenCalled();
  });
});
