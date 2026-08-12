import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { requireAppUser, homeForRole } from "@/lib/auth";
import {
  PIPELINE_STAGES,
  STAGE_LABEL,
  STAGE_TOKEN,
  QUALIFICATION_LABEL,
  type PipelineStage,
  type QualificationStatus,
} from "@/lib/domain/pipeline";
import { conversionRate, renewalRate, formatPct, type StageCounts } from "@/lib/domain/conversion";
import { StageBadge, QualificationBadge } from "@/components/leads/status-badge";
import { formatPct as pct } from "@/lib/domain/conversion";
import { relativeAge, shortDate } from "@/lib/format";
import { periodRange, isPeriod, type Period } from "@/lib/domain/period";
import { isInternalRole } from "@/lib/domain/permissions";
import { PeriodToggle } from "@/components/dashboard/period-toggle";

export const dynamic = "force-dynamic";

export default async function DashboardPage({
  searchParams,
}: {
  searchParams: Promise<{ period?: string }>;
}) {
  const user = await requireAppUser();
  // External users never see the internal dashboard; send them to their home (§11).
  if (!isInternalRole(user.role)) redirect(homeForRole(user.role));
  const supabase = await createClient();
  const sp = await searchParams;
  const period: Period = isPeriod(sp.period) ? sp.period : "ytd";
  const range = periodRange(period);

  const [
    { data: statusRows },
    { data: stats },
    { data: affiliates },
    { data: aging },
    { data: activity },
    { data: recent },
  ] = await Promise.all([
    supabase
      .from("leads")
      .select("qualification, stage, opportunity")
      .is("deleted_at", null)
      .gte("created_at", range.fromISO)
      .lte("created_at", range.toISO),
    supabase.from("v_affiliate_stats").select("*"),
    supabase.from("affiliates").select("id, name").is("deleted_at", null),
    supabase
      .from("v_lead_aging")
      .select("id, lead_code, customer_name, qualification, stage, stage_entered_at")
      .order("stage_entered_at", { ascending: true })
      .limit(6),
    supabase
      .from("activity_log")
      .select("summary, created_at, kind, actor:app_users(full_name)")
      .order("created_at", { ascending: false })
      .limit(8),
    supabase
      .from("leads")
      .select("id, lead_code, customer_name, qualification, stage, opportunity, updated_at, affiliate:affiliates(name)")
      .is("deleted_at", null)
      .order("updated_at", { ascending: false })
      .limit(6),
  ]);

  const stageCounts: StageCounts = {};
  const qualCounts: Record<QualificationStatus, number> = {
    pending: 0,
    qualified: 0,
    not_qualified: 0,
  };
  let lost = 0;
  for (const r of statusRows ?? []) {
    qualCounts[r.qualification as QualificationStatus]++;
    if (r.opportunity === "lost") lost++;
    else if (r.stage) {
      const s = r.stage as PipelineStage;
      stageCounts[s] = (stageCounts[s] ?? 0) + 1;
    }
  }
  const total = (statusRows ?? []).length;
  const inPipeline = Object.values(stageCounts).reduce((a, b) => a + (b ?? 0), 0);

  const nameById = new Map((affiliates ?? []).map((a) => [a.id, a.name]));
  const ranked = (stats ?? [])
    .filter((s) => (s.total_leads ?? 0) > 0)
    .map((s) => ({
      id: s.affiliate_id!,
      name: nameById.get(s.affiliate_id!) ?? "—",
      leads: s.total_leads ?? 0,
      conversion: s.conversion_rate,
    }))
    .sort((a, b) => (b.conversion ?? -1) - (a.conversion ?? -1));
  const topAffiliates = ranked.slice(0, 5);

  return (
    <div className="mx-auto max-w-6xl space-y-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Dashboard</h1>
          <p className="text-sm text-muted-foreground">
            Welcome back, {user.full_name.split(" ")[0]}. Metrics for{" "}
            <span className="font-medium text-foreground">{range.label.toLowerCase()}</span>.
            {user.role === "rm_staff" && " Leads assigned to you."}
          </p>
        </div>
        <PeriodToggle current={period} />
      </div>

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-5">
        <Kpi label="Total leads" value={String(total)} />
        <Kpi label="Pending qualification" value={String(qualCounts.pending)} />
        <Kpi label="In pipeline" value={String(inPipeline)} />
        <Kpi label="Conversion rate" value={formatPct(conversionRate(stageCounts, lost))} />
        <Kpi label="Renewal rate" value={formatPct(renewalRate(stageCounts))} />
      </div>

      <div className="grid gap-5 md:grid-cols-2">
        <Panel title="Pipeline by stage">
          <div className="space-y-2">
            {PIPELINE_STAGES.map((s) => {
              const n = stageCounts[s] ?? 0;
              const width = inPipeline ? (n / inPipeline) * 100 : 0;
              return (
                <Link
                  key={s}
                  href={`/pipeline?stage=${s}`}
                  className="flex items-center gap-3 rounded px-1 py-0.5 text-sm hover:bg-muted/40"
                >
                  <div className="flex w-40 items-center gap-2 text-muted-foreground">
                    <span
                      className="h-2 w-2 rounded-full"
                      style={{ backgroundColor: `hsl(var(--status-${STAGE_TOKEN[s]}))` }}
                    />
                    {STAGE_LABEL[s]}
                  </div>
                  <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-muted">
                    <div
                      className="h-full rounded-full"
                      style={{
                        width: `${width}%`,
                        backgroundColor: `hsl(var(--status-${STAGE_TOKEN[s]}))`,
                      }}
                    />
                  </div>
                  <span className="tabular w-8 text-right font-medium">{n}</span>
                </Link>
              );
            })}
            <Link
              href="/pipeline?opportunity=lost"
              className="flex items-center gap-3 rounded border-t px-1 pt-2 text-sm hover:bg-muted/40"
            >
              <div className="w-40 text-muted-foreground">Lost</div>
              <div className="flex-1" />
              <span className="tabular w-8 text-right font-medium">{lost}</span>
            </Link>
          </div>
        </Panel>

        <Panel title="Qualification">
          <div className="space-y-2">
            {(Object.keys(qualCounts) as QualificationStatus[]).map((q) => (
              <Link
                key={q}
                href={`/pipeline?qualification=${q}`}
                className="flex items-center justify-between rounded px-1 py-1 text-sm hover:bg-muted/40"
              >
                <QualificationBadge qualification={q} />
                <span className="tabular font-medium">{qualCounts[q]}</span>
              </Link>
            ))}
          </div>
          <div className="mt-4 border-t pt-3">
            <div className="mb-2 text-xs font-medium text-muted-foreground">Top sources · all-time</div>
            <div className="divide-y">
              {topAffiliates.map((a) => (
                <Link
                  key={a.id}
                  href={`/affiliates/${a.id}`}
                  className="flex items-center justify-between py-1.5 text-sm hover:opacity-80"
                >
                  <span className="truncate">{a.name}</span>
                  <span className="flex items-center gap-3">
                    <span className="text-xs text-muted-foreground">{a.leads} leads</span>
                    <span className="tabular w-12 text-right font-medium">{pct(a.conversion)}</span>
                  </span>
                </Link>
              ))}
              {topAffiliates.length === 0 && (
                <p className="py-3 text-sm text-muted-foreground">No leads yet.</p>
              )}
            </div>
          </div>
        </Panel>

        <Panel title="Aging — needs attention">
          <div className="space-y-1.5">
            {(aging ?? []).map((l) => (
              <Link
                key={l.id}
                href={`/leads/${l.lead_code}`}
                className="flex items-center justify-between rounded px-1 py-1 text-sm hover:bg-muted/40"
              >
                <span className="flex items-center gap-2 truncate">
                  {l.stage ? (
                    <StageBadge stage={l.stage as PipelineStage} />
                  ) : (
                    <span className="text-xs text-muted-foreground">
                      {QUALIFICATION_LABEL[l.qualification as QualificationStatus]}
                    </span>
                  )}{" "}
                  {l.customer_name}
                </span>
                <span className="shrink-0 text-xs text-muted-foreground">
                  {relativeAge(l.stage_entered_at)} in stage
                </span>
              </Link>
            ))}
            {(aging ?? []).length === 0 && (
              <p className="py-4 text-sm text-muted-foreground">Nothing aging. 🎉</p>
            )}
          </div>
        </Panel>

        <Panel title="Recent activity">
          <ol className="space-y-1.5">
            {(activity ?? []).map((a, i) => (
              <li key={i} className="flex items-center justify-between text-sm">
                <span className="truncate text-muted-foreground">{a.summary}</span>
                <span className="shrink-0 text-xs text-muted-foreground">
                  {relativeAge(a.created_at)}
                </span>
              </li>
            ))}
            {(activity ?? []).length === 0 && (
              <p className="py-4 text-sm text-muted-foreground">No activity yet.</p>
            )}
          </ol>
        </Panel>
      </div>

      <Panel title="Recently updated leads" href="/pipeline">
        <div className="divide-y">
          {(recent ?? []).map((l) => (
            <Link
              key={l.id}
              href={`/leads/${l.lead_code}`}
              className="flex items-center justify-between py-2 text-sm hover:bg-muted/30"
            >
              <span className="flex items-center gap-2">
                <span className="tabular text-xs text-muted-foreground">{l.lead_code}</span>
                <span className="font-medium">{l.customer_name}</span>
                <span className="text-muted-foreground">
                  · {(l.affiliate as { name?: string } | null)?.name ?? "—"}
                </span>
              </span>
              <span className="flex items-center gap-3">
                {l.stage ? (
                  <StageBadge stage={l.stage as PipelineStage} />
                ) : (
                  <QualificationBadge qualification={l.qualification as QualificationStatus} />
                )}
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
function Panel({
  title,
  href,
  children,
}: {
  title: string;
  href?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="rounded-lg border">
      <div className="flex items-center justify-between border-b px-4 py-2.5">
        <span className="text-sm font-medium">{title}</span>
        {href && (
          <Link href={href} className="text-xs text-muted-foreground hover:text-foreground">
            View all →
          </Link>
        )}
      </div>
      <div className="p-4">{children}</div>
    </div>
  );
}
