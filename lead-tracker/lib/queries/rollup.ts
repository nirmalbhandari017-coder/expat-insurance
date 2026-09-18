import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/types/database";
import type {
  OpportunityStatus,
  PipelineStage,
  QualificationStatus,
} from "@/lib/domain/pipeline";

/** One group of leads sharing the same status, affiliate and intake month. */
export interface RollupRow {
  affiliate_id: string;
  qualification: QualificationStatus;
  stage: PipelineStage | null;
  opportunity: OpportunityStatus;
  stage_at_loss: PipelineStage | null;
  /** Intake month, YYYY-MM (UTC). */
  month: string;
  /** Number of leads in this group. */
  n: number;
}

/**
 * Lead counts for a period, grouped in the database. Replaces fetching every
 * lead and counting in the app, which PostgREST silently capped at 1,000 rows.
 * RLS still applies — the function runs with the caller's permissions.
 */
export async function fetchLeadRollup(
  supabase: SupabaseClient<Database>,
  fromISO: string,
  toISO: string,
): Promise<RollupRow[]> {
  const { data, error } = await supabase.rpc("lead_period_rollup", {
    p_from: fromISO,
    p_to: toISO,
  });
  if (error) throw error;
  return (data ?? []) as unknown as RollupRow[];
}
