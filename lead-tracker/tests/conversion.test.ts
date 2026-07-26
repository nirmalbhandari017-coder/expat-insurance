import { describe, it, expect } from "vitest";
import {
  convertedCount,
  decidedCount,
  conversionRate,
  decidedPct,
  renewalRate,
  formatPct,
  type StageCounts,
} from "@/lib/domain/conversion";

/**
 * In the new model a lost lead keeps the stage it died at, so `lost` is passed
 * alongside the stage counts rather than being one of them.
 */
const bangkok: StageCounts = {
  qualified: 2,
  application_received: 1,
  policy_issued: 1,
  renewal: 1,
};
const bangkokLost = 1;

describe("conversion metrics", () => {
  it("counts a live policy (issued or renewing) as converted", () => {
    expect(convertedCount(bangkok)).toBe(2);
  });

  it("counts decided as converted + lost", () => {
    expect(decidedCount(bangkok, bangkokLost)).toBe(3);
  });

  it("computes conversion as converted / decided", () => {
    expect(conversionRate(bangkok, bangkokLost)).toBeCloseTo(2 / 3, 5);
  });

  it("returns null rather than a misleading 0% when nothing is decided", () => {
    expect(conversionRate({ qualified: 4 }, 0)).toBeNull();
    expect(decidedPct({}, 0)).toBeNull();
    expect(renewalRate({ qualified: 3 })).toBeNull();
  });

  it("reports the share of leads that reached a decided state", () => {
    // 5 stage rows + 1 lost = 6 total, of which 3 are decided.
    expect(decidedPct(bangkok, bangkokLost)).toBeCloseTo(3 / 6, 5);
  });

  it("computes renewal rate as renewals / converted", () => {
    expect(renewalRate(bangkok)).toBeCloseTo(1 / 2, 5);
  });

  it("treats a lost-only affiliate as 0% converted, not null", () => {
    expect(conversionRate({}, 3)).toBe(0);
  });
});

describe("formatPct", () => {
  it("renders a dash for null so empty cells don't read as zero", () => {
    expect(formatPct(null)).toBe("—");
  });

  it("formats to one decimal by default", () => {
    expect(formatPct(0.6667)).toBe("66.7%");
    expect(formatPct(1)).toBe("100.0%");
    expect(formatPct(0, 0)).toBe("0%");
  });
});
