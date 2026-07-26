"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { requireAppUser } from "@/lib/auth";
import { ok, fail, messageFromError, type ActionResult } from "./_result";
import type { Enums } from "@/types/database";

async function requireAdmin() {
  const user = await requireAppUser();
  if (user.role !== "admin") throw new Error("Admin only");
  return user;
}

export async function setUserRole(userId: string, role: Enums<"user_role">): Promise<ActionResult> {
  try {
    const admin = await requireAdmin();
    if (admin.id === userId && role !== "admin") return fail("You can't remove your own admin role.");
    const supabase = await createClient();
    const { error } = await supabase.from("app_users").update({ role }).eq("id", userId);
    if (error) return fail(messageFromError(error));
    revalidatePath("/settings");
    return ok(undefined);
  } catch (e) {
    return fail(messageFromError(e));
  }
}

export async function setUserRm(userId: string, isRm: boolean): Promise<ActionResult> {
  try {
    await requireAdmin();
    const supabase = await createClient();
    const { error } = await supabase.from("app_users").update({ is_rm: isRm }).eq("id", userId);
    if (error) return fail(messageFromError(error));
    revalidatePath("/settings");
    return ok(undefined);
  } catch (e) {
    return fail(messageFromError(e));
  }
}

export async function updateNotificationRule(
  id: string,
  patch: { threshold_days?: number | null; is_active?: boolean; notify_assigned_rm?: boolean },
): Promise<ActionResult> {
  try {
    await requireAdmin();
    const supabase = await createClient();
    const { error } = await supabase.from("notification_rules").update(patch).eq("id", id);
    if (error) return fail(messageFromError(error));
    revalidatePath("/settings");
    return ok(undefined);
  } catch (e) {
    return fail(messageFromError(e));
  }
}
