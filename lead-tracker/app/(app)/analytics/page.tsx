import Link from "next/link";
import { format } from "date-fns";
import { createClient } from "@/lib/supabase/server";
import { requireAppUser } from "@/lib/auth";
import { formatPct } from "@/lib/domain/conversion";
import { FunnelChart, MonthlyTrend } from "@/components/analytics/analytics-charts";

export const dynamic = "force-dynamic";

export default async function AnalyticsPage() {
  await requireAppUser();
  const supabase = await createClient();

  const [{ data: funnel }, { data: cohorts }, { data: stats }, { data: affiliates }] = await Promise.all([
    supabase.from("v_funnel_by_affiliate").select("*"),
    supabase.from("v_monthly_cohorts").select("*"),
    supabase.from("mv_affiliate_stats").select("*"),
    supabase.from("affiliates").select("id, name").is("deleted_at", null),
  ]);

  // Funnel: sum reached_* across affiliates.
  const f = (funnel ?? []).reduce(
    (acc, r) => ({
      qualified: acc.qualified + (r.reached_qualified ?? 0),
      quote: acc.quote + (r.reached_quote_sent ?? 0),
      negotiation: acc.negotiation + (r.reached_negotiation ?? 0),
      application: acc.application + (r.reached_application ?? 0),
      policy: acc.policy + (r.reached_policy ?? 0),
      renewal: acc.renewal + (r.reached_renewal ?? 0),
    }),
    { qualified: 0, quote: 0, negotiation: 0, application: 0, policy: 0, renewal: 0 },
  );
  const funnelData = [
    { stage: "Qualified", count: f.qualified },
    { stage: "Quote Sent", count: f.quote },
    { stage: "Negotiation", count: f.negotiation },
    { stage: "Application", count: f.application },
    { stage: "Policy Issued", count: f.policy },
    { stage: "Renewal", count: f.renewal },
  ];

  // Monthly trend: aggregate cohorts by month.
  const byMonth = new Map<string, { total: number; converted: number }>();
  for (const c of cohorts ?? []) {
    if (!c.cohort_month) continue;
    const key = c.cohort_month;
    const cur = byMonth.get(key) ?? { total: 0, converted: 0 };
    cur.total += c.total ?? 0;
    cur.converted += c.converted ?? 0;
    byMonth.set(key, cur);
  }
  const trend = Array.from(byMonth.entries())
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([m, v]) => ({ month: format(new Date(m), "MMM yy"), ...v }));

  // Leaderboard: affiliates with >=1 lead, ranked by conversion.
  const nameById = new Map((affiliates ?? []).map((a) => [a.id, a.name]));
  const ranked = (stats ?? [])
    .filter((s) => (s.total_leads ?? 0) > 0)
    .map((s) => ({ id: s.affiliate_id!, name: nameById.get(s.affiliate_id!) ?? "—", leads: s.total_leads ?? 0, conversion: s.conversion_rate, decided: (s.n_policy_issued ?? 0) + (s.n_renewal ?? 0) + (s.n_lost ?? 0) }))
    .sort((a, b) => (b.conversion ?? -1) - (a.conversion ?? -1));
  const top = ranked.slice(0, 5);
  const bottom = ranked.filter((r) => r.decided > 0).slice(-5).reverse();

  return (
    <div className="mx-auto max-w-6xl space-y-5">
      <h1 className="text-xl font-semibold tracking-tight">Analytics</h1>

      <div className="grid gap-5 md:grid-cols-2">
        <Card title="Conversion funnel" subtitle="Leads that ever reached each stage">
          <FunnelChart data={funnelData} />
        </Card>
        <Card title="Monthly intake & conversion" subtitle="By intake month">
          {trend.length > 0 ? <MonthlyTrend data={trend} /> : <Empty />}
        </Card>
      </div>

      <div className="grid gap-5 md:grid-cols-2">
        <Leaderboard title="Top affiliates" rows={top} />
        <Leaderboard title="Needs attention" rows={bottom} />
      </div>
    </div>
  );
}

function Card({ title, subtitle, children }: { title: string; subtitle?: string; children: React.ReactNode }) {
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
  return <div className="flex h-[240px] items-center justify-center text-sm text-muted-foreground">Not enough data yet.</div>;
}
function Leaderboard({ title, rows }: { title: string; rows: { id: string; name: string; leads: number; conversion: number | null }[] }) {
  return (
    <Card title={title}>
      <div className="divide-y">
        {rows.map((r) => (
          <Link key={r.id} href={`/affiliates/${r.id}`} className="flex items-center justify-between py-2 text-sm hover:opacity-80">
            <span className="truncate">{r.name}</span>
            <span className="flex items-center gap-3">
              <span className="text-xs text-muted-foreground">{r.leads} leads</span>
              <span className="tabular w-12 text-right font-medium">{formatPct(r.conversion)}</span>
            </span>
          </Link>
        ))}
        {rows.length === 0 && <div className="py-6 text-center text-sm text-muted-foreground">No data.</div>}
      </div>
    </Card>
  );
}
