import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { requireAppUser, getPermissionMatrix } from "@/lib/auth";
import { can } from "@/lib/domain/permissions";
import { formatPct } from "@/lib/domain/conversion";
import { StatusBadge } from "@/components/leads/status-badge";
import { PIPELINE_STATUSES, STATUS_LABEL, STATUS_TOKEN, type LeadStatus } from "@/lib/domain/pipeline";
import { shortDate } from "@/lib/format";

export const dynamic = "force-dynamic";

const STAT_KEY: Record<LeadStatus, string> = {
  inbound: "n_inbound", contacted: "n_contacted", opportunity_open: "n_opportunity",
  account_pending: "n_pending", account_open: "n_open", account_lapsed: "n_lapsed", lost: "n_lost",
};

export default async function AffiliateDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const [user, matrix, supabase] = await Promise.all([requireAppUser(), getPermissionMatrix(), createClient()]);
  const canSeeCommission = can(matrix, user.role, "affiliates", "update");

  const { data: affiliate } = await supabase
    .from("affiliates").select("*").eq("id", id).is("deleted_at", null).maybeSingle();
  if (!affiliate) notFound();

  const [{ data: stat }, { data: comm }, { data: leads }, { data: cohorts }] = await Promise.all([
    supabase.from("mv_affiliate_stats").select("*").eq("affiliate_id", id).maybeSingle(),
    supabase.from("v_affiliate_commission").select("commission_pct").eq("affiliate_id", id).maybeSingle(),
    supabase.from("leads").select("id, lead_code, customer_name, current_status, created_at, rm:app_users!leads_assigned_rm_id_fkey(full_name)").eq("affiliate_id", id).is("deleted_at", null).order("updated_at", { ascending: false }).limit(15),
    supabase.from("v_monthly_cohorts").select("*").eq("affiliate_id", id).order("cohort_month", { ascending: false }).limit(6),
  ]);

  const total = stat?.total_leads ?? 0;

  return (
    <div className="mx-auto max-w-5xl space-y-5">
      <Link href="/affiliates" className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground">
        <ArrowLeft className="h-4 w-4" /> Affiliates
      </Link>

      <div className="border-b pb-4">
        <h1 className="text-2xl font-semibold tracking-tight">{affiliate.name}</h1>
        <div className="mt-1 text-sm text-muted-foreground">
          {affiliate.contact_person ?? "—"}{affiliate.email ? ` · ${affiliate.email}` : ""}{affiliate.country ? ` · ${affiliate.country}` : ""}
          {" · "}{affiliate.is_active ? "Active" : "Inactive"}
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <Kpi label="Total leads" value={String(total)} />
        <Kpi label="Conversion" value={formatPct(stat?.conversion_rate ?? null)} />
        <Kpi label="Retention" value={formatPct(stat?.retention_rate ?? null)} />
        <Kpi label="Avg days to convert" value={stat?.avg_days_to_convert != null ? String(Math.round(stat.avg_days_to_convert)) : "—"} />
        {canSeeCommission && <Kpi label="Commission" value={comm?.commission_pct != null ? `${comm.commission_pct}%` : "—"} />}
      </div>

      <div className="rounded-lg border">
        <div className="border-b px-4 py-2.5 text-sm font-medium">Pipeline breakdown</div>
        <div className="space-y-2 p-4">
          {PIPELINE_STATUSES.map((s) => {
            const n = (stat?.[STAT_KEY[s] as keyof typeof stat] as number | undefined) ?? 0;
            const pct = total ? (n / total) * 100 : 0;
            return (
              <div key={s} className="flex items-center gap-3 text-sm">
                <div className="flex w-36 items-center gap-2 text-muted-foreground">
                  <span className="h-2 w-2 rounded-full" style={{ backgroundColor: `hsl(var(--status-${STATUS_TOKEN[s]}))` }} />
                  {STATUS_LABEL[s]}
                </div>
                <div className="h-2 flex-1 overflow-hidden rounded-full bg-muted">
                  <div className="h-full rounded-full" style={{ width: `${pct}%`, backgroundColor: `hsl(var(--status-${STATUS_TOKEN[s]}))` }} />
                </div>
                <span className="tabular w-8 text-right">{n}</span>
              </div>
            );
          })}
        </div>
      </div>

      <div className="grid gap-5 md:grid-cols-2">
        <div className="rounded-lg border">
          <div className="border-b px-4 py-2.5 text-sm font-medium">Recent leads</div>
          <div className="divide-y">
            {(leads ?? []).map((l) => (
              <Link key={l.id} href={`/leads/${l.lead_code}`} className="flex items-center justify-between px-4 py-2 text-sm hover:bg-muted/30">
                <span className="truncate">{l.customer_name}</span>
                <StatusBadge status={l.current_status as LeadStatus} />
              </Link>
            ))}
            {(leads ?? []).length === 0 && <div className="px-4 py-6 text-center text-sm text-muted-foreground">No leads yet.</div>}
          </div>
        </div>

        <div className="rounded-lg border">
          <div className="border-b px-4 py-2.5 text-sm font-medium">Monthly intake cohorts</div>
          <table className="w-full text-sm">
            <thead><tr className="text-left text-xs text-muted-foreground"><th className="px-4 py-2">Month</th><th className="px-3 py-2">Total</th><th className="px-3 py-2">Converted</th><th className="px-3 py-2">Lost</th></tr></thead>
            <tbody>
              {(cohorts ?? []).map((c) => (
                <tr key={c.cohort_month} className="border-t">
                  <td className="px-4 py-2">{c.cohort_month ? shortDate(c.cohort_month) : "—"}</td>
                  <td className="tabular px-3 py-2">{c.total}</td>
                  <td className="tabular px-3 py-2 text-status-open">{c.converted}</td>
                  <td className="tabular px-3 py-2 text-status-lost">{c.lost}</td>
                </tr>
              ))}
              {(cohorts ?? []).length === 0 && <tr><td colSpan={4} className="px-4 py-6 text-center text-muted-foreground">No data.</td></tr>}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

function Kpi({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg border p-4">
      <div className="text-xs text-muted-foreground">{label}</div>
      <div className="tabular mt-1 text-2xl font-semibold">{value}</div>
    </div>
  );
}
