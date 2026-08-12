import { describe, it, expect } from "vitest";
import { startOfYear, startOfMonth, startOfWeek } from "date-fns";
import { isPeriod, periodRange } from "@/lib/domain/period";
import { isSourceMode, sourcePeriod } from "@/lib/domain/source-period";
import { isInternalRole } from "@/lib/domain/permissions";

describe("dashboard period (spec §1)", () => {
  const now = new Date("2026-08-12T10:00:00Z");
  it("validates period strings", () => {
    expect(isPeriod("ytd")).toBe(true);
    expect(isPeriod("month")).toBe(true);
    expect(isPeriod("week")).toBe(true);
    expect(isPeriod("nope")).toBe(false);
    expect(isPeriod(undefined)).toBe(false);
  });
  // Compare instants (timezone-invariant) rather than UTC date strings.
  it("YTD starts at the start of the current year", () => {
    const r = periodRange("ytd", now);
    expect(new Date(r.fromISO).getTime()).toBe(startOfYear(now).getTime());
    expect(new Date(r.toISO).getTime()).toBe(now.getTime());
  });
  it("Monthly starts at the start of the current month", () => {
    const r = periodRange("month", now);
    expect(new Date(r.fromISO).getTime()).toBe(startOfMonth(now).getTime());
  });
  it("Weekly starts on Monday of the current week", () => {
    const r = periodRange("week", now);
    expect(new Date(r.fromISO).getTime()).toBe(startOfWeek(now, { weekStartsOn: 1 }).getTime());
  });
});

describe("source reporting period (spec §8)", () => {
  const now = new Date("2026-08-12T10:00:00Z");
  it("validates modes", () => {
    expect(isSourceMode("this_month")).toBe(true);
    expect(isSourceMode("prev_month")).toBe(true);
    expect(isSourceMode("custom")).toBe(true);
    expect(isSourceMode("x")).toBe(false);
  });
  it("this month vs previous month", () => {
    expect(sourcePeriod("this_month", now).fromISO).toBe("2026-08-01");
    expect(sourcePeriod("this_month", now).toISO).toBe("2026-08-31");
    expect(sourcePeriod("prev_month", now).fromISO).toBe("2026-07-01");
    expect(sourcePeriod("prev_month", now).toISO).toBe("2026-07-31");
  });
  it("custom range passes through", () => {
    const r = sourcePeriod("custom", now, "2026-01-01", "2026-03-31");
    expect(r.fromISO).toBe("2026-01-01");
    expect(r.toISO).toBe("2026-03-31");
  });
});

describe("internal vs external roles (spec §11, §13)", () => {
  it("internal staff roles are internal", () => {
    expect(isInternalRole("admin")).toBe(true);
    expect(isInternalRole("business_development")).toBe(true);
    expect(isInternalRole("rm_staff")).toBe(true);
    expect(isInternalRole("read_only")).toBe(true);
  });
  it("Source and CRM are external", () => {
    expect(isInternalRole("source")).toBe(false);
    expect(isInternalRole("crm")).toBe(false);
  });
});
