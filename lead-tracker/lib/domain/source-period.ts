import { startOfMonth, endOfMonth, subMonths, format } from "date-fns";

// Source reporting date filter (spec §8): This month / Previous month / Custom.
// Ranges are on payment_date (= policy placed date), returned as YYYY-MM-DD.
export type SourceMode = "this_month" | "prev_month" | "custom";

export function isSourceMode(v: string | null | undefined): v is SourceMode {
  return v === "this_month" || v === "prev_month" || v === "custom";
}

// Format in LOCAL time — payment_date is a DATE, so a UTC shift would move the
// month boundary by a day in tz's like +07.
const day = (d: Date) => format(d, "yyyy-MM-dd");

export function sourcePeriod(
  mode: SourceMode,
  now: Date = new Date(),
  from?: string,
  to?: string,
): { fromISO: string; toISO: string; label: string } {
  if (mode === "prev_month") {
    const d = subMonths(now, 1);
    return { fromISO: day(startOfMonth(d)), toISO: day(endOfMonth(d)), label: "Previous month" };
  }
  if (mode === "custom" && from && to) {
    return { fromISO: from, toISO: to, label: "Custom range" };
  }
  return { fromISO: day(startOfMonth(now)), toISO: day(endOfMonth(now)), label: "This month" };
}
