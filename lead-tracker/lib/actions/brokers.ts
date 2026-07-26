"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { requirePermission } from "@/lib/auth";
import { brokerSchema, brokerUpdateSchema } from "@/lib/schemas/broker";
import { ok, fail, messageFromError, type ActionResult } from "./_result";
import type { Tables, TablesUpdate } from "@/types/database";

type Broker = Tables<"brokers">;

export async function createBroker(raw: unknown): Promise<ActionResult<Broker>> {
  try {
    await requirePermission("brokers", "create");
    const parsed = brokerSchema.safeParse(raw);
    if (!parsed.success) {
      return fail("Please fix the highlighted fields", parsed.error.flatten().fieldErrors);
    }
    const d = parsed.data;
    const supabase = await createClient();
    const { data, error } = await supabase
      .from("brokers")
      .insert({
        first_name: d.firstName,
        last_name: d.lastName,
        company: d.company ?? null,
        email: d.email ?? null,
        phone: d.phone ?? null,
        notes: d.notes ?? null,
        app_user_id: d.appUserId ?? null,
        is_active: d.isActive,
      })
      .select("*")
      .single();
    if (error) return fail(messageFromError(error));
    revalidatePath("/brokers");
    return ok(data);
  } catch (e) {
    return fail(messageFromError(e));
  }
}

export async function updateBroker(raw: unknown): Promise<ActionResult<Broker>> {
  try {
    await requirePermission("brokers", "update");
    const parsed = brokerUpdateSchema.safeParse(raw);
    if (!parsed.success) {
      return fail("Please fix the highlighted fields", parsed.error.flatten().fieldErrors);
    }
    const d = parsed.data;
    const supabase = await createClient();

    const patch: TablesUpdate<"brokers"> = {};
    if (d.firstName !== undefined) patch.first_name = d.firstName;
    if (d.lastName !== undefined) patch.last_name = d.lastName;
    if (d.company !== undefined) patch.company = d.company ?? null;
    if (d.email !== undefined) patch.email = d.email ?? null;
    if (d.phone !== undefined) patch.phone = d.phone ?? null;
    if (d.notes !== undefined) patch.notes = d.notes ?? null;
    if (d.appUserId !== undefined) patch.app_user_id = d.appUserId;
    if (d.isActive !== undefined) patch.is_active = d.isActive;

    const { data, error } = await supabase
      .from("brokers")
      .update(patch)
      .eq("id", d.id)
      .select("*")
      .single();
    if (error) return fail(messageFromError(error));
    revalidatePath("/brokers");
    return ok(data);
  } catch (e) {
    return fail(messageFromError(e));
  }
}

export async function deactivateBroker(id: string): Promise<ActionResult> {
  try {
    await requirePermission("brokers", "update");
    const supabase = await createClient();
    const { error } = await supabase.from("brokers").update({ is_active: false }).eq("id", id);
    if (error) return fail(messageFromError(error));
    revalidatePath("/brokers");
    return ok(undefined);
  } catch (e) {
    return fail(messageFromError(e));
  }
}
