import { createClient } from "@/lib/supabase/server";
import { requireAppUser, getPermissionMatrix } from "@/lib/auth";
import { can } from "@/lib/domain/permissions";
import { formatPct } from "@/lib/domain/conversion";
import { ExportBar } from "@/components/reports/export-bar";

export const dynamic = "force-dynamic";

export default async function ReportsPage() {
  const [user, matrix, supabase] = await Promise.all([requireAppUser(), getPermissionMatrix(), createClient()]);
  const canExport = can(matrix, user.role, "leads", "export");

  const [{ data: stats }, { data: affiliates }] = await Promise.all([
    supabase.from("v_affiliate_stats").select("*"),
    supabase.from("affiliates").select("id, name").is("deleted_at", null),
  ]);
  const nameById = new Map((affiliates ?? []).map((a) => [a.id, a.name]));

  const rows = (stats ?? [])
    .map((s) => ({
      name: nameById.get(s.affiliate_id!) ?? "—",
      total: s.total_leads ?? 0,
      open: (s.n_policy_issued ?? 0) + (s.n_renewal ?? 0),
      lapsed: s.n_qualified ?? 0,
      lost: s.n_lost ?? 0,
      conversion: s.conversion_rate,
    }))
    .sort((a, b) => b.total - a.total);

  const totals = rows.reduce(
    (acc, r) => ({ total: acc.total + r.total, open: acc.open + r.open, lapsed: acc.lapsed + r.lapsed, lost: acc.lost + r.lost }),
    { total: 0, open: 0, lapsed: 0, lost: 0 },
  );

  return (
    <div className="mx-auto max-w-5xl space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold tracking-tight">Reports</h1>
          <p className="text-xs text-muted-foreground">Performance grouped by affiliate. Exports respect your permissions.</p>
        </div>
        <ExportBar filters={{}} canExport={canExport} />
      </div>

      <div className="overflow-x-auto rounded-lg border">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b bg-muted/40 text-left text-xs text-muted-foreground">
              <th className="px-3 py-2 font-medium">Affiliate</th>
              <th className="px-3 py-2 font-medium">Total</th>
              <th className="px-3 py-2 font-medium">Open</th>
              <th className="px-3 py-2 font-medium">Lapsed</th>
              <th className="px-3 py-2 font-medium">Lost</th>
              <th className="px-3 py-2 font-medium">Conversion</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.name} className="border-b">
                <td className="px-3 py-2 font-medium">{r.name}</td>
                <td className="tabular px-3 py-2">{r.total}</td>
                <td className="tabular px-3 py-2">{r.open}</td>
                <td className="tabular px-3 py-2">{r.lapsed}</td>
                <td className="tabular px-3 py-2">{r.lost}</td>
                <td className="tabular px-3 py-2">{formatPct(r.conversion)}</td>
              </tr>
            ))}
          </tbody>
          <tfoot>
            <tr className="border-t bg-muted/30 font-medium">
              <td className="px-3 py-2">Total</td>
              <td className="tabular px-3 py-2">{totals.total}</td>
              <td className="tabular px-3 py-2">{totals.open}</td>
              <td className="tabular px-3 py-2">{totals.lapsed}</td>
              <td className="tabular px-3 py-2">{totals.lost}</td>
              <td className="tabular px-3 py-2">
                {formatPct(totals.open + totals.lapsed + totals.lost > 0 ? (totals.open + totals.lapsed) / (totals.open + totals.lapsed + totals.lost) : null)}
              </td>
            </tr>
          </tfoot>
        </table>
      </div>
    </div>
  );
}
