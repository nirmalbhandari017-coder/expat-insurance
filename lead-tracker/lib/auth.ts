import "server-only";
import { cache } from "react";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import {
  buildMatrix,
  can,
  scopeOf,
  type PermissionMatrix,
  type PermissionRow,
  type Resource,
  type Action,
} from "@/lib/domain/permissions";
import type { Tables } from "@/types/database";

export type AppUser = Tables<"app_users">;

// Cached per request. Returns the linked app_users row for the signed-in user.
export const getAppUser = cache(async (): Promise<AppUser | null> => {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;

  const { data } = await supabase
    .from("app_users")
    .select("*")
    .eq("auth_user_id", user.id)
    .is("deleted_at", null)
    .maybeSingle();

  return data ?? null;
});

export const getPermissionMatrix = cache(async (): Promise<PermissionMatrix> => {
  const supabase = await createClient();
  const { data } = await supabase.from("role_permissions").select("*");
  return buildMatrix((data ?? []) as PermissionRow[]);
});

// Route/action guard: throws (redirects) if not signed in or unlinked.
export async function requireAppUser(): Promise<AppUser> {
  const user = await getAppUser();
  if (!user) redirect("/login");
  return user;
}

// For server actions: assert a permission before doing work. RLS is still the
// enforcing authority; this gives fast, friendly errors and audit clarity.
export async function requirePermission(resource: Resource, action: Action): Promise<AppUser> {
  const user = await requireAppUser();
  const matrix = await getPermissionMatrix();
  if (!can(matrix, user.role, resource, action)) {
    throw new Error(`Not authorized: ${action} ${resource}`);
  }
  return user;
}

export async function permissionScope(resource: Resource, action: Action) {
  const user = await requireAppUser();
  const matrix = await getPermissionMatrix();
  return scopeOf(matrix, user.role, resource, action);
}
