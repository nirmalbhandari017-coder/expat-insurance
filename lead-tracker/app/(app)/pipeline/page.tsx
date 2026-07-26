import { createClient } from "@/lib/supabase/server";
import { requireAppUser, getPermissionMatrix } from "@/lib/auth";
import { can, scopeOf } from "@/lib/domain/permissions";
import { applyLeadFilters } from "@/lib/queries/leads";
import { parseFilters } from "@/lib/filters";
import { PipelineShell } from "@/components/pipeline/pipeline-shell";
import { LEAD_ROW_COLUMNS, type LeadRow, type Option, type PipelinePerms } from "@/lib/types";

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

  const [{ data: leadRows, count }, { data: affiliates }, { data: rms }, { data: types }] = await Promise.all([
    applyLeadFilters(supabase, filters, { columns: LEAD_ROW_COLUMNS, count: true }).limit(PAGE_CAP),
    supabase.from("affiliates").select("id, name").is("deleted_at", null).order("name"),
    supabase.from("app_users").select("id, full_name").eq("is_rm", true).is("deleted_at", null).order("full_name"),
    supabase.from("insurance_types").select("id, name").eq("is_active", true).order("sort_order"),
  ]);

  const perms: PipelinePerms = {
    canCreate: can(matrix, user.role, "leads", "create"),
    canUpdate: can(matrix, user.role, "leads", "update"),
    canDelete: can(matrix, user.role, "leads", "delete"),
    canCorrect: user.role === "admin" || user.role === "business_development",
    updateScope: scopeOf(matrix, user.role, "leads", "update"),
    currentUserId: user.id,
  };

  const affiliateOptions: Option[] = (affiliates ?? []).map((a) => ({ id: a.id, label: a.name }));
  const rmOptions: Option[] = (rms ?? []).map((r) => ({ id: r.id, label: r.full_name }));
  const typeOptions: Option[] = (types ?? []).map((t) => ({ id: t.id, label: t.name }));

  return (
    <PipelineShell
      leads={(leadRows ?? []) as unknown as LeadRow[]}
      perms={perms}
      initialView={user.last_pipeline_view}
      filters={filters}
      affiliates={affiliateOptions}
      rms={rmOptions}
      insuranceTypes={typeOptions}
      total={count ?? (leadRows?.length ?? 0)}
    />
  );
}
