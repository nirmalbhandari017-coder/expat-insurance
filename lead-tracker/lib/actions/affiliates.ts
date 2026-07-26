"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { requirePermission } from "@/lib/auth";
import { affiliateSchema, affiliateUpdateSchema } from "@/lib/schemas/affiliate";
import { ok, fail, messageFromError, type ActionResult } from "./_result";
import type { Tables, TablesUpdate } from "@/types/database";

type Affiliate = Tables<"affiliates">;

export async function createAffiliate(raw: unknown): Promise<ActionResult<Affiliate>> {
  try {
    await requirePermission("affiliates", "create");
    const parsed = affiliateSchema.safeParse(raw);
    if (!parsed.success) return fail("Please fix the highlighted fields", parsed.error.flatten().fieldErrors);
    const d = parsed.data;
    const supabase = await createClient();
    const { data, error } = await supabase
      .from("affiliates")
      .insert({
        name: d.name,
        contact_person: d.contactPerson ?? null,
        email: d.email ?? null,
        phone: d.phone ?? null,
        commission_pct: d.commissionPct ?? null,
        type: d.type,
        country: d.country ?? null,
        external_ref: d.externalRef ?? null,
        is_active: d.isActive,
        notes: d.notes ?? null,
      })
      .select("*")
      .single();
    if (error) return fail(messageFromError(error));
    revalidatePath("/affiliates");
    return ok(data);
  } catch (e) {
    return fail(messageFromError(e));
  }
}

export async function updateAffiliate(raw: unknown): Promise<ActionResult<Affiliate>> {
  try {
    await requirePermission("affiliates", "update");
    const parsed = affiliateUpdateSchema.safeParse(raw);
    if (!parsed.success) return fail("Please fix the highlighted fields", parsed.error.flatten().fieldErrors);
    const d = parsed.data;
    const supabase = await createClient();

    const patch: TablesUpdate<"affiliates"> = {};
    if (d.name !== undefined) patch.name = d.name;
    if (d.contactPerson !== undefined) patch.contact_person = d.contactPerson ?? null;
    if (d.email !== undefined) patch.email = d.email ?? null;
    if (d.phone !== undefined) patch.phone = d.phone ?? null;
    if (d.commissionPct !== undefined) patch.commission_pct = d.commissionPct;
    if (d.type !== undefined) patch.type = d.type;
    if (d.country !== undefined) patch.country = d.country ?? null;
    if (d.externalRef !== undefined) patch.external_ref = d.externalRef ?? null;
    if (d.isActive !== undefined) patch.is_active = d.isActive;
    if (d.notes !== undefined) patch.notes = d.notes ?? null;

    const { data, error } = await supabase.from("affiliates").update(patch).eq("id", d.id).select("*").single();
    if (error) return fail(messageFromError(error));
    revalidatePath("/affiliates");
    revalidatePath(`/affiliates/${d.id}`);
    return ok(data);
  } catch (e) {
    return fail(messageFromError(e));
  }
}

export async function setAffiliateActive(id: string, isActive: boolean): Promise<ActionResult> {
  try {
    await requirePermission("affiliates", "update");
    const supabase = await createClient();
    const { error } = await supabase.from("affiliates").update({ is_active: isActive }).eq("id", id);
    if (error) return fail(messageFromError(error));
    revalidatePath("/affiliates");
    return ok(undefined);
  } catch (e) {
    return fail(messageFromError(e));
  }
}

export async function deleteAffiliate(id: string): Promise<ActionResult> {
  try {
    await requirePermission("affiliates", "delete"); // admin only per the matrix
    const supabase = await createClient();
    // Never orphan leads: block delete if any live lead references this affiliate.
    const { count } = await supabase
      .from("leads")
      .select("id", { count: "exact", head: true })
      .eq("affiliate_id", id)
      .is("deleted_at", null);
    if ((count ?? 0) > 0) {
      return fail(`This affiliate has ${count} lead(s). Deactivate it instead of deleting.`);
    }
    const { error } = await supabase.from("affiliates").update({ deleted_at: new Date().toISOString() }).eq("id", id);
    if (error) return fail(messageFromError(error));
    revalidatePath("/affiliates");
    return ok(undefined);
  } catch (e) {
    return fail(messageFromError(e));
  }
}

export async function togglePinAffiliate(affiliateId: string, pin: boolean): Promise<ActionResult> {
  try {
    const supabase = await createClient();
    const { data: me } = await supabase.rpc("current_app_user_id");
    if (!me) return fail("Not signed in");
    if (pin) {
      const { error } = await supabase.from("pinned_affiliates").insert({ user_id: me, affiliate_id: affiliateId });
      if (error && error.code !== "23505") return fail(messageFromError(error));
    } else {
      const { error } = await supabase.from("pinned_affiliates").delete().eq("user_id", me).eq("affiliate_id", affiliateId);
      if (error) return fail(messageFromError(error));
    }
    revalidatePath("/affiliates");
    return ok(undefined);
  } catch (e) {
    return fail(messageFromError(e));
  }
}
