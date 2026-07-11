import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const closeExpiredRoundsMock = vi.fn();
const sendMeetingRemindersMock = vi.fn();
const sendBirthdayGreetingsMock = vi.fn();

vi.mock("@/server/jobs/close-expired-rounds", () => ({
  closeExpiredRounds: (...args: unknown[]) => closeExpiredRoundsMock(...args),
}));

vi.mock("@/server/jobs/meeting-reminders", () => ({
  sendMeetingReminders: (...args: unknown[]) => sendMeetingRemindersMock(...args),
}));

vi.mock("@/server/jobs/birthdays", () => ({
  sendBirthdayGreetings: (...args: unknown[]) => sendBirthdayGreetingsMock(...args),
}));

import { GET } from "@/app/api/cron/daily/route";

function makeRequest(authorization?: string) {
  const headers = new Headers();
  if (authorization !== undefined) headers.set("authorization", authorization);
  return new Request("http://localhost/api/cron/daily", { headers });
}

const ORIGINAL_ENV = process.env.CRON_SECRET;

describe("GET /api/cron/daily", () => {
  beforeEach(() => {
    closeExpiredRoundsMock.mockReset();
    sendMeetingRemindersMock.mockReset();
    sendBirthdayGreetingsMock.mockReset();
    process.env.CRON_SECRET = "el-secreto";
  });

  afterEach(() => {
    process.env.CRON_SECRET = ORIGINAL_ENV;
  });

  it("responde 500 si CRON_SECRET no está configurada", async () => {
    delete process.env.CRON_SECRET;

    const response = await GET(makeRequest("Bearer cualquier-cosa"));

    expect(response.status).toBe(500);
    const body = await response.json();
    expect(body.error).toMatch(/CRON_SECRET/);
    expect(closeExpiredRoundsMock).not.toHaveBeenCalled();
  });

  it("responde 401 si el header authorization falta o no coincide", async () => {
    const sinHeader = await GET(makeRequest());
    expect(sinHeader.status).toBe(401);

    const incorrecto = await GET(makeRequest("Bearer secreto-equivocado"));
    expect(incorrecto.status).toBe(401);

    expect(closeExpiredRoundsMock).not.toHaveBeenCalled();
  });

  it("ejecuta el registry de jobs y responde 200 con el resultado por job", async () => {
    closeExpiredRoundsMock.mockResolvedValue({ closed: 3 });
    sendMeetingRemindersMock.mockResolvedValue({ reminded: 1, emailsSent: 2 });
    sendBirthdayGreetingsMock.mockResolvedValue({ celebrants: 1, sent: 1 });

    const response = await GET(makeRequest("Bearer el-secreto"));

    expect(response.status).toBe(200);
    const body = await response.json();
    expect(body.results).toEqual([
      { name: "closeExpiredRounds", ok: true, result: { closed: 3 } },
      { name: "sendMeetingReminders", ok: true, result: { reminded: 1, emailsSent: 2 } },
      { name: "sendBirthdayGreetings", ok: true, result: { celebrants: 1, sent: 1 } },
    ]);
  });

  it("un job que falla no tumba a los demás: se reporta ok:false con su error y los otros siguen", async () => {
    closeExpiredRoundsMock.mockRejectedValue(new Error("boom"));
    sendMeetingRemindersMock.mockResolvedValue({ reminded: 0, emailsSent: 0 });
    sendBirthdayGreetingsMock.mockResolvedValue({ celebrants: 0, sent: 0 });

    const response = await GET(makeRequest("Bearer el-secreto"));

    expect(response.status).toBe(200);
    const body = await response.json();
    expect(body.results).toEqual([
      { name: "closeExpiredRounds", ok: false, error: "boom" },
      { name: "sendMeetingReminders", ok: true, result: { reminded: 0, emailsSent: 0 } },
      { name: "sendBirthdayGreetings", ok: true, result: { celebrants: 0, sent: 0 } },
    ]);
  });
});
