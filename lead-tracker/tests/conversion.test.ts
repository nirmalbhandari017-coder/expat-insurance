import { describe, it, expect } from "vitest";
import {
  convertedCount,
  decidedCount,
  conversionRate,
  decidedPct,
  retentionRate,
  formatPct,
} from "@/lib/domain/conversion";

// Mirrors the seeded Bangkok Relocation figures verified against mv_affiliate_stats.
const bangkok = {
  inbound: 2,
  account_pending: 1,
  account_open: 1,
  account_lapsed: 1,
  lost: 1,
};

describe("conversion metrics", () => {
  it("converted = open + lapsed", () => {
    expect(convertedCount(bangkok)).toBe(2);
  });
  it("decided = converted + lost (excludes stages 1–4)", () => {
    expect(decidedCount(bangkok)).toBe(3);
  });
  it("conversion_rate = converted / decided", () => {
    expect(conversionRate(bangkok)).toBeCloseTo(2 / 3, 6);
  });
  it("retention_rate = open / converted (Lost vs Lapsed distinction)", () => {
    expect(retentionRate(bangkok)).toBeCloseTo(0.5, 6);
  });
  it("decided_pct guards the stuck-junk blind spot", () => {
    // 3 decided of 6 total
    expect(decidedPct(bangkok)).toBeCloseTo(0.5, 6);
  });
});

describe("edge cases", () => {
  it("returns null (not 0%) when nothing decided", () => {
    expect(conversionRate({ inbound: 5, contacted: 2 })).toBeNull();
    expect(retentionRate({ inbound: 5 })).toBeNull();
    expect(decidedPct({})).toBeNull();
  });
  it("all lost => 0% conversion, null retention", () => {
    expect(conversionRate({ lost: 4 })).toBe(0);
    expect(retentionRate({ lost: 4 })).toBeNull();
  });
  it("all open => 100% conversion and retention", () => {
    expect(conversionRate({ account_open: 3 })).toBe(1);
    expect(retentionRate({ account_open: 3 })).toBe(1);
  });
  it("formatPct handles null", () => {
    expect(formatPct(null)).toBe("—");
    expect(formatPct(2 / 3)).toBe("66.7%");
  });
});
