import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { requireAppUser } from "@/lib/auth";
import { sourcePeriod, isSourceMode, type SourceMode } from "@/lib/domain/source-period";
import { SourcePeriodToggle } from "@/components/source/source-period-toggle";
import { StageBadge } from "@/components/leads/status-badge";
import { type PipelineStage } from "@/lib/domain/pipeline";
import { shortDate } from "@/lib/format";

export const dynamic = "force-dynamic";

function money(n: number | null): string {
  if (n == null) return "—";
  return n.toLocaleString(undefined, { minimumFractionDigits: 0, maximumFractionDigits: 2 });
}
function name(l: { customer_name: string | null; first_name?: string | null; last_name?: string | null }): string {
  return l.customer_name || [l.first_name, l.last_name].filter(Boolean).join(" ") || "—";
}

export default async function SourceReportingPage({
  searchParams,
}: {
  searchParams: Promise<{ mode?: string; from?: string; to?: string }>;
}) {
  const user = await requireAppUser();
  // Source reporting is for external Source users only. Everyone else goes home.
  if (user.role !== "source") redirect("/dashboard");

  const supabase = await createClient();
  const sp = await searchParams;
  const mode: SourceMode = isSourceMode(sp.mode) ? sp.mode : "this_month";
  const range = sourcePeriod(mode, new Date(), sp.from, sp.to);
  const today = new Date().toISOString().slice(0, 10);

  // Every query below is RLS-scoped to this source's own leads.
  const [{ data: me }, { data: placed }, { data: renewals }] = await Promise.all([
    supabase.from("v_my_source").select("name, commission_pct").maybeSingle(),
    supabase
      .from("leads")
      .select("id, lead_code, customer_name, first_name, last_name, stage, payment_date, premium_amount, renewal_date, policy_number")
      .is("deleted_at", null)
      .not("payment_date", "is", null)
      .gte("payment_date", range.fromISO)
      .lte("payment_date", range.toISO)
      .order("payment_date", { ascending: false }),
    supabase
      .from("leads")
      .select("id, lead_code, customer_name, first_name, last_name, stage, renewal_date, premium_amount, policy_number")
      .is("deleted_at", null)
      .not("renewal_date", "is", null)
      .gte("renewal_date", today)
      .order("renewal_date", { ascending: true })
      .limit(50),
  ]);

  const policies = placed ?? [];
  const totalPremium = policies.reduce((s, p) => s + Number(p.premium_amount ?? 0), 0);
  const commission = me?.commission_pct ?? null;

  return (
    <div className="mx-auto max-w-5xl space-y-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">{me?.name ?? "My"} — reporting</h1>
          <p className="text-sm text-muted-foreground">
            Policies placed <span className="font-medium text-foreground">{range.label.toLowerCase()}</span>, and your upcoming renewals.
          </p>
        </div>
        <SourcePeriodToggle current={mode} />
      </div>

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
        <Kpi label="Policies placed" value={String(policies.length)} />
        <Kpi label="Total premium" value={money(totalPremium)} />
        <Kpi label="Commission" value={commission != null ? `${commission}%` : "—"} />
      </div>

      <Panel title={`Policies placed · ${range.label}`}>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b bg-muted/40 text-left text-xs text-muted-foreground">
                <th className="px-3 py-2 font-medium">Client</th>
                <th className="px-3 py-2 font-medium">Policy #</th>
                <th className="px-3 py-2 font-medium">Placed</th>
                <th className="px-3 py-2 font-medium">Premium</th>
                <th className="px-3 py-2 font-medium">Commission</th>
                <th className="px-3 py-2 font-medium">Status</th>
              </tr>
            </thead>
            <tbody>
              {policies.map((p) => (
                <tr key={p.id} className="border-b">
                  <td className="px-3 py-2">{name(p)}</td>
                  <td className="px-3 py-2 text-muted-foreground">{p.policy_number ?? "—"}</td>
                  <td className="px-3 py-2 text-muted-foreground">{shortDate(p.payment_date)}</td>
                  <td className="tabular px-3 py-2">{money(p.premium_amount)}</td>
                  <td className="tabular px-3 py-2">{commission != null ? `${commission}%` : "—"}</td>
                  <td className="px-3 py-2">{p.stage ? <StageBadge stage={p.stage as PipelineStage} /> : "—"}</td>
                </tr>
              ))}
              {policies.length === 0 && (
                <tr><td colSpan={6} className="px-3 py-8 text-center text-muted-foreground">No policies placed in this period.</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </Panel>

      <Panel title="Upcoming renewals">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b bg-muted/40 text-left text-xs text-muted-foreground">
                <th className="px-3 py-2 font-medium">Client</th>
                <th className="px-3 py-2 font-medium">Policy #</th>
                <th className="px-3 py-2 font-medium">Renewal date</th>
                <th className="px-3 py-2 font-medium">Status</th>
              </tr>
            </thead>
            <tbody>
              {(renewals ?? []).map((r) => (
                <tr key={r.id} className="border-b">
                  <td className="px-3 py-2">{name(r)}</td>
                  <td className="px-3 py-2 text-muted-foreground">{r.policy_number ?? "—"}</td>
                  <td className="px-3 py-2">{shortDate(r.renewal_date)}</td>
                  <td className="px-3 py-2">{r.stage ? <StageBadge stage={r.stage as PipelineStage} /> : "—"}</td>
                </tr>
              ))}
              {(renewals ?? []).length === 0 && (
                <tr><td colSpan={4} className="px-3 py-8 text-center text-muted-foreground">No upcoming renewals.</td></tr>
              )}
            </tbody>
          </table>
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
function Panel({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="rounded-lg border">
      <div className="border-b px-4 py-2.5 text-sm font-medium">{title}</div>
      <div className="p-4">{children}</div>
    </div>
  );
}
