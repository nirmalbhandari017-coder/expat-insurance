import type {
  PipelineStage,
  QualificationStatus,
  OpportunityStatus,
  LeadState,
} from "@/lib/domain/pipeline";
import type { Enums } from "@/types/database";

export type SourceChannel = Enums<"source_channel">;

// Every filter is URL-encoded so any view is shareable and savable. Arrays are
// comma-joined; empty values are omitted to keep URLs clean and stable.
export interface LeadFilters {
  q?: string;
  affiliate?: string; // source id
  generator?: string;
  broker?: string;
  product?: string; // product id
  leadState?: LeadState[];
  qualification?: QualificationStatus[];
  stage?: PipelineStage[];
  opportunity?: OpportunityStatus;
  countryOfResidence?: string;
  nationality?: string;
  ageMin?: string;
  ageMax?: string;
  sourceChannel?: SourceChannel;
  lostReason?: string; // lost_reasons.id
  createdFrom?: string; // ISO date
  createdTo?: string;
  updatedFrom?: string;
  updatedTo?: string;
  quoteFrom?: string;
  quoteTo?: string;
  applicationFrom?: string;
  applicationTo?: string;
  paymentFrom?: string;
  paymentTo?: string;
  sort?: string; // e.g. "-updated_at"
}

export function parseFilters(params: URLSearchParams): LeadFilters {
  const f: LeadFilters = {};
  const get = (k: string) => params.get(k)?.trim() || undefined;
  const list = <T extends string>(k: string): T[] | undefined => {
    const v = get(k);
    return v ? (v.split(",").filter(Boolean) as T[]) : undefined;
  };

  f.q = get("q");
  f.affiliate = get("affiliate");
  f.generator = get("generator");
  f.broker = get("broker");
  f.product = get("product");
  f.leadState = list<LeadState>("leadState");
  f.qualification = list<QualificationStatus>("qualification");
  f.stage = list<PipelineStage>("stage");
  f.opportunity = get("opportunity") as OpportunityStatus | undefined;
  f.countryOfResidence = get("countryOfResidence");
  f.nationality = get("nationality");
  f.ageMin = get("ageMin");
  f.ageMax = get("ageMax");
  f.sourceChannel = get("sourceChannel") as SourceChannel | undefined;
  f.lostReason = get("lostReason");
  f.createdFrom = get("createdFrom");
  f.createdTo = get("createdTo");
  f.updatedFrom = get("updatedFrom");
  f.updatedTo = get("updatedTo");
  f.quoteFrom = get("quoteFrom");
  f.quoteTo = get("quoteTo");
  f.applicationFrom = get("applicationFrom");
  f.applicationTo = get("applicationTo");
  f.paymentFrom = get("paymentFrom");
  f.paymentTo = get("paymentTo");
  f.sort = get("sort");

  return f;
}

// Deterministic: keys sorted so equal filters always yield an identical string
// (stable share links + reliable saved-filter comparison).
export function serializeFilters(f: LeadFilters): string {
  const params = new URLSearchParams();
  const set = (k: string, v: string | undefined) => {
    if (v && v.length) params.set(k, v);
  };
  const setList = (k: string, v?: string[]) => {
    if (v?.length) params.set(k, [...v].sort().join(","));
  };

  set("q", f.q);
  set("affiliate", f.affiliate);
  set("generator", f.generator);
  set("broker", f.broker);
  set("product", f.product);
  setList("leadState", f.leadState);
  setList("qualification", f.qualification);
  setList("stage", f.stage);
  set("opportunity", f.opportunity);
  set("countryOfResidence", f.countryOfResidence);
  set("nationality", f.nationality);
  set("ageMin", f.ageMin);
  set("ageMax", f.ageMax);
  set("sourceChannel", f.sourceChannel);
  set("lostReason", f.lostReason);
  set("createdFrom", f.createdFrom);
  set("createdTo", f.createdTo);
  set("updatedFrom", f.updatedFrom);
  set("updatedTo", f.updatedTo);
  set("quoteFrom", f.quoteFrom);
  set("quoteTo", f.quoteTo);
  set("applicationFrom", f.applicationFrom);
  set("applicationTo", f.applicationTo);
  set("paymentFrom", f.paymentFrom);
  set("paymentTo", f.paymentTo);
  set("sort", f.sort);

  params.sort();
  return params.toString();
}

export function countActiveFilters(f: LeadFilters): number {
  return Object.entries(f).filter(([k, v]) => {
    if (k === "sort") return false;
    if (Array.isArray(v)) return v.length > 0;
    return v != null && v !== "";
  }).length;
}
