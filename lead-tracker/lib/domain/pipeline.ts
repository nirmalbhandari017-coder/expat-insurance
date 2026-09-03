import type { Enums } from "@/types/database";

export type QualificationStatus = Enums<"qualification_status">;
export type PipelineStage = Enums<"pipeline_stage">;
export type OpportunityStatus = Enums<"opportunity_status">;
export type LeadState = Enums<"lead_state">;
export type TransitionKind = Enums<"transition_kind">;

/* ---------------------------------------------------------------------------
 * The four status axes are deliberately independent. Collapsing them (as the
 * previous single enum did) made "lost" overwrite the stage, which destroyed
 * the answer to the most valuable question the business asks: at which stage
 * do we lose deals? `stageAtLoss` now preserves it.
 * ------------------------------------------------------------------------- */

// Ordered pipeline. MUST match the enum order in migration 12.
export const PIPELINE_STAGES: PipelineStage[] = [
  "qualified",
  "quote_sent",
  "negotiation",
  "application_received",
  "policy_issued",
  "renewal",
];

export const STAGE_LABEL: Record<PipelineStage, string> = {
  qualified: "Qualified",
  quote_sent: "Quote Sent",
  negotiation: "Negotiation",
  application_received: "Application Received",
  policy_issued: "Policy Issued",
  renewal: "Renewal",
};

export const QUALIFICATION_LABEL: Record<QualificationStatus, string> = {
  pending: "Pending Qualification",
  qualified: "Qualified",
  not_qualified: "Not Qualified",
};

// The DB value stays `lost`; the business calls this outcome "Squander".
export const OPPORTUNITY_LABEL: Record<OpportunityStatus, string> = {
  active: "Active",
  lost: "Squander",
};

export const LEAD_STATE_LABEL: Record<LeadState, string> = {
  new: "New",
  active: "Active",
  closed: "Closed",
};

// Tailwind token keys (see tailwind.config status.* ramp).
export const STAGE_TOKEN: Record<PipelineStage, string> = {
  qualified: "inbound",
  quote_sent: "contacted",
  negotiation: "opportunity",
  application_received: "pending",
  policy_issued: "open",
  renewal: "lapsed",
};

/** 1-based position of a stage in the pipeline. Mirrors stage_rank() in SQL. */
export function stageRank(s: PipelineStage): number {
  return PIPELINE_STAGES.indexOf(s) + 1;
}

/**
 * Any stage-to-stage move is legal — the spec explicitly requires salespeople
 * to be able to walk a deal backwards (e.g. Application Received →
 * Negotiation). The direction only determines how the move is *recorded*.
 */
export function transitionKind(
  from: PipelineStage | null,
  to: PipelineStage | null,
): TransitionKind | null {
  if (from === to) return null;
  if (from === null) return "qualify";
  if (to === null) return "disqualify";
  return stageRank(to) > stageRank(from) ? "progress" : "correction";
}

export function isBackward(from: PipelineStage, to: PipelineStage): boolean {
  return stageRank(to) < stageRank(from);
}

/** A lead only sits in the pipeline once qualified and still active. */
export function isInPipeline(
  qualification: QualificationStatus,
  opportunity: OpportunityStatus,
): boolean {
  return qualification === "qualified" && opportunity === "active";
}

export const NEXT_STAGE = (s: PipelineStage): PipelineStage | null =>
  PIPELINE_STAGES[stageRank(s)] ?? null;

/* --------------------------- age from DOB --------------------------------- */

/** Age is always derived, never stored (spec §10). */
export function ageFromDob(dob: string | null | undefined): number | null {
  if (!dob) return null;
  const b = new Date(dob);
  if (Number.isNaN(b.getTime())) return null;
  const now = new Date();
  let age = now.getFullYear() - b.getFullYear();
  const m = now.getMonth() - b.getMonth();
  if (m < 0 || (m === 0 && now.getDate() < b.getDate())) age--;
  return age >= 0 && age < 150 ? age : null;
}
