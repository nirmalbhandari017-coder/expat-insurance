import Link from "next/link";
import { format } from "date-fns";
import { createClient } from "@/lib/supabase/server";
import { requireInternal, getPermissionMatrix } from "@/lib/auth";
import { can } from "@/lib/domain/permissions";
import { formatPct } from "@/lib/domain/conversion";
import { periodRange, isPeriod, type Period } from "@/lib/domain/period";
import { PeriodToggle } from "@/components/dashboard/period-toggle";
import { PIPELINE_STAGES, STAGE_LABEL, stageRank, type PipelineStage } from "@/lib/domain/pipeline";
import { FunnelChart, MonthlyTrend } from "@/components/analytics/analytics-charts";
import { ExportBar } from "@/components/reports/export-bar";

export const dynamic = "force-dynamic";

interface LeadRow {
  affiliate_id: string;
  qualification: string;
  stage: PipelineStage | null;
  opportunity: string;
  stage_at_loss: PipelineStage | null;
  created_at: string;
}

// Analytics + Reports on one page. Metrics are computed from the leads table
// rather than the all-time rollup views, because those can't be date-filtered
// and every figure here has to respect the selected period.
export default async function AnalyticsPage({
  searchParams,
}: {
  searchParams: Promise<{ period?: string }>;
}) {
  const [user, matrix, supabase, sp] = await Promise.all([
    requireInternal(),
    getPermissionMatrix(),
    createClient(),
    searchParams,
  ]);
  const canExport = can(matrix, user.role, "leads", "export");

  const period: Period = isPeriod(sp.period) ? sp.period : "ytd";
  const range = periodRange(period);

  const [{ data: leadData }, { data: affiliates }] = await Promise.all([
    supabase
      .from("leads")
      .select("affiliate_id, qualification, stage, opportunity, stage_at_loss, created_at")
      .is("deleted_at", null)
      .gte("created_at", range.fromISO)
      .lte("created_at", range.toISO),
    supabase.from("affiliates").select("id, name").is("deleted_at", null),
  ]);

  const leads = (leadData ?? []) as unknown as LeadRow[];
  const nameById = new Map((affiliates ?? []).map((a) => [a.id, a.name]));

  // How far a lead got: its current stage, or the stage it was lost at.
  // (The pipeline is linear, so reaching a stage implies reaching the earlier
  // ones. A lead walked backwards counts at its current stage.)
  const furthestRank = (l: LeadRow): number => {
    const s = l.opportunity === "lost" ? l.stage_at_loss : l.stage;
    return s ? stageRank(s) : 0;
  };

  // ---- Funnel: how many leads ever reached each stage ----
  const funnelData = PIPELINE_STAGES.map((s) => ({
    stage: STAGE_LABEL[s],
    count: leads.filter((l) => furthestRank(l) >= stageRank(s)).length,
  }));

  // ---- Monthly intake & conversion, bucketed by intake month ----
  const byMonth = new Map<string, { total: number; converted: number }>();
  for (const l of leads) {
    const key = l.created_at.slice(0, 7); // YYYY-MM
    const cur = byMonth.get(key) ?? { total: 0, converted: 0 };
    cur.total += 1;
    if (l.stage === "policy_issued" || l.stage === "renewal") cur.converted += 1;
    byMonth.set(key, cur);
  }
  const trend = Array.from(byMonth.entries())
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([m, v]) => ({ month: format(new Date(`${m}-01T00:00:00`), "MMM yy"), ...v }));

  // ---- Per-source rows, feeding both the leaderboards and the table ----
  // Buckets are mutually exclusive and cover every lead, so the columns always
  // sum to Total.
  const bySource = new Map<
    string,
    {
      total: number;
      pending: number;
      disqualified: number;
      qualified: number;
      inPipeline: number;
      policies: number;
      lost: number;
    }
  >();
  for (const l of leads) {
    const cur =
      bySource.get(l.affiliate_id) ??
      { total: 0, pending: 0, disqualified: 0, qualified: 0, inPipeline: 0, policies: 0, lost: 0 };
    cur.total += 1;
    if (l.opportunity === "lost") cur.lost += 1;
    else if (l.stage === "policy_issued" || l.stage === "renewal") cur.policies += 1;
    else if (l.stage) cur.inPipeline += 1;
    else if (l.qualification === "qualified") cur.qualified += 1;
    else if (l.qualification === "not_qualified") cur.disqualified += 1;
    else cur.pending += 1;
    bySource.set(l.affiliate_id, cur);
  }

  const rows = Array.from(bySource.entries()).map(([id, v]) => {
    const decided = v.policies + v.lost;
    return {
      id,
      name: nameById.get(id) ?? "—",
      ...v,
      decided,
      conversion: decided > 0 ? v.policies / decided : null,
    };
  });

  const ranked = [...rows].sort((a, b) => (b.conversion ?? -1) - (a.conversion ?? -1));
  const top = ranked.slice(0, 5);
  const bottom = ranked.filter((r) => r.decided > 0).slice(-5).reverse();
  const tableRows = [...rows].sort((a, b) => b.total - a.total);

  const totals = tableRows.reduce(
    (acc, r) => ({
      total: acc.total + r.total,
      pending: acc.pending + r.pending,
      disqualified: acc.disqualified + r.disqualified,
      qualified: acc.qualified + r.qualified,
      inPipeline: acc.inPipeline + r.inPipeline,
      policies: acc.policies + r.policies,
      lost: acc.lost + r.lost,
    }),
    { total: 0, pending: 0, disqualified: 0, qualified: 0, inPipeline: 0, policies: 0, lost: 0 },
  );
  const totalDecided = totals.policies + totals.lost;

  return (
    <div className="mx-auto max-w-6xl space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-semibold tracking-tight">Analytics &amp; Reports</h1>
          <p className="text-xs text-muted-foreground">
            Leads created{" "}
            <span className="font-medium text-foreground">{range.label.toLowerCase()}</span> ·{" "}
            {totals.total} total. Exports respect your permissions.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <PeriodToggle current={period} />
          <ExportBar filters={{}} canExport={canExport} />
        </div>
      </div>

      <div className="grid gap-5 md:grid-cols-2">
        <Card title="Conversion funnel" subtitle="Leads that ever reached each stage">
          {totals.total > 0 ? <FunnelChart data={funnelData} /> : <Empty />}
        </Card>
        <Card title="Monthly intake &amp; conversion" subtitle="By intake month">
          {trend.length > 0 ? <MonthlyTrend data={trend} /> : <Empty />}
        </Card>
      </div>

      <div className="grid gap-5 md:grid-cols-2">
        <Leaderboard title="Top sources" rows={top} />
        <Leaderboard title="Needs attention" rows={bottom} />
      </div>

      <div className="rounded-lg border">
        <div className="border-b px-4 py-2.5">
          <div className="text-sm font-medium">Performance by source</div>
          <div className="text-xs text-muted-foreground">
            Sources with at least one lead {range.label.toLowerCase()}.
          </div>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b bg-muted/40 text-left text-xs text-muted-foreground">
                <th className="px-3 py-2 font-medium">Source</th>
                <th className="px-3 py-2 font-medium">Total</th>
                <th className="px-3 py-2 font-medium">Pending</th>
                <th className="px-3 py-2 font-medium">Disqualified</th>
                <th className="px-3 py-2 font-medium">Qualified</th>
                <th className="px-3 py-2 font-medium">In pipeline</th>
                <th className="px-3 py-2 font-medium">Policies</th>
                <th className="px-3 py-2 font-medium">Lost</th>
                <th className="px-3 py-2 font-medium">Conversion</th>
              </tr>
            </thead>
            <tbody>
              {tableRows.map((r) => (
                <tr key={r.id} className="border-b hover:bg-muted/30">
                  <td className="px-3 py-2 font-medium">
                    <Link href={`/affiliates/${r.id}`} className="hover:underline">
                      {r.name}
                    </Link>
                  </td>
                  <td className="tabular px-3 py-2">{r.total}</td>
                  <td className="tabular px-3 py-2">{r.pending}</td>
                  <td className="tabular px-3 py-2">{r.disqualified}</td>
                  <td className="tabular px-3 py-2">{r.qualified}</td>
                  <td className="tabular px-3 py-2">{r.inPipeline}</td>
                  <td className="tabular px-3 py-2">{r.policies}</td>
                  <td className="tabular px-3 py-2">{r.lost}</td>
                  <td className="tabular px-3 py-2">{formatPct(r.conversion)}</td>
                </tr>
              ))}
              {tableRows.length === 0 && (
                <tr>
                  <td colSpan={9} className="px-3 py-8 text-center text-muted-foreground">
                    No leads {range.label.toLowerCase()}.
                  </td>
                </tr>
              )}
            </tbody>
            {tableRows.length > 0 && (
              <tfoot>
                <tr className="border-t bg-muted/30 font-medium">
                  <td className="px-3 py-2">Total</td>
                  <td className="tabular px-3 py-2">{totals.total}</td>
                  <td className="tabular px-3 py-2">{totals.pending}</td>
                  <td className="tabular px-3 py-2">{totals.disqualified}</td>
                  <td className="tabular px-3 py-2">{totals.qualified}</td>
                  <td className="tabular px-3 py-2">{totals.inPipeline}</td>
                  <td className="tabular px-3 py-2">{totals.policies}</td>
                  <td className="tabular px-3 py-2">{totals.lost}</td>
                  <td className="tabular px-3 py-2">
                    {formatPct(totalDecided > 0 ? totals.policies / totalDecided : null)}
                  </td>
                </tr>
              </tfoot>
            )}
          </table>
        </div>
      </div>
    </div>
  );
}

