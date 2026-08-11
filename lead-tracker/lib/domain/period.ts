import { startOfYear, startOfMonth, startOfWeek, endOfMonth, endOfWeek } from "date-fns";

// Dashboard reporting periods (spec §1).
export type Period = "ytd" | "month" | "week";

export const PERIODS: { value: Period; label: string }[] = [
  { value: "ytd", label: "Year to date" },
  { value: "month", label: "This month" },
  { value: "week", label: "This week" },
];

export function isPeriod(v: string | null | undefined): v is Period {
  return v === "ytd" || v === "month" || v === "week";
}

// Half-open-ish range [fromISO, toISO]. Weeks are Monday-based (business week).
export function periodRange(period: Period, now: Date = new Date()): {
  fromISO: string;
  toISO: string;
  label: string;
} {
  switch (period) {
    case "month":
      return { fromISO: startOfMonth(now).toISOString(), toISO: endOfMonth(now).toISOString(), label: "This month" };
    case "week":
      return {
        fromISO: startOfWeek(now, { weekStartsOn: 1 }).toISOString(),
        toISO: endOfWeek(now, { weekStartsOn: 1 }).toISOString(),
        label: "This week",
      };
    case "ytd":
    default:
      return { fromISO: startOfYear(now).toISOString(), toISO: now.toISOString(), label: "Year to date" };
  }
}
