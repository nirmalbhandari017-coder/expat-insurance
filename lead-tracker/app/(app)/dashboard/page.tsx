import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { requireAppUser } from "@/lib/auth";
import { PIPELINE_STATUSES, STATUS_LABEL, STATUS_TOKEN, type LeadStatus } from "@/lib/domain/pipeline";
import { conversionRate, retentionRate, formatPct, type StatusCounts } from "@/lib/domain/conversion";
import { StatusBadge } from "@/components/leads/status-badge";
import { formatPct as pct } from "@/lib/domain/conversion";
import { relativeAge, shortDate } from "@/lib/format";

export const dynamic = "force-dynamic";

export default async function DashboardPage() {
  const user = await requireAppUser();
  const supabase = await createClient();

  const [{ data: statusRows }, { data: stats }, { data: affiliates }, { data: aging }, { data: activity }, { data: recent }] =
    await Promise.all([
      supabase.from("leads").select("current_status").is("deleted_at", null),
      supabase.from("mv_affiliate_stats").select("*"),
      supabase.from("affiliates").select("id, name").is("deleted_at", null),
      supabase.from("v_lead_aging").select("id, lead_code, customer_name, current_status, stage_entered_at").order("stage_entered_at", { ascending: true }).limit(6),
      supabase.from("activity_log").select("summary, created_at, kind, actor:app_users(full_name)").order("created_at", { ascending: false }).limit(8),
      supabase.from("leads").select("id, lead_code, customer_name, current_status, updated_at, affiliate:affiliates(name)").is("deleted_at", null).order("updated_at", { ascending: false }).limit(6),
    ]);

  const counts: StatusCounts = {};
  for (const r of statusRows ?? []) {
    const s = r.current_status as LeadStatus;
    counts[s] = (counts[s] ?? 0) + 1;
  }
  const total = (statusRows ?? []).length;

  const nameById = new Map((affiliates ?? []).map((a) => [a.id, a.name]));
  const ranked = (stats ?? []).filter((s) => (s.decided ?? 0) > 0)
    .map((s) => ({ id: s.affiliate_id!, name: nameById.get(s.affiliate_id!) ?? "—", leads: s.total_leads ?? 0, conversion: s.conversion_rate }))
    .sort((a, b) => (b.conversion ?? -1) - (a.conversion ?? -1));
  const topAffiliates = ranked.slice(0, 5);

  return (
    <div className="mx-auto max-w-6xl space-y-5">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Dashboard</h1>
        <p className="text-sm text-muted-foreground">
          Welcome back, {user.full_name.split(" ")[0]}.
          {user.role === "rm_staff" && " Showing leads assigned to you."}
        </p>
      </div>

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <Kpi label="Total leads" value={String(total)} />
        <Kpi label="Conversion rate" value={formatPct(conversionRate(counts))} />
        <Kpi label="Retention rate" value={formatPct(retentionRate(counts))} />
        <Kpi label="Open accounts" value={String(counts.account_open ?? 0)} />
      </div>

      <div className="grid gap-5 md:grid-cols-2">
        <Panel title="Pipeline by status">
          <div className="space-y-2">
            {PIPELINE_STATUSES.map((s) => {
              const n = counts[s] ?? 0;
              const width = total ? (n / total) * 100 : 0;
              return (
                <Link key={s} href={`/pipeline?status=${s}`} className="flex items-center gap-3 rounded px-1 py-0.5 text-sm hover:bg-muted/40">
                  <div className="flex w-32 items-center gap-2 text-muted-foreground">
                    <span className="h-2 w-2 rounded-full" style={{ backgroundColor: `hsl(var(--status-${STATUS_TOKEN[s]}))` }} />
                    {STATUS_LABEL[s]}
                  </div>
                  <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-muted">
                    <div className="h-full rounded-full" style={{ width: `${width}%`, backgroundColor: `hsl(var(--status-${STATUS_TOKEN[s]}))` }} />
                  </div>
                  <span className="tabular w-8 text-right font-medium">{n}</span>
                </Link>
              );
            })}
          </div>
        </Panel>

        <Panel title="Top affiliates" href="/analytics">
          <div className="divide-y">
            {topAffiliates.map((a) => (
              <Link key={a.id} href={`/affiliates/${a.id}`} className="flex items-center justify-between py-2 text-sm hover:opacity-80">
                <span className="truncate">{a.name}</span>
                <span className="flex items-center gap-3">
                  <span className="text-xs text-muted-foreground">{a.leads} leads</span>
                  <span className="tabular w-12 text-right font-medium">{pct(a.conversion)}</span>
                </span>
              </Link>
            ))}
            {topAffiliates.length === 0 && <p className="py-4 text-sm text-muted-foreground">No decided leads yet.</p>}
          </div>
        </Panel>

        <Panel title="Aging — needs attention">
          <div className="space-y-1.5">
            {(aging ?? []).map((l) => (
              <Link key={l.id} href={`/leads/${l.lead_code}`} className="flex items-center justify-between rounded px-1 py-1 text-sm hover:bg-muted/40">
                <span className="flex items-center gap-2 truncate"><StatusBadge status={l.current_status as LeadStatus} /> {l.customer_name}</span>
                <span className="shrink-0 text-xs text-muted-foreground">{relativeAge(l.stage_entered_at)} in stage</span>
              </Link>
            ))}
            {(aging ?? []).length === 0 && <p className="py-4 text-sm text-muted-foreground">Nothing aging. 🎉</p>}
          </div>
        </Panel>

        <Panel title="Recent activity">
          <ol className="space-y-1.5">
            {(activity ?? []).map((a, i) => (
              <li key={i} className="flex items-center justify-between text-sm">
                <span className="truncate text-muted-foreground">{a.summary}</span>
                <span className="shrink-0 text-xs text-muted-foreground">{relativeAge(a.created_at)}</span>
              </li>
            ))}
            {(activity ?? []).length === 0 && <p className="py-4 text-sm text-muted-foreground">No activity yet.</p>}
          </ol>
        </Panel>
      </div>

      <Panel title="Recently updated leads" href="/pipeline">
        <div className="divide-y">
          {(recent ?? []).map((l) => (
            <Link key={l.id} href={`/leads/${l.lead_code}`} className="flex items-center justify-between py-2 text-sm hover:bg-muted/30">
              <span className="flex items-center gap-2">
                <span className="tabular text-xs text-muted-foreground">{l.lead_code}</span>
                <span className="font-medium">{l.customer_name}</span>
                <span className="text-muted-foreground">· {(l.affiliate as { name?: string } | null)?.name ?? "—"}</span>
              </span>
              <span className="flex items-center gap-3">
                <StatusBadge status={l.current_status as LeadStatus} />
                <span className="text-xs text-muted-foreground">{shortDate(l.updated_at)}</span>
              </span>
            </Link>
          ))}
        </div>
      </Panel>
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
function Panel({ title, href, children }: { title: string; href?: string; children: React.ReactNode }) {
  return (
    <div className="rounded-lg border">
      <div className="flex items-center justify-between border-b px-4 py-2.5">
        <span className="text-sm font-medium">{title}</span>
        {href && <Link href={href} className="text-xs text-muted-foreground hover:text-foreground">View all →</Link>}
      </div>
      <div className="p-4">{children}</div>
    </div>
  );
}
