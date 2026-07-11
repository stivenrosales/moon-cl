import { describe, expect, it } from "vitest";
import { computeShelfTransition } from "@/server/services/shelf-transition";

const NOW = new Date("2026-07-10T12:00:00.000Z");

describe("computeShelfTransition", () => {
  it("WANT_TO_READ → READING: setea startedAt a ahora y limpia finishedAt", () => {
    const result = computeShelfTransition(
      { status: "WANT_TO_READ", startedAt: null, finishedAt: null },
      "READING",
      NOW,
    );
    expect(result).toEqual({ status: "READING", startedAt: NOW, finishedAt: null });
  });

  it("READING → FINISHED: setea finishedAt a ahora y conserva startedAt existente", () => {
    const startedAt = new Date("2026-06-01T00:00:00.000Z");
    const result = computeShelfTransition(
      { status: "READING", startedAt, finishedAt: null },
      "FINISHED",
      NOW,
    );
    expect(result).toEqual({ status: "FINISHED", startedAt, finishedAt: NOW });
  });

  it("nuevo libro (sin estado previo) directo a FINISHED: setea startedAt y finishedAt a ahora", () => {
    const result = computeShelfTransition(
      { status: null, startedAt: null, finishedAt: null },
      "FINISHED",
      NOW,
    );
    expect(result).toEqual({ status: "FINISHED", startedAt: NOW, finishedAt: NOW });
  });

  it("nuevo libro (sin estado previo) directo a READING: setea startedAt a ahora", () => {
    const result = computeShelfTransition(
      { status: null, startedAt: null, finishedAt: null },
      "READING",
      NOW,
    );
    expect(result).toEqual({ status: "READING", startedAt: NOW, finishedAt: null });
  });

  it("nuevo libro (sin estado previo) a WANT_TO_READ: no setea fechas", () => {
    const result = computeShelfTransition(
      { status: null, startedAt: null, finishedAt: null },
      "WANT_TO_READ",
      NOW,
    );
    expect(result).toEqual({ status: "WANT_TO_READ", startedAt: null, finishedAt: null });
  });

  it("FINISHED → READING (relectura): reinicia startedAt a ahora y limpia finishedAt", () => {
    const result = computeShelfTransition(
      {
        status: "FINISHED",
        startedAt: new Date("2026-01-01T00:00:00.000Z"),
        finishedAt: new Date("2026-02-01T00:00:00.000Z"),
      },
      "READING",
      NOW,
    );
    expect(result).toEqual({ status: "READING", startedAt: NOW, finishedAt: null });
  });

  it("READING → WANT_TO_READ: limpia startedAt y finishedAt", () => {
    const result = computeShelfTransition(
      { status: "READING", startedAt: new Date("2026-01-01T00:00:00.000Z"), finishedAt: null },
      "WANT_TO_READ",
      NOW,
    );
    expect(result).toEqual({ status: "WANT_TO_READ", startedAt: null, finishedAt: null });
  });

  it("READING → READING (no-op): conserva startedAt y finishedAt tal cual", () => {
    const startedAt = new Date("2026-01-01T00:00:00.000Z");
    const result = computeShelfTransition(
      { status: "READING", startedAt, finishedAt: null },
      "READING",
      NOW,
    );
    expect(result).toEqual({ status: "READING", startedAt, finishedAt: null });
  });

  it("FINISHED → FINISHED (no-op): conserva finishedAt existente en lugar de sobrescribirlo", () => {
    const startedAt = new Date("2026-01-01T00:00:00.000Z");
    const finishedAt = new Date("2026-02-01T00:00:00.000Z");
    const result = computeShelfTransition(
      { status: "FINISHED", startedAt, finishedAt },
      "FINISHED",
      NOW,
    );
    expect(result).toEqual({ status: "FINISHED", startedAt, finishedAt });
  });

  it("usa new Date() como default cuando no se pasa `now`", () => {
    const before = Date.now();
    const result = computeShelfTransition(
      { status: null, startedAt: null, finishedAt: null },
      "READING",
    );
    const after = Date.now();
    expect(result.startedAt).not.toBeNull();
    expect(result.startedAt!.getTime()).toBeGreaterThanOrEqual(before);
    expect(result.startedAt!.getTime()).toBeLessThanOrEqual(after);
  });
});
