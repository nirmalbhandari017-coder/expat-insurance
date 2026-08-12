"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { requireAppUser, requirePermission } from "@/lib/auth";
import {
  leadCreateSchema,
  leadUpdateSchema,
  qualificationSchema,
  stageChangeSchema,
  markLostSchema,
  reopenSchema,
  bulkStageSchema,
  assignBrokerSchema,
  duplicateCheckSchema,
} from "@/lib/schemas/lead";
import { ok, fail, messageFromError, type ActionResult } from "./_result";
import type { Tables, TablesUpdate } from "@/types/database";
import type { DuplicateMatch } from "@/lib/types";

type Lead = Tables<"leads">;

/**
 * Duplicate detection (spec §22): warns, never blocks and never merges — the
 * same person legitimately arrives from two different affiliates, and silently
 * collapsing those rows would destroy the attribution this whole system exists
 * to measure. Matching runs in the DB so it uses the normalised phone/WhatsApp
 * columns and the trigram indexes.
 */
export async function findDuplicates(raw: unknown): Promise<DuplicateMatch[]> {
  await requireAppUser();
  const parsed = duplicateCheckSchema.safeParse(raw);
  if (!parsed.success) return [];
  const d = parsed.data;
  if (!d.email && !d.phone && !d.whatsapp && !(d.firstName && d.lastName && d.dateOfBirth)) {
    return [];
  }

  const supabase = await createClient();
  const { data, error } = await supabase.rpc("find_duplicate_leads", {
    p_email: d.email || undefined,
    p_phone: d.phone || undefined,
    p_whatsapp: d.whatsapp || undefined,
    p_first: d.firstName || undefined,
    p_last: d.lastName || undefined,
    p_dob: d.dateOfBirth || undefined,
    p_exclude: d.excludeId || undefined,
  });
  if (error) return [];
  return (data ?? []) as DuplicateMatch[];
}

/** Replace a lead's product set (many-to-many). */
async function syncProducts(
  supabase: Awaited<ReturnType<typeof createClient>>,
  leadId: string,
  productIds: string[],
) {
  await supabase.from("lead_products").delete().eq("lead_id", leadId);
  if (productIds.length) {
    await supabase
      .from("lead_products")
      .insert(productIds.map((product_id) => ({ lead_id: leadId, product_id })));
  }
}

export async function createLead(raw: unknown): Promise<ActionResult<Lead>> {
  try {
    await requirePermission("leads", "create");
    const parsed = leadCreateSchema.safeParse(raw);
    if (!parsed.success) {
      return fail("Please fix the highlighted fields", parsed.error.flatten().fieldErrors);
    }
    const d = parsed.data;
    const supabase = await createClient();

    const { data, error } = await supabase
      .from("leads")
      .insert({
        customer_name: `${d.firstName} ${d.lastName}`.trim(),
        title: d.title ?? null,
        first_name: d.firstName,
        last_name: d.lastName,
        date_of_birth: d.dateOfBirth,
        email: d.email ?? null,
        phone: d.phone ?? null,
        whatsapp_same_as_phone: d.whatsappSameAsPhone,
        whatsapp_phone: d.whatsappSameAsPhone ? (d.phone ?? null) : (d.whatsappPhone ?? null),
        nationality: d.nationality ?? null,
        country_of_residence: d.countryOfResidence,
        affiliate_id: d.affiliateId,
        generator_id: d.generatorId ?? null,
        broker_id: d.brokerId ?? null,
        qualification: d.qualification,
        stage: d.qualification === "qualified" ? (d.stage ?? "qualified") : null,
        notes: d.note ?? null,
        source_channel: d.sourceChannel,
      })
      .select("*")
      .single();

    if (error) return fail(messageFromError(error));

    await syncProducts(supabase, data.id, d.productIds);

    // The first note is stored as a real comment so it joins the notes thread
    // rather than being trapped in the legacy free-text field.
    if (d.note) {
      const { data: me } = await supabase.rpc("current_app_user_id");
      if (me) await supabase.from("comments").insert({ lead_id: data.id, author_id: me, body: d.note });
    }

    revalidatePath("/pipeline");
    revalidatePath("/dashboard");
    return ok(data);
  } catch (e) {
    return fail(messageFromError(e));
  }
}

