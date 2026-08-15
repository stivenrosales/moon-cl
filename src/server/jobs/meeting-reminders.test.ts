import { beforeEach, describe, expect, it, vi } from "vitest";

const findManyMock = vi.fn();
const updateMock = vi.fn();

vi.mock("@/lib/db", () => ({
  db: {
    meeting: {
      findMany: (...args: unknown[]) => findManyMock(...args),
      update: (...args: unknown[]) => updateMock(...args),
    },
  },
}));

const { emailsSendMock, batchSendMock, ResendMock } = vi.hoisted(() => {
  const emailsSendMock = vi.fn().mockResolvedValue({ data: { id: "e1" }, error: null });
  const batchSendMock = vi.fn().mockResolvedValue({ data: { data: [] }, error: null });
  const ResendMock = vi.fn().mockImplementation(function Resend() {
    return {
      emails: { send: emailsSendMock },
      batch: { send: batchSendMock },
    };
  });
  return { emailsSendMock, batchSendMock, ResendMock };
});

vi.mock("resend", () => ({ Resend: ResendMock }));

vi.mock("@/lib/email", () => ({
  buildMeetingReminderHtml: vi.fn().mockReturnValue("<html></html>"),
  buildMeetingReminderText: vi.fn().mockReturnValue("texto"),
}));

import { sendMeetingReminders } from "@/server/jobs/meeting-reminders";

function meeting(overrides: Record<string, unknown> = {}) {
  return {
    id: "m1",
    title: "Encuentro mensual",
    startsAt: new Date("2026-07-11T18:00:00.000Z"),
    endsAt: null,
    location: "Biblioteca central",
    meetingUrl: null,
    isVirtual: false,
    rsvps: [
      { user: { email: "ana@example.com", name: "Ana" } },
      { user: { email: "beto@example.com", name: "Beto" } },
    ],
    ...overrides,
  };
}

