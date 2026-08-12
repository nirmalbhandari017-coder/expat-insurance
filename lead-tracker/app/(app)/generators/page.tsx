import { createClient } from "@/lib/supabase/server";
import { requireInternal, getPermissionMatrix } from "@/lib/auth";
import { can } from "@/lib/domain/permissions";
import {
  GeneratorsTable,
  type GeneratorRow,
  type GeneratorStat,
} from "@/components/generators/generators-table";
import type { Option } from "@/lib/types";

export const dynamic = "force-dynamic";

export default async function GeneratorsPage() {
  const [user, matrix, supabase] = await Promise.all([
    requireInternal(),
    getPermissionMatrix(),
    createClient(),
  ]);

  const [{ data: generators }, { data: stats }, { data: affiliates }] = await Promise.all([
    supabase
      .from("generators")
      .select("id, first_name, last_name, full_name, affiliate_id, email, phone, notes, is_active")
      .is("deleted_at", null)
      .order("full_name"),
    supabase.from("v_generator_stats").select("*"),
    supabase.from("affiliates").select("id, name").is("deleted_at", null).order("name"),
  ]);

  return (
    <GeneratorsTable
      generators={(generators ?? []) as GeneratorRow[]}
      stats={(stats ?? []) as GeneratorStat[]}
      affiliates={(affiliates ?? []).map((a): Option => ({ id: a.id, label: a.name }))}
      canManage={can(matrix, user.role, "generators", "create")}
    />
  );
}
