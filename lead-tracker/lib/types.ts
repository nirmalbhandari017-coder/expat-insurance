import type {
  QualificationStatus,
  PipelineStage,
  OpportunityStatus,
  LeadState,
} from "@/lib/domain/pipeline";

// Shape used across the pipeline UI (list/kanban/table).
export interface LeadRow {
  id: string;
  lead_code: string;
  customer_name: string;
  first_name: string;
  last_name: string;
  title: string | null;
  email: string | null;
  phone: string | null;
  whatsapp_phone: string | null;
  date_of_birth: string | null;
  country_of_residence: string | null;
  nationality: string | null;

  // four status axes
  lead_state: LeadState;
  qualification: QualificationStatus;
  stage: PipelineStage | null;
  opportunity: OpportunityStatus;
  stage_at_loss: PipelineStage | null;

  // attribution
  affiliate_id: string;
  generator_id: string | null;
  broker_id: string | null;

  quote_date: string | null;
  application_date: string | null;
  payment_date: string | null;
  stage_entered_at: string;
  created_at: string;
  updated_at: string;

  // Most recent note, denormalised by trigger so the list needs no extra query.
  last_note: string | null;
  last_note_at: string | null;

  affiliate: { name: string } | null;
  generator: { full_name: string } | null;
  broker: { full_name: string; company: string | null } | null;
  products: { product: { id: string; name: string } | null }[];
}

export const LEAD_ROW_COLUMNS =
  "id, lead_code, customer_name, first_name, last_name, title, email, phone, whatsapp_phone, " +
  "date_of_birth, country_of_residence, nationality, " +
  "lead_state, qualification, stage, opportunity, stage_at_loss, " +
  "affiliate_id, generator_id, broker_id, " +
  "quote_date, application_date, payment_date, stage_entered_at, created_at, updated_at, " +
  "last_note, last_note_at, " +
  "affiliate:affiliates(name), generator:generators(full_name), " +
  "broker:brokers(full_name, company), " +
  "products:lead_products(product:products(id, name))";

export interface Option {
  id: string;
  label: string;
}

/** Generators are filtered by their parent source in the lead form. */
export interface GeneratorOption extends Option {
  affiliateId: string;
}

export interface DuplicateMatch {
  id: string;
  lead_code: string;
  customer_name: string;
  email: string | null;
  phone: string | null;
  affiliate_name: string;
  match_reason: string;
}

export interface PipelinePerms {
  canCreate: boolean;
  canUpdate: boolean;
  canDelete: boolean;
  canManageEntities: boolean; // sources / generators / brokers
  updateScope: "all" | "own" | "none";
  currentUserId: string;
}