export async function updateLead(raw: unknown): Promise<ActionResult<Lead>> {
  try {
    await requirePermission("leads", "update");
    const parsed = leadUpdateSchema.safeParse(raw);
    if (!parsed.success) {
      return fail("Please fix the highlighted fields", parsed.error.flatten().fieldErrors);
    }
    const d = parsed.data;
    const supabase = await createClient();

    const patch: TablesUpdate<"leads"> = {};
    if (d.title !== undefined) patch.title = d.title ?? null;
    if (d.firstName !== undefined) patch.first_name = d.firstName;
    if (d.lastName !== undefined) patch.last_name = d.lastName;
    if (d.dateOfBirth !== undefined) patch.date_of_birth = d.dateOfBirth ?? null;
    if (d.email !== undefined) patch.email = d.email ?? null;
    if (d.phone !== undefined) patch.phone = d.phone ?? null;
    if (d.whatsappSameAsPhone !== undefined) patch.whatsapp_same_as_phone = d.whatsappSameAsPhone;
    if (d.whatsappPhone !== undefined) patch.whatsapp_phone = d.whatsappPhone ?? null;
    if (d.nationality !== undefined) patch.nationality = d.nationality ?? null;
    if (d.countryOfResidence !== undefined) patch.country_of_residence = d.countryOfResidence ?? null;
    if (d.affiliateId !== undefined) patch.affiliate_id = d.affiliateId;
    if (d.generatorId !== undefined) patch.generator_id = d.generatorId;
    if (d.brokerId !== undefined) patch.broker_id = d.brokerId;
    if (d.policyNumber !== undefined) patch.policy_number = d.policyNumber ?? null;
    if (d.premiumAmount !== undefined) patch.premium_amount = d.premiumAmount ?? null;
    if (d.renewalDate !== undefined) patch.renewal_date = d.renewalDate ?? null;
    if (d.notes !== undefined) patch.notes = d.notes ?? null;

    const { data, error } = await supabase
      .from("leads")
      .update(patch)
      .eq("id", d.id)
      .select("*")
      .single();
    if (error) return fail(messageFromError(error));

    if (d.productIds) await syncProducts(supabase, d.id, d.productIds);

    revalidatePath(`/leads/${data.lead_code}`);
    revalidatePath("/pipeline");
    return ok(data);
  } catch (e) {
    return fail(messageFromError(e));
  }
}

/** Pending → Qualified / Not Qualified. The DB opens or closes the pipeline. */
export async function setQualification(raw: unknown): Promise<ActionResult<Lead>> {
  try {
    await requirePermission("leads", "update");
    const parsed = qualificationSchema.safeParse(raw);
    if (!parsed.success) return fail("Please fix the highlighted fields", parsed.error.flatten().fieldErrors);
    const d = parsed.data;
    const supabase = await createClient();

    const { data, error } = await supabase
      .rpc("set_lead_qualification", {
        p_lead_id: d.id,
        p_status: d.qualification,
        p_reason: d.reason ?? undefined,
      })
      .single();

    if (error) return fail(messageFromError(error));
    revalidatePath("/pipeline");
    revalidatePath("/dashboard");
    return ok(data as Lead);
  } catch (e) {
    return fail(messageFromError(e));
  }
}

/** Move a qualified lead between stages — forwards or backwards. */
export async function changeStage(raw: unknown): Promise<ActionResult<Lead>> {
  try {
    await requirePermission("leads", "update");
    const parsed = stageChangeSchema.safeParse(raw);
    if (!parsed.success) return fail("Please fix the highlighted fields", parsed.error.flatten().fieldErrors);
    const d = parsed.data;
    const supabase = await createClient();

    const { data, error } = await supabase
      .rpc("change_lead_stage", { p_lead_id: d.id, p_stage: d.stage, p_reason: d.reason ?? undefined })
      .single();

    if (error) return fail(messageFromError(error));
    revalidatePath("/pipeline");
    revalidatePath("/dashboard");
    return ok(data as Lead);
  } catch (e) {
    return fail(messageFromError(e));
  }
}

