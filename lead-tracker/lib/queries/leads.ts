import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/types/database";
import type { LeadFilters } from "@/lib/filters";

export const LEAD_LIST_COLUMNS =
  "id, lead_code, customer_name, first_name, last_name, title, email, phone, whatsapp_phone, " +
  "date_of_birth, nationality, country_of_residence, " +
  "lead_state, qualification, stage, opportunity, stage_at_loss, " +
  "affiliate_id, generator_id, broker_id, source_channel, " +
  "quote_date, application_date, payment_date, policy_number, stage_entered_at, " +
  "created_at, updated_at";

type Client = SupabaseClient<Database>;

/** Age filters are expressed as date_of_birth bounds so the DB index is used. */
function dobBoundForAge(age: number, edge: "min" | "max"): string {
  const d = new Date();
  // Someone aged >= `age` was born on or before today minus `age` years.
  // Someone aged <= `age` was born on or after today minus (age + 1) years + 1 day.
  d.setFullYear(d.getFullYear() - (edge === "min" ? age : age + 1));
  if (edge === "max") d.setDate(d.getDate() + 1);
  return d.toISOString().slice(0, 10);
}

// Single source of truth for translating LeadFilters into a PostgREST query.
// RLS still scopes rows (a broker sees only their own). Used by list pages + export.
export function applyLeadFilters(
  client: Client,
  filters: LeadFilters,
  opts: { columns?: string; count?: boolean } = {},
) {
  let q = client
    .from("leads")
    .select(opts.columns ?? LEAD_LIST_COLUMNS, opts.count ? { count: "exact" } : undefined)
    .is("deleted_at", null);

  if (filters.q) {
    const term = filters.q.replace(/[%,]/g, " ").trim();
    q = q.or(
      [
        `customer_name.ilike.%${term}%`,
        `first_name.ilike.%${term}%`,
        `last_name.ilike.%${term}%`,
        `email.ilike.%${term}%`,
        `phone.ilike.%${term}%`,
        `whatsapp_phone.ilike.%${term}%`,
        `policy_number.ilike.%${term}%`,
      ].join(","),
    );
  }
  if (filters.affiliate) q = q.eq("affiliate_id", filters.affiliate);
  if (filters.generator) q = q.eq("generator_id", filters.generator);
  if (filters.broker) q = q.eq("broker_id", filters.broker);
  if (filters.leadState?.length) q = q.in("lead_state", filters.leadState);
  if (filters.qualification?.length) q = q.in("qualification", filters.qualification);
  if (filters.stage?.length) q = q.in("stage", filters.stage);
  if (filters.opportunity) q = q.eq("opportunity", filters.opportunity);
  if (filters.countryOfResidence) q = q.eq("country_of_residence", filters.countryOfResidence);
  if (filters.nationality) q = q.eq("nationality", filters.nationality);
  if (filters.sourceChannel) q = q.eq("source_channel", filters.sourceChannel);
  if (filters.lostReason) q = q.eq("lost_reason_id", filters.lostReason);

  // Older than ageMin  -> born on or before that date.
  if (filters.ageMin) q = q.lte("date_of_birth", dobBoundForAge(Number(filters.ageMin), "min"));
  if (filters.ageMax) q = q.gte("date_of_birth", dobBoundForAge(Number(filters.ageMax), "max"));

  if (filters.createdFrom) q = q.gte("created_at", filters.createdFrom);
  if (filters.createdTo) q = q.lte("created_at", `${filters.createdTo}T23:59:59.999Z`);
  if (filters.updatedFrom) q = q.gte("updated_at", filters.updatedFrom);
  if (filters.updatedTo) q = q.lte("updated_at", `${filters.updatedTo}T23:59:59.999Z`);
  if (filters.quoteFrom) q = q.gte("quote_date", filters.quoteFrom);
  if (filters.quoteTo) q = q.lte("quote_date", filters.quoteTo);
  if (filters.applicationFrom) q = q.gte("application_date", filters.applicationFrom);
  if (filters.applicationTo) q = q.lte("application_date", filters.applicationTo);
  if (filters.paymentFrom) q = q.gte("payment_date", filters.paymentFrom);
  if (filters.paymentTo) q = q.lte("payment_date", filters.paymentTo);

  // Sort: "-col" desc, "col" asc. Default newest activity first.
  const sort = filters.sort ?? "-updated_at";
  const desc = sort.startsWith("-");
  const col = desc ? sort.slice(1) : sort;
  q = q.order(col, { ascending: !desc });

  return q;
}

/** Product filtering needs the join table, so it is applied as an id pre-filter. */
export async function leadIdsForProduct(client: Client, productId: string): Promise<string[]> {
  const { data } = await client.from("lead_products").select("lead_id").eq("product_id", productId);
  return (data ?? []).map((r) => r.lead_id);
}
