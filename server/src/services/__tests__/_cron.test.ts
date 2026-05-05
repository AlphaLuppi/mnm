import { describe, it, expect } from "vitest";
import { nextCronTick, parseCron } from "../_cron.js";

describe("_cron / parseCron", () => {
  it("parses '*/5 * * * *' as every 5 minutes", () => {
    const cron = parseCron("*/5 * * * *");
    expect(cron.minutes).toEqual([0, 5, 10, 15, 20, 25, 30, 35, 40, 45, 50, 55]);
    expect(cron.hours).toHaveLength(24);
    expect(cron.daysOfMonth).toHaveLength(31);
    expect(cron.months).toHaveLength(12);
    expect(cron.daysOfWeek).toHaveLength(7);
  });

  it("parses ranges and lists", () => {
    const cron = parseCron("0 9-17 * * 1,3,5");
    expect(cron.minutes).toEqual([0]);
    expect(cron.hours).toEqual([9, 10, 11, 12, 13, 14, 15, 16, 17]);
    expect(cron.daysOfWeek).toEqual([1, 3, 5]);
  });

  it("rejects an expression with the wrong arity", () => {
    expect(() => parseCron("0 0 * *")).toThrow(/expected 5 fields/i);
    expect(() => parseCron("0 0 0 0 0 0")).toThrow(/expected 5 fields/i);
  });
});

describe("_cron / nextCronTick", () => {
  it("returns the next minute after `after` for '* * * * *'", () => {
    const after = new Date("2026-05-04T12:00:30Z");
    const next = nextCronTick("* * * * *", "UTC", after);
    expect(next.toISOString()).toBe("2026-05-04T12:01:00.000Z");
  });

  it("returns the next 5-minute boundary for '*/5 * * * *'", () => {
    const after = new Date("2026-05-04T12:01:30Z");
    const next = nextCronTick("*/5 * * * *", "UTC", after);
    expect(next.toISOString()).toBe("2026-05-04T12:05:00.000Z");
  });

  it("respects timezone for hourly schedule", () => {
    const after = new Date("2026-05-04T12:30:00Z");
    const next = nextCronTick("0 9 * * *", "Europe/Paris", after);
    // 09:00 Paris (CEST = UTC+2 in May) = 07:00 UTC. Already past on the 4th,
    // so the next tick is 5th 09:00 Paris = 5th 07:00 UTC.
    expect(next.toISOString()).toBe("2026-05-05T07:00:00.000Z");
  });

  it("strictly returns a tick after `after` (never equal)", () => {
    const exactly = new Date("2026-05-04T12:00:00Z");
    const next = nextCronTick("* * * * *", "UTC", exactly);
    expect(next.getTime()).toBeGreaterThan(exactly.getTime());
  });
});