function Card({
  title,
  subtitle,
  children,
}: {
  title: string;
  subtitle?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="rounded-lg border">
      <div className="border-b px-4 py-2.5">
        <div className="text-sm font-medium">{title}</div>
        {subtitle && <div className="text-xs text-muted-foreground">{subtitle}</div>}
      </div>
      <div className="p-4">{children}</div>
    </div>
  );
}

function Empty() {
  return (
    <div className="flex h-[240px] items-center justify-center text-sm text-muted-foreground">
      No data for this period.
    </div>
  );
}

function Leaderboard({
  title,
  rows,
}: {
  title: string;
  rows: { id: string; name: string; total: number; conversion: number | null }[];
}) {
  return (
    <Card title={title}>
      <div className="divide-y">
        {rows.map((r) => (
          <Link
            key={r.id}
            href={`/affiliates/${r.id}`}
            className="flex items-center justify-between py-2 text-sm hover:opacity-80"
          >
            <span className="truncate">{r.name}</span>
            <span className="flex items-center gap-3">
              <span className="text-xs text-muted-foreground">{r.total} leads</span>
              <span className="tabular w-12 text-right font-medium">{formatPct(r.conversion)}</span>
            </span>
          </Link>
        ))}
        {rows.length === 0 && (
          <div className="py-6 text-center text-sm text-muted-foreground">No data.</div>
        )}
      </div>
    </Card>
  );
}
