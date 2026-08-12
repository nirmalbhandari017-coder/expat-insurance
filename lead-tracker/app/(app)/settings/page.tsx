import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { requireInternal } from "@/lib/auth";
import { TeamTable, type TeamMember } from "@/components/settings/team-table";
import { RulesTable, type Rule } from "@/components/settings/rules-table";
import { ExternalAccess, type EntityRow, type UserOption } from "@/components/settings/external-access";
import { ROLE_LABEL, type Role } from "@/lib/domain/permissions";

export const dynamic = "force-dynamic";

export default async function SettingsPage() {
  const user = await requireInternal();
  if (user.role !== "admin") redirect("/dashboard");
  const supabase = await createClient();

  const [{ data: members }, { data: rules }, { data: affiliates }, { data: brokers }] = await Promise.all([
    supabase.from("app_users").select("id, full_name, email, role, is_rm").is("deleted_at", null).order("created_at"),
    supabase.from("notification_rules").select("id, rule_key, name, threshold_days, is_active, notify_assigned_rm").order("threshold_days", { nullsFirst: true }),
    supabase.from("affiliates").select("id, name, app_user_id").is("deleted_at", null).order("name"),
    supabase.from("brokers").select("id, full_name, app_user_id").is("deleted_at", null).order("full_name"),
  ]);

  const sources: EntityRow[] = (affiliates ?? []).map((a) => ({ id: a.id, name: a.name, linkedUserId: a.app_user_id }));
  const crms: EntityRow[] = (brokers ?? []).map((b) => ({ id: b.id, name: b.full_name ?? "—", linkedUserId: b.app_user_id }));
  // Candidate logins: everyone except admins (you don't turn an admin into an external login).
  const userOptions: UserOption[] = (members ?? [])
    .filter((m) => m.role !== "admin")
    .map((m) => ({ id: m.id, label: `${m.full_name} · ${m.email} (${ROLE_LABEL[m.role as Role]})` }));

  return (
    <div className="mx-auto max-w-5xl space-y-8">
      <div>
        <h1 className="text-xl font-semibold tracking-tight">Settings</h1>
        <p className="text-xs text-muted-foreground">Admin only. Manage team access, external partner logins, and notification thresholds.</p>
      </div>

      <section className="space-y-3">
        <div>
          <h2 className="text-sm font-medium">Team access</h2>
          <p className="text-xs text-muted-foreground">New signups start as Read Only. RM Staff see only leads assigned to them.</p>
        </div>
        <TeamTable members={(members ?? []) as TeamMember[]} currentUserId={user.id} />
      </section>

      <section className="space-y-3">
        <div>
          <h2 className="text-sm font-medium">External access (Sources &amp; CRMs)</h2>
          <p className="text-xs text-muted-foreground">Link partner logins to a Source or CRM. Data isolation is enforced in the database.</p>
        </div>
        <ExternalAccess sources={sources} crms={crms} users={userOptions} />
      </section>

      <section className="space-y-3">
        <div>
          <h2 className="text-sm font-medium">Notification rules</h2>
          <p className="text-xs text-muted-foreground">Thresholds are read by the hourly scan — no deploy needed to change them.</p>
        </div>
        <RulesTable rules={(rules ?? []) as Rule[]} />
      </section>
    </div>
  );
}
