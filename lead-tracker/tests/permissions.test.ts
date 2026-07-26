import { describe, it, expect } from "vitest";
import {
  buildMatrix,
  can,
  scopeOf,
  canEditLead,
  type PermissionRow,
} from "@/lib/domain/permissions";

// A representative slice of the seeded role_permissions matrix.
const rows: PermissionRow[] = [
  { role: "admin", resource: "leads", action: "update", allowed: true, scope: "all" },
  { role: "admin", resource: "leads", action: "export_pii", allowed: true, scope: "all" },
  { role: "business_development", resource: "leads", action: "update", allowed: true, scope: "all" },
  { role: "business_development", resource: "leads", action: "export_pii", allowed: true, scope: "all" },
  { role: "rm_staff", resource: "leads", action: "read", allowed: true, scope: "own" },
  { role: "rm_staff", resource: "leads", action: "update", allowed: true, scope: "own" },
  { role: "read_only", resource: "leads", action: "read", allowed: true, scope: "all" },
  { role: "read_only", resource: "leads", action: "export", allowed: true, scope: "all" },
];

const m = buildMatrix(rows);

describe("can()", () => {
  it("admin and BD can export PII, others cannot", () => {
    expect(can(m, "admin", "leads", "export_pii")).toBe(true);
    expect(can(m, "business_development", "leads", "export_pii")).toBe(true);
    expect(can(m, "rm_staff", "leads", "export_pii")).toBe(false);
    expect(can(m, "read_only", "leads", "export_pii")).toBe(false);
  });
  it("unknown permission defaults to deny", () => {
    expect(can(m, "read_only", "leads", "update")).toBe(false);
    expect(can(m, "rm_staff", "imports", "create")).toBe(false);
  });
});

describe("scopeOf()", () => {
  it("RM leads are own-scoped, admin all-scoped", () => {
    expect(scopeOf(m, "rm_staff", "leads", "read")).toBe("own");
    expect(scopeOf(m, "admin", "leads", "update")).toBe("all");
    expect(scopeOf(m, "read_only", "leads", "update")).toBe("none");
  });
});

describe("canEditLead() — mirrors leads_update RLS", () => {
  it("admin edits any lead", () => {
    expect(canEditLead(m, "admin", { brokerIsSelf: false })).toBe(true);
  });
  it("RM edits only their own assigned lead", () => {
    expect(canEditLead(m, "rm_staff", { brokerIsSelf: true })).toBe(true);
    expect(canEditLead(m, "rm_staff", { brokerIsSelf: false })).toBe(false);
  });
  it("read-only cannot edit even their own", () => {
    expect(canEditLead(m, "read_only", { brokerIsSelf: true })).toBe(false);
  });
});
