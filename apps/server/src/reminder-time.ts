import { Temporal } from "@js-temporal/polyfill";

export const DEFAULT_REMINDER_TIME = "09:00";

export function gardenTimezone(): string {
  return process.env.GARDEN_TIMEZONE || "America/Los_Angeles";
}

export function reminderInstant(date: string, time = DEFAULT_REMINDER_TIME, timezone = gardenTimezone()): string {
  try {
    const instant = Temporal.PlainDate.from(date)
      .toZonedDateTime({
        timeZone: timezone,
        plainTime: Temporal.PlainTime.from(time),
      })
      .toInstant();
    return new Date(Number(instant.epochMilliseconds)).toISOString();
  } catch {
    throw new Error("Invalid reminder date, time, or IANA timezone");
  }
}
