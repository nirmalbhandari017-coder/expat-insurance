import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { requireAppUser, getPermissionMatrix } from "@/lib/auth";
import { can, scopeOf } from "@/lib/domain/permissions";
import { logLeadView } from "@/lib/actions/interactions";
import { LeadDetail } from "@/components/leads/lead-detail";
import type { PipelinePerms } from "@/lib/types";

export const dynamic = "force-dynamic";

export default async function LeadDetailPage({
  params,
}: {
  params: Promise<{ leadCode: string }>;
}) {
  const { leadCode } = await params;
  const [user, matrix, supabase] = await Promise.all([
    requireAppUser(),
    getPermissionMatrix(),
    createClient(),
  ]);

  const { data: lead } = await supabase
    .from("leads")
    .select(
      "*, affiliate:affiliates(id, name), generator:generators(id, full_name), broker:brokers(id, full_name, company), lost_reason:lost_reasons(label), products:lead_products(product:products(id, name))",
    )
    .eq("lead_code", leadCode)
    .is("deleted_at", null)
    .maybeSingle();

  if (!lead) notFound();

  const [
    { data: history },
    { data: comments },
    { data: activity },
    { data: documents },
    { data: brokers },
    { data: sources },
  ] = await Promise.all([
      supabase
        .from("lead_stage_history")
        .select("*, changed_by_user:app_users!lead_stage_history_changed_by_fkey(full_name)")
        .eq("lead_id", lead.id)
        .order("changed_at", { ascending: false }),
      supabase
        .from("comments")
        .select("*, author:app_users(full_name)")
        .eq("lead_id", lead.id)
        .is("deleted_at", null)
        .order("created_at", { ascending: false }),
      supabase
        .from("activity_log")
        .select("*, actor:app_users(full_name)")
        .eq("lead_id", lead.id)
        .order("created_at", { ascending: false })
        .limit(50),
      supabase
        .from("documents")
        .select("*")
        .eq("lead_id", lead.id)
        .is("deleted_at", null)
        .order("created_at", { ascending: false }),
      supabase
        .from("brokers")
        .select("id, full_name")
        .eq("is_active", true)
        .is("deleted_at", null)
        .order("full_name"),
      supabase.from("affiliates").select("id, name").is("deleted_at", null).order("name"),
    ]);

  // View audit (app-layer, per the GDPR posture).
  void logLeadView(lead.id);

  const perms: PipelinePerms = {
    canCreate: can(matrix, user.role, "leads", "create"),
    canUpdate: can(matrix, user.role, "leads", "update"),
    canDelete: can(matrix, user.role, "leads", "delete"),
    canManageEntities: can(matrix, user.role, "generators", "create"),
    canComment: can(matrix, user.role, "comments", "create"),
    updateScope: scopeOf(matrix, user.role, "leads", "update"),
    currentUserId: user.id,
  };
  const canComment = perms.canComment;
  const canViewAudit = can(matrix, user.role, "audit", "read");

  return (
    <LeadDetail
      lead={lead as never}
      history={(history ?? []) as never}
      comments={(comments ?? []) as never}
      activity={(activity ?? []) as never}
      documents={(documents ?? []) as never}
      brokers={(brokers ?? []).map((b) => ({
        id: b.id,
        label: b.full_name ?? "",
      }))}
      sources={(sources ?? []).map((a) => ({ id: a.id, label: a.name }))}
      perms={perms}
      canComment={canComment}
      canViewAudit={canViewAudit}
    />
  );
}
