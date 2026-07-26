import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { requireAppUser, getPermissionMatrix } from "@/lib/auth";
import { can, scopeOf } from "@/lib/domain/permissions";
import { logLeadView } from "@/lib/actions/interactions";
import { LeadDetail } from "@/components/leads/lead-detail";
import type { PipelinePerms } from "@/lib/types";

export const dynamic = "force-dynamic";

export default async function LeadDetailPage({ params }: { params: Promise<{ leadCode: string }> }) {
  const { leadCode } = await params;
  const [user, matrix, supabase] = await Promise.all([requireAppUser(), getPermissionMatrix(), createClient()]);

  const { data: lead } = await supabase
    .from("leads")
    .select(
      "*, affiliate:affiliates(id, name), rm:app_users!leads_assigned_rm_id_fkey(id, full_name), itype:insurance_types(name)",
    )
    .eq("lead_code", leadCode)
    .is("deleted_at", null)
    .maybeSingle();

  if (!lead) notFound();

  const [{ data: history }, { data: comments }, { data: activity }, { data: documents }, { data: rms }] =
    await Promise.all([
      supabase
        .from("lead_status_history")
        .select("*, changed_by_user:app_users!lead_status_history_changed_by_fkey(full_name)")
        .eq("lead_id", lead.id)
        .order("changed_at", { ascending: false }),
      supabase
        .from("comments")
        .select("*, author:app_users(full_name)")
        .eq("lead_id", lead.id)
        .is("deleted_at", null)
        .order("created_at", { ascending: true }),
      supabase
        .from("activity_log")
        .select("*, actor:app_users(full_name)")
        .eq("lead_id", lead.id)
        .order("created_at", { ascending: false })
        .limit(50),
      supabase.from("documents").select("*").eq("lead_id", lead.id).is("deleted_at", null).order("created_at", { ascending: false }),
      supabase.from("app_users").select("id, full_name").eq("is_rm", true).is("deleted_at", null).order("full_name"),
    ]);

  // View audit (app-layer, per the GDPR posture).
  void logLeadView(lead.id);

  const perms: PipelinePerms = {
    canCreate: can(matrix, user.role, "leads", "create"),
    canUpdate: can(matrix, user.role, "leads", "update"),
    canDelete: can(matrix, user.role, "leads", "delete"),
    canCorrect: user.role === "admin" || user.role === "business_development",
    updateScope: scopeOf(matrix, user.role, "leads", "update"),
    currentUserId: user.id,
  };
  const canComment = can(matrix, user.role, "comments", "create");
  const canViewAudit = can(matrix, user.role, "audit", "read");

  return (
    <LeadDetail
      lead={lead as never}
      history={(history ?? []) as never}
      comments={(comments ?? []) as never}
      activity={(activity ?? []) as never}
      documents={(documents ?? []) as never}
      rms={(rms ?? []).map((r) => ({ id: r.id, label: r.full_name }))}
      perms={perms}
      canComment={canComment}
      canViewAudit={canViewAudit}
    />
  );
}
