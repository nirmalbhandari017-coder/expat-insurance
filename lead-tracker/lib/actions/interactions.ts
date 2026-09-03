"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { requireAppUser, requirePermission } from "@/lib/auth";
import { commentSchema, savedFilterSchema } from "@/lib/schemas/misc";
import { ok, fail, messageFromError, type ActionResult } from "./_result";

export async function addComment(raw: unknown): Promise<ActionResult> {
  try {
    const user = await requirePermission("comments", "create");
    const parsed = commentSchema.safeParse(raw);
    if (!parsed.success) return fail("Comment cannot be empty");
    const supabase = await createClient();
    const { error } = await supabase
      .from("comments")
      .insert({ lead_id: parsed.data.leadId, author_id: user.id, body: parsed.data.body });
    if (error) return fail(messageFromError(error));
    // Human-readable feed entry alongside the immutable audit row.
    await supabase.from("activity_log").insert({
      actor_id: user.id,
      kind: "comment_added",
      lead_id: parsed.data.leadId,
      summary: "Comment added",
    });
    revalidatePath("/leads");
    revalidatePath("/pipeline"); // the card/table shows the latest note
    return ok(undefined);
  } catch (e) {
    return fail(messageFromError(e));
  }
}

/**
 * Quick note edit from the pipeline, so a CRM never has to open the profile.
 *
 * Amends your own most recent note; if the latest note was written by someone
 * else it adds a new one instead, so nobody's note is silently rewritten (the
 * comments RLS policy enforces this too — it only permits updating your own).
 */
export async function saveLeadNote(raw: unknown): Promise<ActionResult> {
  try {
    const user = await requirePermission("comments", "create");
    const parsed = commentSchema.safeParse(raw);
    if (!parsed.success) return fail("Note cannot be empty");
    const { leadId, body } = parsed.data;
    const supabase = await createClient();

    const { data: latest } = await supabase
      .from("comments")
      .select("id, author_id")
      .eq("lead_id", leadId)
      .is("deleted_at", null)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (latest && latest.author_id === user.id) {
      const { error } = await supabase.from("comments").update({ body }).eq("id", latest.id);
      if (error) return fail(messageFromError(error));
      await supabase.from("activity_log").insert({
        actor_id: user.id,
        kind: "comment_added",
        lead_id: leadId,
        summary: "Note edited",
      });
    } else {
      const { error } = await supabase
        .from("comments")
        .insert({ lead_id: leadId, author_id: user.id, body });
      if (error) return fail(messageFromError(error));
      await supabase.from("activity_log").insert({
        actor_id: user.id,
        kind: "comment_added",
        lead_id: leadId,
        summary: "Comment added",
      });
    }

    revalidatePath("/pipeline");
    revalidatePath("/leads");
    return ok(undefined);
  } catch (e) {
    return fail(messageFromError(e));
  }
}

// Logged when a lead detail page is opened (the app-layer "view audit", per the
// GDPR posture — SELECT-level auditing isn't available on standard Supabase).
export async function logLeadView(leadId: string): Promise<void> {
  const user = await requireAppUser();
  const supabase = await createClient();
  await supabase.from("activity_log").insert({
    actor_id: user.id,
    kind: "viewed",
    lead_id: leadId,
    summary: "Viewed lead",
  });
}

export async function saveFilter(raw: unknown): Promise<ActionResult> {
  try {
    const user = await requireAppUser();
    const parsed = savedFilterSchema.safeParse(raw);
    if (!parsed.success) return fail("Invalid filter");
    const supabase = await createClient();
    const { error } = await supabase.from("saved_filters").insert({
      owner_id: user.id,
      name: parsed.data.name,
      query_string: parsed.data.queryString,
      is_shared: parsed.data.isShared,
    });
    if (error) return fail(messageFromError(error));
    revalidatePath("/pipeline");
    return ok(undefined);
  } catch (e) {
    return fail(messageFromError(e));
  }
}

export async function deleteFilter(id: string): Promise<ActionResult> {
  try {
    await requireAppUser();
    const supabase = await createClient();
    const { error } = await supabase.from("saved_filters").update({ deleted_at: new Date().toISOString() }).eq("id", id);
    if (error) return fail(messageFromError(error));
    revalidatePath("/pipeline");
    return ok(undefined);
  } catch (e) {
    return fail(messageFromError(e));
  }
}

export async function markNotificationRead(id: string): Promise<ActionResult> {
  try {
    await requireAppUser();
    const supabase = await createClient();
    const { error } = await supabase.from("notifications").update({ read_at: new Date().toISOString() }).eq("id", id);
    if (error) return fail(messageFromError(error));
    return ok(undefined);
  } catch (e) {
    return fail(messageFromError(e));
  }
}

export async function updatePipelineView(view: "kanban" | "table"): Promise<void> {
  const user = await requireAppUser();
  const supabase = await createClient();
  await supabase.from("app_users").update({ last_pipeline_view: view }).eq("id", user.id);
}

export async function markAllNotificationsRead(): Promise<ActionResult> {
  try {
    const user = await requireAppUser();
    const supabase = await createClient();
    const { error } = await supabase
      .from("notifications")
      .update({ read_at: new Date().toISOString() })
      .is("read_at", null)
      .eq("user_id", user.id);
    if (error) return fail(messageFromError(error));
    return ok(undefined);
  } catch (e) {
    return fail(messageFromError(e));
  }
}