describe("sendMeetingReminders", () => {
  const now = new Date("2026-07-10T12:00:00.000Z");

  beforeEach(() => {
    findManyMock.mockReset();
    updateMock.mockReset();
    // Se re-arman (no solo mockClear) porque varios tests encolan un
    // mockResolvedValueOnce: mockClear no drena esa cola y el error se
    // filtraría al test siguiente.
    emailsSendMock.mockReset().mockResolvedValue({ data: { id: "e1" }, error: null });
    batchSendMock.mockReset().mockResolvedValue({ data: { data: [] }, error: null });
    process.env.AUTH_RESEND_KEY = "re_test_key";
  });

  it("busca reuniones dentro de las próximas 24h con remindedAt null", async () => {
    findManyMock.mockResolvedValue([]);

    await sendMeetingReminders(now);

    expect(findManyMock).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          startsAt: { gte: now, lte: new Date(now.getTime() + 24 * 60 * 60 * 1000) },
          remindedAt: null,
        },
      }),
    );
  });

  it("caso 'ya recordado': una reunión con remindedAt no-null nunca llega (la query la filtra) y no se reprocesa", async () => {
    // El filtro remindedAt: null vive en el where de la query; simulamos que
    // la DB ya excluyó esa reunión devolviendo solo las pendientes.
    findManyMock.mockResolvedValue([]);

    const result = await sendMeetingReminders(now);

    expect(result).toEqual({ reminded: 0, emailsSent: 0, fallos: [], sinCredenciales: false });
    expect(updateMock).not.toHaveBeenCalled();
    expect(emailsSendMock).not.toHaveBeenCalled();
    expect(batchSendMock).not.toHaveBeenCalled();
  });

  it("caso 'reprogramada': una reunión con remindedAt reseteado a null que ahora cae en la ventana se vuelve a recordar", async () => {
    // Tras reprogramar, updateMeeting puso remindedAt en null; para el job
    // esto es indistinguible de una reunión nunca recordada: se procesa igual.
    findManyMock.mockResolvedValue([meeting({ id: "reprogramada" })]);

    const result = await sendMeetingReminders(now);

    expect(result).toEqual({ reminded: 1, emailsSent: 2, fallos: [], sinCredenciales: false });
    expect(updateMock).toHaveBeenCalledWith({
      where: { id: "reprogramada" },
      data: { remindedAt: now },
    });
  });

  it("junta solo los RSVP con status YES y envía por batch cuando hay más de un destinatario", async () => {
    findManyMock.mockResolvedValue([meeting()]);

    await sendMeetingReminders(now);

    expect(batchSendMock).toHaveBeenCalledTimes(1);
    expect(emailsSendMock).not.toHaveBeenCalled();
    const payload = batchSendMock.mock.calls[0][0] as Array<{ to: string }>;
    expect(payload.map((p) => p.to).sort()).toEqual([
      "ana@example.com",
      "beto@example.com",
    ]);
  });

  it("envía con emails.send (no batch) cuando hay un solo destinatario", async () => {
    findManyMock.mockResolvedValue([
      meeting({ rsvps: [{ user: { email: "solo@example.com", name: "Solo" } }] }),
    ]);

    await sendMeetingReminders(now);

    expect(emailsSendMock).toHaveBeenCalledTimes(1);
    expect(batchSendMock).not.toHaveBeenCalled();
  });

  it("marca remindedAt tras enviar exitosamente", async () => {
    findManyMock.mockResolvedValue([meeting()]);

    await sendMeetingReminders(now);

    expect(updateMock).toHaveBeenCalledWith({
      where: { id: "m1" },
      data: { remindedAt: now },
    });
  });

  it("marca remindedAt aunque no haya ningún RSVP YES (nadie a quien avisar)", async () => {
    findManyMock.mockResolvedValue([meeting({ rsvps: [] })]);

    const result = await sendMeetingReminders(now);

    expect(result).toEqual({ reminded: 1, emailsSent: 0, fallos: [], sinCredenciales: false });
    expect(emailsSendMock).not.toHaveBeenCalled();
    expect(batchSendMock).not.toHaveBeenCalled();
    expect(updateMock).toHaveBeenCalledWith({
      where: { id: "m1" },
      data: { remindedAt: now },
    });
  });

  it("usa new Date() por defecto cuando no se pasa 'now'", async () => {
    findManyMock.mockResolvedValue([]);

    await sendMeetingReminders();

    const call = findManyMock.mock.calls[0][0];
    expect(call.where.startsAt.gte).toBeInstanceOf(Date);
  });

  it("no marca remindedAt cuando batch.send devuelve error: la reunión se reintenta mañana", async () => {
    // El SDK de Resend no lanza: devuelve { data: null, error }. Marcar
    // remindedAt igual enterraba la reunión para siempre.
    findManyMock.mockResolvedValue([meeting()]);
    batchSendMock.mockResolvedValueOnce({
      data: null,
      error: { name: "validation_error", message: "dominio no verificado" },
    });

    const result = await sendMeetingReminders(now);

    expect(updateMock).not.toHaveBeenCalled();
    expect(result.reminded).toBe(0);
    expect(result.emailsSent).toBe(0);
    expect(result.fallos).toEqual([
      { meetingId: "m1", motivo: expect.stringContaining("dominio no verificado") },
    ]);
  });

  it("no marca remindedAt cuando emails.send devuelve error con un solo destinatario", async () => {
    findManyMock.mockResolvedValue([
      meeting({ rsvps: [{ user: { email: "solo@example.com", name: "Solo" } }] }),
    ]);
    emailsSendMock.mockResolvedValueOnce({
      data: null,
      error: { name: "rate_limit_exceeded", message: "demasiados envíos" },
    });

    const result = await sendMeetingReminders(now);

    expect(updateMock).not.toHaveBeenCalled();
    expect(result.emailsSent).toBe(0);
    expect(result.fallos).toEqual([
      { meetingId: "m1", motivo: expect.stringContaining("demasiados envíos") },
    ]);
  });

  it("un fallo de envío no aborta el loop: la reunión siguiente se procesa igual", async () => {
    findManyMock.mockResolvedValue([meeting({ id: "falla" }), meeting({ id: "sigue" })]);
    batchSendMock.mockRejectedValueOnce(new Error("socket hang up"));

    const result = await sendMeetingReminders(now);

    expect(result.reminded).toBe(1);
    expect(result.emailsSent).toBe(2);
    expect(updateMock).toHaveBeenCalledTimes(1);
    expect(updateMock).toHaveBeenCalledWith({ where: { id: "sigue" }, data: { remindedAt: now } });
    expect(result.fallos).toEqual([{ meetingId: "falla", motivo: "socket hang up" }]);
  });

  it("sin AUTH_RESEND_KEY no marca remindedAt y no se confunde con un fallo de envío", async () => {
    delete process.env.AUTH_RESEND_KEY;
    findManyMock.mockResolvedValue([meeting()]);

    const result = await sendMeetingReminders(now);

    expect(result.sinCredenciales).toBe(true);
    expect(result.fallos).toEqual([]);
    expect(result.reminded).toBe(0);
    expect(updateMock).not.toHaveBeenCalled();
  });
});
