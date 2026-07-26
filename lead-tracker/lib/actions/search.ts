"use server";

import { createClient } from "@/lib/supabase/server";
import { requireAppUser } from "@/lib/auth";
import type { PipelineStage, QualificationStatus } from "@/lib/domain/pipeline";

export interface SearchResults {
  leads: {
    id: string;
    lead_code: string;
    customer_name: string;
    qualification: QualificationStatus;
    stage: PipelineStage | null;
    email: string | null;
  }[];
  affiliates: { id: string; name: string }[];
}

// Global instant search — leads (name/email/phone/policy via trigram-backed ilike)
// and affiliates. RLS scopes results (RM sees only their own leads).
export async function globalSearch(q: string): Promise<SearchResults> {
  await requireAppUser();
  const term = q.trim();
  if (term.length < 2) return { leads: [], affiliates: [] };
  const supabase = await createClient();
  const like = `%${term.replace(/[%,]/g, " ")}%`;

  const [{ data: leads }, { data: affiliates }] = await Promise.all([
    supabase
      .from("leads")
      .select("id, lead_code, customer_name, qualification, stage, email")
      .is("deleted_at", null)
      .or(
        `customer_name.ilike.${like},email.ilike.${like},phone.ilike.${like},whatsapp_phone.ilike.${like},policy_number.ilike.${like},lead_code.ilike.${like}`,
      )
      .order("updated_at", { ascending: false })
      .limit(8),
    supabase
      .from("affiliates")
      .select("id, name")
      .is("deleted_at", null)
      .ilike("name", like)
      .limit(5),
  ]);

  return {
    leads: (leads ?? []) as unknown as SearchResults["leads"],
    affiliates: (affiliates ?? []) as SearchResults["affiliates"],
  };
}
