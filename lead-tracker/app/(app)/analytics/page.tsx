import Link from "next/link";
import { format } from "date-fns";
import { createClient } from "@/lib/supabase/server";
import { requireInternal, getPermissionMatrix } from "@/lib/auth";
import { can } from "@/lib/domain/permissions";
import { formatPct } from "@/lib/domain/conversion";
import { periodRange, isPeriod, type Period } from "@/lib/domain/period";
import { PeriodToggle } from "@/components/dashboard/period-toggle";
import { PIPELINE_STAGES, STAGE_LABEL, stageRank } from "@/lib/domain/pipeline";
import { fetchLeadRollup, type RollupRow } from "@/lib/queries/rollup";
import { FunnelChart, MonthlyTrend } from "@/components/analytics/analytics-charts";
import { ExportBar } from "@/components/reports/export-bar";
import { AffiliateDirectory } from "@/components/affiliates/affiliate-directory";

export const dynamic = "force-dynamic";

// Analytics + Reports on one page. Every figure respects the selected period.
// Counts come pre-grouped from the database (lead_period_rollup): fetching raw
// leads was capped at 1,000 rows by the API, which skewed every number here.
// Each rollup row stands for `n` leads, so all tallies below add `n`, not 1.
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

  const [groups, { data: affiliates }] = await Promise.all([
    fetchLeadRollup(supabase, range.fromISO, range.toISO),
    supabase.from("affiliates").select("id, name").is("deleted_at", null),
  ]);

  const nameById = new Map((affiliates ?? []).map((a) => [a.id, a.name]));

  // How far a lead got: its current stage, or the stage it was lost at.
  // (The pipeline is linear, so reaching a stage implies reaching the earlier
  // ones. A lead walked backwards counts at its current stage.)
  const furthestRank = (l: RollupRow): number => {
    const s = l.opportunity === "lost" ? l.stage_at_loss : l.stage;
    return s ? stageRank(s) : 0;
  };

  // ---- Funnel: how many leads ever reached each stage ----
  const funnelData = PIPELINE_STAGES.map((s) => ({
    stage: STAGE_LABEL[s],
    count: sumN(groups.filter((l) => furthestRank(l) >= stageRank(s))),
  }));

  // ---- Monthly intake & conversion, bucketed by intake month ----
  const byMonth = new Map<string, { total: number; converted: number }>();
  for (const l of groups) {
    const cur = byMonth.get(l.month) ?? { total: 0, converted: 0 };
    cur.total += l.n;
    if (l.stage === "policy_issued" || l.stage === "renewal") cur.converted += l.n;
    byMonth.set(l.month, cur);
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
  for (const l of groups) {
    const cur =
      bySource.get(l.affiliate_id) ??
      { total: 0, pending: 0, disqualified: 0, qualified: 0, inPipeline: 0, policies: 0, lost: 0 };
    cur.total += l.n;
    if (l.opportunity === "lost") cur.lost += l.n;
    else if (l.stage === "policy_issued" || l.stage === "renewal") cur.policies += l.n;
    else if (l.stage) cur.inPipeline += l.n;
    else if (l.qualification === "qualified") cur.qualified += l.n;
    else if (l.qualification === "not_qualified") cur.disqualified += l.n;
    else cur.pending += l.n;
    bySource.set(l.affiliate_id, cur);
  }

  // Squandered leads that had been qualified — i.e. real opportunities lost,
  // as opposed to enquiries that were never qualified in the first place.
  const qualifiedSquandered = sumN(
    groups.filter((l) => l.opportunity === "lost" && l.qualification === "qualified"),
  );
  const everQualified = sumN(groups.filter((l) => l.qualification === "qualified"));

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

      <div className="grid grid-cols-2 gap-3 md:grid-cols-5">
        <Kpi label="Total leads" value={totals.total} />
        <Kpi label="Qualified" value={everQualified} />
        <Kpi label="Policies" value={totals.policies} />
        <Kpi label="Squandered" value={totals.lost} />
        <Kpi
          label="Qualified squandered"
          value={qualifiedSquandered}
          hint={
            everQualified > 0
              ? `${formatPct(qualifiedSquandered / everQualified)} of qualified`
              : undefined
          }
        />
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
        <Leaderboard title="Top affiliates" rows={top} />
        <Leaderboard title="Needs attention" rows={bottom} />
      </div>

      <div className="rounded-lg border">
        <div className="border-b px-4 py-2.5">
          <div className="text-sm font-medium">Performance by affiliate</div>
          <div className="text-xs text-muted-foreground">
            Affiliates with at least one lead {range.label.toLowerCase()}.
          </div>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b bg-muted/40 text-left text-xs text-muted-foreground">
                <th className="px-3 py-2 font-medium">Affiliate</th>
                <th className="px-3 py-2 font-medium">Total</th>
                <th className="px-3 py-2 font-medium">Pending</th>
                <th className="px-3 py-2 font-medium">Disqualified</th>
                <th className="px-3 py-2 font-medium">Qualified</th>
                <th className="px-3 py-2 font-medium">In pipeline</th>
                <th className="px-3 py-2 font-medium">Policies</th>
                <th className="px-3 py-2 font-medium">Squander</th>
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

      <AffiliateDirectory />
    </div>
  );
}

function sumN(rows: RollupRow[]): number {
  return rows.reduce((acc, r) => acc + r.n, 0);
}

function Kpi({ label, value, hint }: { label: string; value: number; hint?: string }) {
  return (
    <div className="rounded-lg border p-3">
      <div className="text-xs text-muted-foreground">{label}</div>
      <div className="tabular mt-0.5 text-xl font-semibold">{value}</div>
      {hint && <div className="text-[11px] text-muted-foreground">{hint}</div>}
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
