import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { requireAppUser } from "@/lib/auth";
import { TeamTable, type TeamMember } from "@/components/settings/team-table";
import { RulesTable, type Rule } from "@/components/settings/rules-table";

export const dynamic = "force-dynamic";

export default async function SettingsPage() {
  const user = await requireAppUser();
  if (user.role !== "admin") redirect("/dashboard");
  const supabase = await createClient();

  const [{ data: members }, { data: rules }] = await Promise.all([
    supabase.from("app_users").select("id, full_name, email, role, is_rm").is("deleted_at", null).order("created_at"),
    supabase.from("notification_rules").select("id, rule_key, name, threshold_days, is_active, notify_assigned_rm").order("threshold_days", { nullsFirst: true }),
  ]);

  return (
    <div className="mx-auto max-w-5xl space-y-8">
      <div>
        <h1 className="text-xl font-semibold tracking-tight">Settings</h1>
        <p className="text-xs text-muted-foreground">Admin only. Manage team access and notification thresholds.</p>
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
          <h2 className="text-sm font-medium">Notification rules</h2>
          <p className="text-xs text-muted-foreground">Thresholds are read by the hourly scan — no deploy needed to change them.</p>
        </div>
        <RulesTable rules={(rules ?? []) as Rule[]} />
      </section>
    </div>
  );
}