/** Mark lost. The stage is preserved in stage_at_loss by the DB trigger. */
export async function markLost(raw: unknown): Promise<ActionResult<Lead>> {
  try {
    await requirePermission("leads", "update");
    const parsed = markLostSchema.safeParse(raw);
    if (!parsed.success) return fail("Please fix the highlighted fields", parsed.error.flatten().fieldErrors);
    const d = parsed.data;
    const supabase = await createClient();

    const { data, error } = await supabase
      .rpc("mark_lead_lost", {
        p_lead_id: d.id,
        p_reason_id: d.lostReasonId,
        p_notes: d.lostNotes ?? undefined,
      })
      .single();

    if (error) return fail(messageFromError(error));
    revalidatePath("/pipeline");
    revalidatePath("/dashboard");
    return ok(data as Lead);
  } catch (e) {
    return fail(messageFromError(e));
  }
}

/** Reopen a lost lead at its previous stage, or one the user picks. */
export async function reopenLead(raw: unknown): Promise<ActionResult<Lead>> {
  try {
    await requirePermission("leads", "update");
    const parsed = reopenSchema.safeParse(raw);
    if (!parsed.success) return fail("Please fix the highlighted fields", parsed.error.flatten().fieldErrors);
    const d = parsed.data;
    const supabase = await createClient();

    const { data, error } = await supabase
      .rpc("reopen_lead", {
        p_lead_id: d.id,
        p_stage: d.stage ?? undefined,
        p_reason: d.reason ?? undefined,
      })
      .single();

    if (error) return fail(messageFromError(error));
    revalidatePath("/pipeline");
    revalidatePath("/dashboard");
    return ok(data as Lead);
  } catch (e) {
    return fail(messageFromError(e));
  }
}

export async function bulkChangeStage(
  raw: unknown,
): Promise<ActionResult<{ updated: number; failed: number }>> {
  try {
    await requirePermission("leads", "update");
    const parsed = bulkStageSchema.safeParse(raw);
    if (!parsed.success) return fail("Invalid bulk request");
    const d = parsed.data;
    const supabase = await createClient();

    let updated = 0;
    let failed = 0;
    // Per-lead so each move is validated (and logged) individually by the DB.
    for (const id of d.ids) {
      const { error } = await supabase.rpc("change_lead_stage", {
        p_lead_id: id,
        p_stage: d.stage,
        p_reason: d.reason ?? undefined,
      });
      if (error) failed++;
      else updated++;
    }
    revalidatePath("/pipeline");
    return ok({ updated, failed });
  } catch (e) {
    return fail(messageFromError(e));
  }
}

export async function assignBroker(raw: unknown): Promise<ActionResult<{ updated: number }>> {
  try {
    await requirePermission("leads", "update");
    const parsed = assignBrokerSchema.safeParse(raw);
    if (!parsed.success) return fail("Invalid assignment request");
    const { ids, brokerId } = parsed.data;
    const supabase = await createClient();
    const { error, count } = await supabase
      .from("leads")
      .update({ broker_id: brokerId }, { count: "exact" })
      .in("id", ids);
    if (error) return fail(messageFromError(error));
    revalidatePath("/pipeline");
    return ok({ updated: count ?? ids.length });
  } catch (e) {
    return fail(messageFromError(e));
  }
}

export async function softDeleteLead(id: string): Promise<ActionResult> {
  try {
    await requirePermission("leads", "delete");
    const supabase = await createClient();
    const { error } = await supabase
      .from("leads")
      .update({ deleted_at: new Date().toISOString() })
      .eq("id", id);
    if (error) return fail(messageFromError(error));
    revalidatePath("/pipeline");
    return ok(undefined);
  } catch (e) {
    return fail(messageFromError(e));
  }
}

/** GDPR erasure — Admin only; DB function does the scrubbing + audit redaction. */
export async function anonymizeLead(id: string): Promise<ActionResult> {
  try {
    await requireAppUser();
    const supabase = await createClient();
    const { error } = await supabase.rpc("anonymize_lead", { p_lead_id: id });
    if (error) return fail(messageFromError(error));
    revalidatePath("/pipeline");
    return ok(undefined);
  } catch (e) {
    return fail(messageFromError(e));
  }
}
