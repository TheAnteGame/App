import { describe, it, expect } from "vitest";
import { computeLock, EARLY_LOCK_BUFFER_MS } from "./lock";

// Helper: a UTC Date for an ET wall-clock time (EDT, UTC-4, applies Sep–Oct).
const edt = (iso: string) => new Date(`${iso}-04:00`);

describe("computeLock (docs/02 §4)", () => {
  it("normal week: Thursday 3:00 PM ET default (TNF at 8:15 PM doesn't trigger early)", () => {
    // Week 2, 2026-style slate: Thu Sep 17 8:15 PM ET, Sun/Mon games after.
    const { lockAt, lockSource } = computeLock([
      edt("2026-09-17T20:15:00"),
      edt("2026-09-20T13:00:00"),
      edt("2026-09-21T20:15:00"),
    ]);
    expect(lockSource).toBe("default");
    expect(lockAt.toISOString()).toBe(edt("2026-09-17T15:00:00").toISOString());
  });

  it("Week 1 2026: Wednesday opener triggers the early-game exception", () => {
    const wedKickoff = edt("2026-09-09T20:20:00");
    const { lockAt, lockSource } = computeLock([
      wedKickoff,
      edt("2026-09-13T13:00:00"),
    ]);
    expect(lockSource).toBe("early_game");
    expect(lockAt.getTime()).toBe(wedKickoff.getTime() - EARLY_LOCK_BUFFER_MS);
  });

  it("Thanksgiving-style 12:30 PM Thursday kickoff also locks early", () => {
    const earlyThu = new Date("2026-11-26T12:30:00-05:00"); // EST by then
    const { lockAt, lockSource } = computeLock([
      earlyThu,
      new Date("2026-11-29T13:00:00-05:00"),
    ]);
    expect(lockSource).toBe("early_game");
    expect(lockAt.getTime()).toBe(earlyThu.getTime() - EARLY_LOCK_BUFFER_MS);
  });

  it("weekend-only slate still locks the prior Thursday 3 PM ET", () => {
    const { lockAt, lockSource } = computeLock([
      edt("2026-09-20T13:00:00"), // Sunday
      edt("2026-09-21T20:15:00"), // Monday
    ]);
    expect(lockSource).toBe("default");
    expect(lockAt.toISOString()).toBe(edt("2026-09-17T15:00:00").toISOString());
  });

  it("throws on empty input", () => {
    expect(() => computeLock([])).toThrow();
  });
});
