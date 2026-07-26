import { formatDistanceToNowStrict, format, differenceInCalendarDays } from "date-fns";

export function relativeAge(iso: string | null): string {
  if (!iso) return "—";
  return formatDistanceToNowStrict(new Date(iso), { addSuffix: false })
    .replace(" seconds", "s").replace(" second", "s")
    .replace(" minutes", "m").replace(" minute", "m")
    .replace(" hours", "h").replace(" hour", "h")
    .replace(" days", "d").replace(" day", "d")
    .replace(" months", "mo").replace(" month", "mo")
    .replace(" years", "y").replace(" year", "y");
}

export function shortDate(iso: string | null): string {
  if (!iso) return "—";
  return format(new Date(iso), "d MMM yyyy");
}

export function daysBetween(a: string | null, b: string | null): number | null {
  if (!a || !b) return null;
  return differenceInCalendarDays(new Date(b), new Date(a));
}

export function ageDays(iso: string | null): number | null {
  if (!iso) return null;
  return differenceInCalendarDays(new Date(), new Date(iso));
}
