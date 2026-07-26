"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { requirePermission } from "@/lib/auth";
import { generatorSchema, generatorUpdateSchema } from "@/lib/schemas/generator";
import { ok, fail, messageFromError, type ActionResult } from "./_result";
import type { Tables, TablesUpdate } from "@/types/database";

type Generator = Tables<"generators">;

export async function createGenerator(raw: unknown): Promise<ActionResult<Generator>> {
  try {
    await requirePermission("generators", "create");
    const parsed = generatorSchema.safeParse(raw);
    if (!parsed.success) {
      return fail("Please fix the highlighted fields", parsed.error.flatten().fieldErrors);
    }
    const d = parsed.data;
    const supabase = await createClient();
    const { data, error } = await supabase
      .from("generators")
      .insert({
        first_name: d.firstName,
        last_name: d.lastName,
        affiliate_id: d.affiliateId,
        email: d.email ?? null,
        phone: d.phone ?? null,
        notes: d.notes ?? null,
        is_active: d.isActive,
      })
      .select("*")
      .single();
    if (error) return fail(messageFromError(error));
    revalidatePath("/generators");
    revalidatePath("/affiliates");
    return ok(data);
  } catch (e) {
    return fail(messageFromError(e));
  }
}

export async function updateGenerator(raw: unknown): Promise<ActionResult<Generator>> {
  try {
    await requirePermission("generators", "update");
    const parsed = generatorUpdateSchema.safeParse(raw);
    if (!parsed.success) {
      return fail("Please fix the highlighted fields", parsed.error.flatten().fieldErrors);
    }
    const d = parsed.data;
    const supabase = await createClient();

    const patch: TablesUpdate<"generators"> = {};
    if (d.firstName !== undefined) patch.first_name = d.firstName;
    if (d.lastName !== undefined) patch.last_name = d.lastName;
    if (d.affiliateId !== undefined) patch.affiliate_id = d.affiliateId;
    if (d.email !== undefined) patch.email = d.email ?? null;
    if (d.phone !== undefined) patch.phone = d.phone ?? null;
    if (d.notes !== undefined) patch.notes = d.notes ?? null;
    if (d.isActive !== undefined) patch.is_active = d.isActive;

    const { data, error } = await supabase
      .from("generators")
      .update(patch)
      .eq("id", d.id)
      .select("*")
      .single();
    if (error) return fail(messageFromError(error));
    revalidatePath("/generators");
    revalidatePath("/affiliates");
    return ok(data);
  } catch (e) {
    return fail(messageFromError(e));
  }
}

/** Soft delete — leads keep pointing at the generator for historical accuracy. */
export async function deactivateGenerator(id: string): Promise<ActionResult> {
  try {
    await requirePermission("generators", "update");
    const supabase = await createClient();
    const { error } = await supabase.from("generators").update({ is_active: false }).eq("id", id);
    if (error) return fail(messageFromError(error));
    revalidatePath("/generators");
    return ok(undefined);
  } catch (e) {
    return fail(messageFromError(e));
  }
}
