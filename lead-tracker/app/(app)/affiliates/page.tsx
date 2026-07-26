import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { requireAppUser, getPermissionMatrix } from "@/lib/auth";
import { can } from "@/lib/domain/permissions";
import { formatPct } from "@/lib/domain/conversion";
import { PinButton } from "@/components/affiliates/pin-button";
import { NewAffiliateDialog } from "@/components/affiliates/new-affiliate-dialog";
import { AffiliateRowActions } from "@/components/affiliates/affiliate-row-actions";

export const dynamic = "force-dynamic";

export default async function AffiliatesPage() {
  const [user, matrix, supabase] = await Promise.all([requireAppUser(), getPermissionMatrix(), createClient()]);
  const canManage = can(matrix, user.role, "affiliates", "create");
  const canUpdate = can(matrix, user.role, "affiliates", "update");
  const canDelete = can(matrix, user.role, "affiliates", "delete");
  const canSeeCommission = canUpdate;

  const [{ data: affiliates }, { data: stats }, { data: commissions }, { data: pins }] = await Promise.all([
    supabase.from("affiliates").select("id, name, type, country, is_active, contact_person").is("deleted_at", null).order("name"),
    supabase.from("mv_affiliate_stats").select("*"),
    supabase.from("v_affiliate_commission").select("affiliate_id, commission_pct"),
    supabase.from("pinned_affiliates").select("affiliate_id"),
  ]);

  const statById = new Map((stats ?? []).map((s) => [s.affiliate_id, s]));
  const commById = new Map((commissions ?? []).map((c) => [c.affiliate_id, c.commission_pct]));
  const pinnedSet = new Set((pins ?? []).map((p) => p.affiliate_id));

  const rows = (affiliates ?? []).sort((a, b) => Number(pinnedSet.has(b.id)) - Number(pinnedSet.has(a.id)));

  return (
    <div className="mx-auto max-w-6xl space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold tracking-tight">Affiliates</h1>
          <p className="text-xs text-muted-foreground">{rows.length} partners · metrics as of last refresh</p>
        </div>
        {canManage && <NewAffiliateDialog canSeeCommission={canSeeCommission} />}
      </div>

      <div className="overflow-x-auto rounded-lg border">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b bg-muted/40 text-left text-xs text-muted-foreground">
              <th className="w-8 px-3 py-2" />
              <th className="px-3 py-2 font-medium">Affiliate</th>
              <th className="px-3 py-2 font-medium">Leads</th>
              <th className="px-3 py-2 font-medium">Open</th>
              <th className="px-3 py-2 font-medium">Lost</th>
              <th className="px-3 py-2 font-medium">Conversion</th>
              <th className="px-3 py-2 font-medium">Retention</th>
              {canSeeCommission && <th className="px-3 py-2 font-medium">Comm.</th>}
              <th className="px-3 py-2 font-medium">Status</th>
              <th className="w-8 px-3 py-2" />
            </tr>
          </thead>
          <tbody>
            {rows.map((a) => {
              const s = statById.get(a.id);
              const comm = commById.get(a.id);
              return (
                <tr key={a.id} className="border-b hover:bg-muted/30">
                  <td className="px-3 py-2"><PinButton affiliateId={a.id} pinned={pinnedSet.has(a.id)} /></td>
                  <td className="px-3 py-2">
                    <Link href={`/affiliates/${a.id}`} className="font-medium hover:underline">{a.name}</Link>
                    {a.contact_person && <div className="text-xs text-muted-foreground">{a.contact_person}</div>}
                  </td>
                  <td className="tabular px-3 py-2">{s?.total_leads ?? 0}</td>
                  <td className="tabular px-3 py-2">{(s?.n_policy_issued ?? 0) + (s?.n_renewal ?? 0)}</td>
                  <td className="tabular px-3 py-2">{s?.n_lost ?? 0}</td>
                  <td className="tabular px-3 py-2">{formatPct(s?.conversion_rate ?? null)}</td>
                  <td className="tabular px-3 py-2">{s?.n_qualified ?? 0}</td>
                  {canSeeCommission && <td className="tabular px-3 py-2">{comm != null ? `${comm}%` : "—"}</td>}
                  <td className="px-3 py-2">
                    <span className={a.is_active ? "text-status-open" : "text-muted-foreground"}>
                      {a.is_active ? "Active" : "Inactive"}
                    </span>
                  </td>
                  <td className="px-3 py-2">
                    <AffiliateRowActions id={a.id} name={a.name} isActive={a.is_active} canManage={canManage} canDelete={canDelete} />
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
