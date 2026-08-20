import type { Enums } from "@/types/database";

export type Role = Enums<"user_role">;
export type Scope = "all" | "own" | "none";

export type Resource =
  | "leads"
  | "affiliates"
  | "generators"
  | "brokers"
  | "products"
  | "documents"
  | "comments"
  | "tags"
  | "imports"
  | "reports"
  | "notification_rules"
  | "audit";

export type Action = "create" | "read" | "update" | "delete" | "export" | "export_pii";

export interface PermissionRow {
  role: Role;
  resource: string;
  action: string;
  allowed: boolean;
  scope: Scope;
}

// A fast lookup built once from the role_permissions table.
export type PermissionMatrix = Map<string, { allowed: boolean; scope: Scope }>;

const key = (role: Role, resource: string, action: string) => `${role}:${resource}:${action}`;

export function buildMatrix(rows: PermissionRow[]): PermissionMatrix {
  const m: PermissionMatrix = new Map();
  for (const r of rows) {
    m.set(key(r.role, r.resource, r.action), { allowed: r.allowed, scope: r.scope });
  }
  return m;
}

/** True if `role` may perform `action` on `resource`. Mirrors has_perm() in SQL. */
export function can(
  matrix: PermissionMatrix,
  role: Role,
  resource: Resource,
  action: Action,
): boolean {
  return matrix.get(key(role, resource, action))?.allowed ?? false;
}

/** 'all' | 'own' | 'none'. Mirrors perm_scope() in SQL. */
export function scopeOf(
  matrix: PermissionMatrix,
  role: Role,
  resource: Resource,
  action: Action,
): Scope {
  const hit = matrix.get(key(role, resource, action));
  return hit?.allowed ? hit.scope : "none";
}

/**
 * Convenience: can this role edit a lead, given ownership? Mirrors leads_update
 * RLS, where 'own' now resolves through brokers.app_user_id.
 */
export function canEditLead(
  matrix: PermissionMatrix,
  role: Role,
  opts: { brokerIsSelf: boolean },
): boolean {
  const scope = scopeOf(matrix, role, "leads", "update");
  if (scope === "all") return true;
  if (scope === "own") return opts.brokerIsSelf;
  return false;
}

export const ROLE_LABEL: Record<Role, string> = {
  admin: "Admin",
  business_development: "Business Development",
  // Internal Client Relationship Manager — the person who works assigned leads.
  rm_staff: "CRM",
  read_only: "Read Only",
  source: "Source (external)",
  // Deprecated: CRMs are internal, so `rm_staff` above is the CRM role. Kept
  // only so existing rows still render; not offered when assigning a role.
  crm: "CRM (deprecated)",
};

/** Roles an admin can assign. Excludes the deprecated external `crm`. */
export const ASSIGNABLE_ROLES: Role[] = [
  "admin",
  "business_development",
  "rm_staff",
  "read_only",
  "source",
];

// Internal staff roles (full app). External roles (source/crm) are restricted.
export const INTERNAL_ROLES: Role[] = ["admin", "business_development", "rm_staff", "read_only"];
export function isInternalRole(role: Role): boolean {
  return INTERNAL_ROLES.includes(role);
}
