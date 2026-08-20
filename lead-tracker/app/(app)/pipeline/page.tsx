import { createClient } from "@/lib/supabase/server";
import { requireAppUser, getPermissionMatrix } from "@/lib/auth";
import { can, scopeOf } from "@/lib/domain/permissions";
import { applyLeadFilters, leadIdsForProduct } from "@/lib/queries/leads";
import { parseFilters } from "@/lib/filters";
import { PipelineShell } from "@/components/pipeline/pipeline-shell";
import {
  LEAD_ROW_COLUMNS,
  type LeadRow,
  type Option,
  type GeneratorOption,
  type PipelinePerms,
} from "@/lib/types";

export const dynamic = "force-dynamic";

const PAGE_CAP = 500; // windowed; filters narrow the set (kanban caps 50/col)

export default async function PipelinePage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const sp = await searchParams;
  const params = new URLSearchParams();
  for (const [k, v] of Object.entries(sp)) if (typeof v === "string") params.set(k, v);
  const filters = parseFilters(params);

  const [user, matrix, supabase] = await Promise.all([
    requireAppUser(),
    getPermissionMatrix(),
    createClient(),
  ]);

  // Product lives in a join table, so narrow by id first when it's filtered.
  const productLeadIds = filters.product
    ? await leadIdsForProduct(supabase, filters.product)
    : null;

  let leadQuery = applyLeadFilters(supabase, filters, {
    columns: LEAD_ROW_COLUMNS,
    count: true,
  }).limit(PAGE_CAP);
  if (productLeadIds) leadQuery = leadQuery.in("id", productLeadIds.length ? productLeadIds : [""]);

  const [
    { data: leadRows, count },
    { data: affiliates },
    { data: generators },
    { data: brokers },
    { data: products },
  ] = await Promise.all([
    leadQuery,
    supabase.from("affiliates").select("id, name").is("deleted_at", null).order("name"),
    supabase
      .from("generators")
      .select("id, full_name, affiliate_id")
      .eq("is_active", true)
      .is("deleted_at", null)
      .order("full_name"),
    supabase
      .from("brokers")
      .select("id, full_name, company")
      .eq("is_active", true)
      .is("deleted_at", null)
      .order("full_name"),
    supabase.from("products").select("id, name").eq("is_active", true).order("sort_order"),
  ]);

  const perms: PipelinePerms = {
    canCreate: can(matrix, user.role, "leads", "create"),
    canUpdate: can(matrix, user.role, "leads", "update"),
    canDelete: can(matrix, user.role, "leads", "delete"),
    canManageEntities: can(matrix, user.role, "generators", "create"),
    updateScope: scopeOf(matrix, user.role, "leads", "update"),
    currentUserId: user.id,
  };

  const affiliateOptions: Option[] = (affiliates ?? []).map((a) => ({ id: a.id, label: a.name }));
  const generatorOptions: GeneratorOption[] = (generators ?? []).map((g) => ({
    id: g.id,
    label: g.full_name ?? "",
    affiliateId: g.affiliate_id,
  }));
  const brokerOptions: Option[] = (brokers ?? []).map((b) => ({
    id: b.id,
    label: b.full_name ?? "",
  }));
  const productOptions: Option[] = (products ?? []).map((p) => ({ id: p.id, label: p.name }));

  return (
    <PipelineShell
      leads={(leadRows ?? []) as unknown as LeadRow[]}
      perms={perms}
      initialView={user.last_pipeline_view}
      filters={filters}
      affiliates={affiliateOptions}
      generators={generatorOptions}
      brokers={brokerOptions}
      products={productOptions}
      total={count ?? (leadRows?.length ?? 0)}
    />
  );
}
