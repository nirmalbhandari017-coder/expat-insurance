"use server";

import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { ok, fail, type ActionResult } from "./_result";

export async function signIn(formData: FormData): Promise<ActionResult> {
  const email = String(formData.get("email") ?? "").trim();
  const password = String(formData.get("password") ?? "");
  if (!email || !password) return fail("Email and password are required");

  const supabase = await createClient();
  const { error } = await supabase.auth.signInWithPassword({ email, password });
  if (error) return fail(error.message);
  return ok(undefined);
}

export async function signUp(formData: FormData): Promise<ActionResult> {
  const email = String(formData.get("email") ?? "").trim();
  const password = String(formData.get("password") ?? "");
  const fullName = String(formData.get("full_name") ?? "").trim();
  if (!email || password.length < 8) return fail("Enter an email and a password of at least 8 characters");

  const supabase = await createClient();
  const { error } = await supabase.auth.signUp({
    email,
    password,
    options: { data: { full_name: fullName } },
  });
  if (error) return fail(error.message);
  return ok(undefined);
}

export async function signOut() {
  const supabase = await createClient();
  await supabase.auth.signOut();
  redirect("/login");
}
