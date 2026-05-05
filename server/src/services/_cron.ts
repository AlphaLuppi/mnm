/**
 * Cron parser + DST-aware tick computation.
 *
 * Extracted from `routines.ts` (Phase 2 of WORKFLOW-TRIGGERS) so that both
 * the routine scheduler and the unified workflow_triggers scheduler can
 * share a single, well-tested implementation.
 *
 * Supports the canonical 5-field POSIX cron format:
 *   minute hour day-of-month month day-of-week
 *
 * Each field accepts: `*`, ranges (`1-5`), lists (`1,3,5`), and step
 * notation (`* / 5`, `9-17/2`). Timezone resolution uses
 * `Intl.DateTimeFormat`, so DST transitions are handled by the runtime
 * tz database rather than a custom offset table.
 */
import { badRequest, unprocessable } from "../errors.js";

interface CronFields {
  minutes: number[];
  hours: number[];
  daysOfMonth: number[];
  months: number[];
  daysOfWeek: number[];
}

function parseCronField(field: string, min: number, max: number): number[] {
  const values = new Set<number>();

  for (const part of field.split(",")) {
    const stepParts = part.split("/");
    const rangePart = stepParts[0]!;
    const step = stepParts[1] ? parseInt(stepParts[1], 10) : 1;

    let start: number;
    let end: number;

    if (rangePart === "*") {
      start = min;
      end = max;
    } else if (rangePart.includes("-")) {
      const [lo, hi] = rangePart.split("-");
      start = parseInt(lo!, 10);
      end = parseInt(hi!, 10);
    } else {
      start = parseInt(rangePart, 10);
      end = start;
    }

    if (isNaN(start) || isNaN(end) || isNaN(step)) continue;
    start = Math.max(start, min);
    end = Math.min(end, max);

    for (let i = start; i <= end; i += step) {
      values.add(i);
    }
  }

  return [...values].sort((a, b) => a - b);
}

export function parseCron(expression: string): CronFields {
  const parts = expression.trim().split(/\s+/);
  if (parts.length !== 5) {
    throw badRequest(`Invalid cron expression: expected 5 fields, got ${parts.length}`);
  }
  return {
    minutes: parseCronField(parts[0]!, 0, 59),
    hours: parseCronField(parts[1]!, 0, 23),
    daysOfMonth: parseCronField(parts[2]!, 1, 31),
    months: parseCronField(parts[3]!, 1, 12),
    daysOfWeek: parseCronField(parts[4]!, 0, 6),
  };
}

/**
 * Convert a Date to the components in a given timezone using Intl.DateTimeFormat.
 */
function dateInTz(date: Date, timezone: string) {
  const fmt = new Intl.DateTimeFormat("en-US", {
    timeZone: timezone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false,
  });
  const parts = Object.fromEntries(
    fmt.formatToParts(date).map((p) => [p.type, p.value]),
  );
  return {
    year: parseInt(parts.year!, 10),
    month: parseInt(parts.month!, 10),
    day: parseInt(parts.day!, 10),
    hour: parseInt(parts.hour!, 10),
    minute: parseInt(parts.minute!, 10),
    second: parseInt(parts.second!, 10),
  };
}

/**
 * Create a Date from components in a given timezone.
 */
function dateFromTz(
  year: number,
  month: number,
  day: number,
  hour: number,
  minute: number,
  second: number,
  timezone: string,
): Date {
  // Build an ISO-ish string and use the tz offset to invert
  const isoBase = `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}T${String(hour).padStart(2, "0")}:${String(minute).padStart(2, "0")}:${String(second).padStart(2, "0")}`;

  // Estimate: create a date in UTC, then adjust by the offset
  const estimateUtc = new Date(`${isoBase}Z`);
  const inTz = dateInTz(estimateUtc, timezone);
  const offsetMinutes =
    (inTz.hour * 60 + inTz.minute) - (estimateUtc.getUTCHours() * 60 + estimateUtc.getUTCMinutes());
  const adjusted = new Date(estimateUtc.getTime() - offsetMinutes * 60_000);

  // Verify and correct (DST edge cases)
  const check = dateInTz(adjusted, timezone);
  if (check.hour !== hour || check.minute !== minute) {
    const delta = (hour - check.hour) * 60 + (minute - check.minute);
    return new Date(adjusted.getTime() + delta * 60_000);
  }
  return adjusted;
}

/**
 * Compute the next cron tick strictly after `after` in the given timezone.
 * Searches forward up to 366 days.
 */
export function nextCronTick(
  expression: string,
  timezone: string,
  after: Date = new Date(),
): Date {
  const cron = parseCron(expression);
  const maxIterations = 366 * 24 * 60; // safety cap
  const tz = dateInTz(after, timezone);

  let year = tz.year;
  let month = tz.month;
  let day = tz.day;
  let hour = tz.hour;
  let minute = tz.minute + 1; // strictly after

  for (let i = 0; i < maxIterations; i++) {
    // Normalize overflow
    if (minute > 59) {
      minute = 0;
      hour++;
    }
    if (hour > 23) {
      hour = 0;
      day++;
    }
    const daysInMonth = new Date(year, month, 0).getDate();
    if (day > daysInMonth) {
      day = 1;
      month++;
    }
    if (month > 12) {
      month = 1;
      year++;
    }

    // Check month
    if (!cron.months.includes(month)) {
      day = 1;
      hour = 0;
      minute = 0;
      month++;
      continue;
    }

    // Check day of month
    if (!cron.daysOfMonth.includes(day)) {
      hour = 0;
      minute = 0;
      day++;
      continue;
    }

    // Check day of week
    const candidate = dateFromTz(year, month, day, hour, minute, 0, timezone);
    const candidateDow = candidate.getDay();
    if (!cron.daysOfWeek.includes(candidateDow)) {
      hour = 0;
      minute = 0;
      day++;
      continue;
    }

    // Check hour
    if (!cron.hours.includes(hour)) {
      minute = 0;
      hour++;
      continue;
    }

    // Check minute
    if (!cron.minutes.includes(minute)) {
      minute++;
      continue;
    }

    // All fields match — build the final date
    const result = dateFromTz(year, month, day, hour, minute, 0, timezone);
    if (result.getTime() > after.getTime()) {
      return result;
    }
    // Edge case: DST made us not actually be after `after`
    minute++;
  }

  throw unprocessable("Could not compute next cron tick within 366 days");
}
