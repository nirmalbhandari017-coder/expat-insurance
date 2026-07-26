import { createClient } from "@/lib/supabase/server";
import { requireAppUser, getPermissionMatrix } from "@/lib/auth";
import { can } from "@/lib/domain/permissions";
import { BrokersTable, type BrokerRow, type BrokerStat } from "@/components/brokers/brokers-table";
import type { Option } from "@/lib/types";

export const dynamic = "force-dynamic";

export default async function BrokersPage() {
  const [user, matrix, supabase] = await Promise.all([
    requireAppUser(),
    getPermissionMatrix(),
    createClient(),
  ]);

  const [{ data: brokers }, { data: stats }, { data: appUsers }] = await Promise.all([
    supabase
      .from("brokers")
      .select(
        "id, first_name, last_name, full_name, company, email, phone, notes, app_user_id, is_active",
      )
      .is("deleted_at", null)
      .order("full_name"),
    supabase.from("v_broker_stats").select("*"),
    supabase.from("app_users").select("id, full_name, email").is("deleted_at", null).order("full_name"),
  ]);

  return (
    <BrokersTable
      brokers={(brokers ?? []) as BrokerRow[]}
      stats={(stats ?? []) as BrokerStat[]}
      appUsers={(appUsers ?? []).map((u): Option => ({ id: u.id, label: `${u.full_name} (${u.email})` }))}
      canManage={can(matrix, user.role, "brokers", "create")}
    />
  );
}
