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
      status: ["inbound", "contacted"],
      lostReason: "too_expensive",
      createdFrom: "2026-01-01",
    };
    const qs = serializeFilters(f);
    const back = parseFilters(new URLSearchParams(qs));
    expect(back.q).toBe("grant");
    expect(back.affiliate).toBe(f.affiliate);
    expect(back.status?.sort()).toEqual(["contacted", "inbound"]);
    expect(back.lostReason).toBe("too_expensive");
    expect(back.createdFrom).toBe("2026-01-01");
  });

  it("is deterministic regardless of key/array order (stable share links)", () => {
    const a = serializeFilters({ status: ["contacted", "inbound"], q: "x" });
    const b = serializeFilters({ q: "x", status: ["inbound", "contacted"] });
    expect(a).toBe(b);
  });

  it("omits empty values", () => {
    const qs = serializeFilters({ q: "", affiliate: undefined, status: [] });
    expect(qs).toBe("");
  });

  it("countActiveFilters ignores sort", () => {
    expect(countActiveFilters({ sort: "-updated_at" })).toBe(0);
    expect(countActiveFilters({ status: ["lost"], q: "a", sort: "-x" })).toBe(2);
  });
});
