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

// Link an external login to a Source (affiliate). Also sets the user's role to
// 'source' and ensures a login is linked to at most one Source/CRM. Pass
// appUserId=null to unlink.
export async function linkSourceLogin(affiliateId: string, appUserId: string | null): Promise<ActionResult> {
  try {
    const admin = await requireAdmin();
    const supabase = await createClient();
    if (appUserId) {
      if (appUserId === admin.id) return fail("You can't turn your own admin account into an external login.");
      // one login -> one entity: clear any prior links for this user
      await supabase.from("affiliates").update({ app_user_id: null }).eq("app_user_id", appUserId);
      await supabase.from("brokers").update({ app_user_id: null }).eq("app_user_id", appUserId);
      // clear whoever was on this affiliate, then link + set role
      await supabase.from("affiliates").update({ app_user_id: null }).eq("id", affiliateId);
      const { error } = await supabase.from("affiliates").update({ app_user_id: appUserId }).eq("id", affiliateId);
      if (error) return fail(messageFromError(error));
      const { error: rErr } = await supabase.from("app_users").update({ role: "source" }).eq("id", appUserId);
      if (rErr) return fail(messageFromError(rErr));
    } else {
      const { error } = await supabase.from("affiliates").update({ app_user_id: null }).eq("id", affiliateId);
      if (error) return fail(messageFromError(error));
    }
    revalidatePath("/settings");
    return ok(undefined);
  } catch (e) {
    return fail(messageFromError(e));
  }
}

// Link a login to a CRM (broker) record. CRMs are internal staff, so this sets
// the internal 'rm_staff' role — which is labelled "CRM" in the UI.
export async function linkCrmLogin(brokerId: string, appUserId: string | null): Promise<ActionResult> {
  try {
    const admin = await requireAdmin();
    const supabase = await createClient();
    if (appUserId) {
      if (appUserId === admin.id) return fail("You can't turn your own admin account into an external login.");
      await supabase.from("affiliates").update({ app_user_id: null }).eq("app_user_id", appUserId);
      await supabase.from("brokers").update({ app_user_id: null }).eq("app_user_id", appUserId);
      await supabase.from("brokers").update({ app_user_id: null }).eq("id", brokerId);
      const { error } = await supabase.from("brokers").update({ app_user_id: appUserId }).eq("id", brokerId);
      if (error) return fail(messageFromError(error));
      const { error: rErr } = await supabase
        .from("app_users")
        .update({ role: "rm_staff", is_rm: true })
        .eq("id", appUserId);
      if (rErr) return fail(messageFromError(rErr));
    } else {
      const { error } = await supabase.from("brokers").update({ app_user_id: null }).eq("id", brokerId);
      if (error) return fail(messageFromError(error));
    }
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
