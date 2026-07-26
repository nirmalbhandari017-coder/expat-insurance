import { describe, it, expect } from "vitest";
import {
  parseFilters,
  serializeFilters,
  countActiveFilters,
  type LeadFilters,
} from "@/lib/filters";

describe("filter URL codec", () => {
  it("round-trips a filter object", () => {
    const f: LeadFilters = {
      q: "grant",
      affiliate: "11111111-1111-1111-1111-111111111111",
      stage: ["qualified", "quote_sent"],
      opportunity: "lost",
      createdFrom: "2026-01-01",
    };
    const qs = serializeFilters(f);
    const back = parseFilters(new URLSearchParams(qs));
    expect(back.q).toBe("grant");
    expect(back.affiliate).toBe(f.affiliate);
    expect(back.stage?.sort()).toEqual(["qualified", "quote_sent"]);
    expect(back.opportunity).toBe("lost");
    expect(back.createdFrom).toBe("2026-01-01");
  });

  it("is deterministic regardless of key/array order (stable share links)", () => {
    const a = serializeFilters({ stage: ["quote_sent", "qualified"], q: "x" });
    const b = serializeFilters({ q: "x", stage: ["qualified", "quote_sent"] });
    expect(a).toBe(b);
  });

  it("omits empty values", () => {
    const qs = serializeFilters({ q: "", affiliate: undefined, stage: [] });
    expect(qs).toBe("");
  });

  it("countActiveFilters ignores sort", () => {
    expect(countActiveFilters({ sort: "-updated_at" })).toBe(0);
    expect(countActiveFilters({ stage: ["qualified"], q: "a", sort: "-x" })).toBe(2);
  });
});
