import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { requireInternal } from "@/lib/auth";
import { TeamTable, type TeamMember } from "@/components/settings/team-table";
import { RulesTable, type Rule } from "@/components/settings/rules-table";
import { ExternalAccess, type EntityRow, type UserOption } from "@/components/settings/external-access";
import { ROLE_LABEL, type Role } from "@/lib/domain/permissions";
import type { Option } from "@/lib/types";

export const dynamic = "force-dynamic";

export default async function SettingsPage() {
  const user = await requireInternal();
  if (user.role !== "admin") redirect("/dashboard");
  const supabase = await createClient();

  const [{ data: members }, { data: rules }, { data: affiliates }, { data: brokers }] =
    await Promise.all([
      supabase
        .from("app_users")
        .select("id, full_name, email, role")
        .is("deleted_at", null)
        .order("created_at"),
      supabase
        .from("notification_rules")
        .select("id, rule_key, name, threshold_days, is_active, notify_assigned_rm")
        .order("threshold_days", { nullsFirst: true }),
      supabase.from("affiliates").select("id, name, app_user_id").is("deleted_at", null).order("name"),
      supabase.from("brokers").select("id, full_name, app_user_id").is("deleted_at", null).order("full_name"),
    ]);

  const sourceByUser = new Map(
    (affiliates ?? []).filter((a) => a.app_user_id).map((a) => [a.app_user_id!, a]),
  );
  const crmByUser = new Map(
    (brokers ?? []).filter((b) => b.app_user_id).map((b) => [b.app_user_id!, b]),
  );

  const teamMembers: TeamMember[] = (members ?? []).map((m) => ({
    id: m.id,
    full_name: m.full_name,
    email: m.email,
    role: m.role as Role,
    linkedSourceId: sourceByUser.get(m.id)?.id ?? null,
    linkedCrmName: crmByUser.get(m.id)?.full_name ?? null,
  }));

  const sourceOptions: Option[] = (affiliates ?? []).map((a) => ({ id: a.id, label: a.name }));

  const sources: EntityRow[] = (affiliates ?? []).map((a) => ({
    id: a.id,
    name: a.name,
    linkedUserId: a.app_user_id,
  }));
  const crms: EntityRow[] = (brokers ?? []).map((b) => ({
    id: b.id,
    name: b.full_name ?? "—",
    linkedUserId: b.app_user_id,
  }));
  const userOptions: UserOption[] = (members ?? [])
    .filter((m) => m.role !== "admin")
    .map((m) => ({ id: m.id, label: `${m.full_name} · ${m.email} (${ROLE_LABEL[m.role as Role]})` }));

  return (
    <div className="mx-auto max-w-5xl space-y-8">
      <div>
        <h1 className="text-xl font-semibold tracking-tight">Settings</h1>
        <p className="text-xs text-muted-foreground">
          Admin only. Manage team access, partner logins, and notification thresholds.
        </p>
      </div>

      <section className="space-y-3">
        <div>
          <h2 className="text-sm font-medium">Team access</h2>
          <p className="text-xs text-muted-foreground">
            New signups start as Read Only. A <b>CRM</b> sees only leads assigned to their CRM
            record; a <b>Source</b> sees only their own source&apos;s leads.
          </p>
        </div>
        <TeamTable members={teamMembers} currentUserId={user.id} sources={sourceOptions} />
      </section>

      <section className="space-y-3">
        <div>
          <h2 className="text-sm font-medium">Access links (Sources &amp; CRMs)</h2>
          <p className="text-xs text-muted-foreground">
            The same links, viewed by record instead of by person. Data isolation is enforced in the
            database.
          </p>
        </div>
        <ExternalAccess sources={sources} crms={crms} users={userOptions} />
      </section>

      <section className="space-y-3">
        <div>
          <h2 className="text-sm font-medium">Notification rules</h2>
          <p className="text-xs text-muted-foreground">
            Thresholds are read by the hourly scan — no deploy needed to change them.
          </p>
        </div>
        <RulesTable rules={(rules ?? []) as Rule[]} />
      </section>
    </div>
  );
}
