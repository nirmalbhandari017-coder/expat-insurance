"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { ArrowLeft, ChevronDown, Paperclip, Upload, UserCog, Pencil } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { DropdownMenu, DropdownMenuTrigger, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator } from "@/components/ui/dropdown-menu";
import { StatusBadge, StatusDot } from "@/components/leads/status-badge";
import { StatusMenu } from "@/components/pipeline/status-menu";
import { usePipelineActions } from "@/components/pipeline/use-pipeline-actions";
import { createClient } from "@/lib/supabase/client";
import { addComment } from "@/lib/actions/interactions";
import { assignRm, updateLead } from "@/lib/actions/leads";
import { STATUS_LABEL, LOST_REASON_LABEL, type LeadStatus, type LostReason } from "@/lib/domain/pipeline";
import { shortDate, relativeAge } from "@/lib/format";
import type { Option, PipelinePerms } from "@/lib/types";

interface DetailLead {
  id: string; lead_code: string; customer_name: string; email: string | null; phone: string | null;
  nationality: string | null; country_of_residence: string | null; current_status: LeadStatus;
  assigned_rm_id: string | null; quote_date: string | null; application_date: string | null;
  payment_date: string | null; policy_number: string | null; notes: string | null; source_channel: string;
  lost_reason: LostReason | null; lost_reason_detail: string | null; created_at: string; updated_at: string;
  affiliate: { id: string; name: string } | null; rm: { id: string; full_name: string } | null; itype: { name: string } | null;
}
interface HistoryRow { id: string; from_status: LeadStatus | null; to_status: LeadStatus; kind: string; reason: string | null; changed_at: string; changed_by_user: { full_name: string } | null }
interface CommentRow { id: string; body: string; created_at: string; author: { full_name: string } | null }
interface ActivityRow { id: string; kind: string; summary: string; created_at: string; actor: { full_name: string } | null }
interface DocRow { id: string; filename: string; storage_path: string; mime_type: string | null; size_bytes: number | null; created_at: string }

export function LeadDetail({
  lead, history, comments, activity, documents, rms, perms, canComment,
}: {
  lead: DetailLead; history: HistoryRow[]; comments: CommentRow[]; activity: ActivityRow[];
  documents: DocRow[]; rms: Option[]; perms: PipelinePerms; canComment: boolean; canViewAudit: boolean;
}) {
  const router = useRouter();
  const { request, dialogs } = usePipelineActions();
  const canEdit = perms.canUpdate && (perms.updateScope === "all" || lead.assigned_rm_id === perms.currentUserId);

  return (
    <div className="mx-auto max-w-5xl space-y-5">
      <Link href="/pipeline" className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground">
        <ArrowLeft className="h-4 w-4" /> Pipeline
      </Link>

      {/* Header */}
      <div className="flex flex-wrap items-start justify-between gap-3 border-b pb-4">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-2xl font-semibold tracking-tight">{lead.customer_name}</h1>
            <span className="tabular text-sm text-muted-foreground">{lead.lead_code}</span>
          </div>
          <div className="mt-1 text-sm text-muted-foreground">
            {lead.affiliate?.name ?? "—"} · {lead.itype?.name ?? "No type"} · via {lead.source_channel}
          </div>
        </div>
        <div className="flex items-center gap-2">
          {canEdit ? (
            <StatusMenu current={lead.current_status} perms={perms} onSelect={(to) => request(lead, to)}>
              <button className="inline-flex items-center gap-1.5 rounded-md hover:opacity-80">
                <StatusBadge status={lead.current_status} className="px-2 py-1 text-sm" />
                <ChevronDown className="h-4 w-4 text-muted-foreground" />
              </button>
            </StatusMenu>
          ) : (
            <StatusBadge status={lead.current_status} className="px-2 py-1 text-sm" />
          )}
          {canEdit && <AssignRmButton leadId={lead.id} rms={rms} current={lead.rm?.full_name} />}
          {canEdit && <EditLeadButton lead={lead} />}
        </div>
      </div>

      {lead.current_status === "lost" && lead.lost_reason && (
        <div className="rounded-md border border-status-lost/30 bg-status-lost/5 px-3 py-2 text-sm">
          <span className="font-medium">Lost reason:</span> {LOST_REASON_LABEL[lead.lost_reason]}
          {lead.lost_reason_detail ? ` — ${lead.lost_reason_detail}` : ""}
        </div>
      )}

      <div className="grid gap-5 md:grid-cols-3">
        {/* Left: details + dates */}
        <div className="space-y-4">
          <Section title="Details">
            <Fact label="Email" value={lead.email} />
            <Fact label="Phone" value={lead.phone} />
            <Fact label="Nationality" value={lead.nationality} />
            <Fact label="Residence" value={lead.country_of_residence} />
            <Fact label="Policy #" value={lead.policy_number} />
            <Fact label="RM" value={lead.rm?.full_name ?? null} />
          </Section>
          <Section title="Milestones">
            <Fact label="Created" value={shortDate(lead.created_at)} />
            <Fact label="Quote" value={shortDate(lead.quote_date)} />
            <Fact label="Application" value={shortDate(lead.application_date)} />
            <Fact label="Payment" value={shortDate(lead.payment_date)} />
          </Section>
        </div>

        {/* Middle+right: timeline, comments, docs */}
        <div className="space-y-5 md:col-span-2">
          {lead.notes && (
            <Section title="Notes"><p className="whitespace-pre-wrap text-sm">{lead.notes}</p></Section>
          )}

          <Comments leadId={lead.id} comments={comments} canComment={canComment} />

          <Documents leadId={lead.id} documents={documents} canEdit={canEdit} onChange={() => router.refresh()} />

          <Section title="Status history">
            <ol className="space-y-3">
              {history.map((h) => (
                <li key={h.id} className="flex gap-3 text-sm">
                  <StatusDot status={h.to_status} className="mt-1.5" />
                  <div>
                    <div>
                      {h.from_status ? `${STATUS_LABEL[h.from_status]} → ` : "Created as "}
                      <span className="font-medium">{STATUS_LABEL[h.to_status]}</span>
                      {h.kind !== "progress" && <span className="ml-1.5 text-[10px] uppercase tracking-wide text-muted-foreground">{h.kind}</span>}
                    </div>
                    <div className="text-xs text-muted-foreground">
                      {shortDate(h.changed_at)} · {h.changed_by_user?.full_name ?? "system"}
                      {h.reason ? ` · ${h.reason}` : ""}
                    </div>
                  </div>
                </li>
              ))}
            </ol>
          </Section>

          {activity.length > 0 && (
            <Section title="Activity">
              <ol className="space-y-2">
                {activity.map((a) => (
                  <li key={a.id} className="flex items-center justify-between text-xs text-muted-foreground">
                    <span>{a.summary}</span>
                    <span>{relativeAge(a.created_at)} ago · {a.actor?.full_name ?? "system"}</span>
                  </li>
                ))}
              </ol>
            </Section>
          )}
        </div>
      </div>
      {dialogs}
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="rounded-lg border">
      <div className="border-b px-4 py-2.5 text-sm font-medium">{title}</div>
      <div className="p-4">{children}</div>
    </div>
  );
}
function Fact({ label, value }: { label: string; value: string | null }) {
  return (
    <div className="flex justify-between gap-4 py-1 text-sm">
      <span className="text-muted-foreground">{label}</span>
      <span className="text-right">{value || "—"}</span>
    </div>
  );
}

function AssignRmButton({ leadId, rms, current }: { leadId: string; rms: Option[]; current?: string }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  function assign(rmId: string | null) {
    start(async () => {
      const res = await assignRm({ ids: [leadId], rmId });
      if (res.ok) { toast.success("RM updated"); router.refresh(); } else toast.error(res.error);
    });
  }
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="outline" size="sm" disabled={pending}><UserCog className="h-4 w-4" /> {current ?? "Assign RM"}</Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        <DropdownMenuItem onSelect={() => assign(null)}>Unassign</DropdownMenuItem>
        <DropdownMenuSeparator />
        {rms.map((r) => <DropdownMenuItem key={r.id} onSelect={() => assign(r.id)}>{r.label}</DropdownMenuItem>)}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

function EditLeadButton({ lead }: { lead: DetailLead }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [pending, start] = useTransition();
  function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    start(async () => {
      const res = await updateLead({
        id: lead.id,
        email: String(fd.get("email") ?? ""),
        phone: String(fd.get("phone") ?? ""),
        nationality: String(fd.get("nationality") ?? ""),
        countryOfResidence: String(fd.get("countryOfResidence") ?? ""),
        policyNumber: String(fd.get("policyNumber") ?? ""),
        notes: String(fd.get("notes") ?? ""),
      });
      if (res.ok) { toast.success("Lead updated"); setOpen(false); router.refresh(); } else toast.error(res.error);
    });
  }
  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <Button variant="outline" size="sm" onClick={() => setOpen(true)}><Pencil className="h-4 w-4" /> Edit</Button>
      <DialogContent className="max-w-lg">
        <DialogHeader><DialogTitle>Edit lead</DialogTitle></DialogHeader>
        <form onSubmit={onSubmit} className="space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <Field name="email" label="Email" defaultValue={lead.email} />
            <Field name="phone" label="Phone" defaultValue={lead.phone} />
            <Field name="nationality" label="Nationality" defaultValue={lead.nationality} maxLength={2} />
            <Field name="countryOfResidence" label="Residence" defaultValue={lead.country_of_residence} maxLength={2} />
            <Field name="policyNumber" label="Policy #" defaultValue={lead.policy_number} />
          </div>
          <div className="space-y-1.5">
            <Label>Notes</Label>
            <Textarea name="notes" defaultValue={lead.notes ?? ""} />
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setOpen(false)}>Cancel</Button>
            <Button type="submit" disabled={pending}>{pending ? "Saving…" : "Save"}</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
function Field({ name, label, defaultValue, maxLength }: { name: string; label: string; defaultValue: string | null; maxLength?: number }) {
  return (
    <div className="space-y-1.5">
      <Label>{label}</Label>
      <Input name={name} defaultValue={defaultValue ?? ""} maxLength={maxLength} />
    </div>
  );
}

function Comments({ leadId, comments, canComment }: { leadId: string; comments: CommentRow[]; canComment: boolean }) {
  const router = useRouter();
  const [body, setBody] = useState("");
  const [pending, start] = useTransition();
  function submit() {
    if (!body.trim()) return;
    start(async () => {
      const res = await addComment({ leadId, body: body.trim() });
      if (res.ok) { setBody(""); router.refresh(); } else toast.error(res.error);
    });
  }
  return (
    <Section title={`Comments (${comments.length})`}>
      <div className="space-y-3">
        {comments.map((c) => (
          <div key={c.id} className="text-sm">
            <div className="flex items-center gap-2">
              <span className="font-medium">{c.author?.full_name ?? "Unknown"}</span>
              <span className="text-xs text-muted-foreground">{shortDate(c.created_at)}</span>
            </div>
            <p className="whitespace-pre-wrap text-muted-foreground">{c.body}</p>
          </div>
        ))}
        {comments.length === 0 && <p className="text-sm text-muted-foreground">No comments yet.</p>}
        {canComment && (
          <div className="space-y-2 pt-1">
            <Textarea value={body} onChange={(e) => setBody(e.target.value)} placeholder="Add an internal comment…" />
            <Button size="sm" onClick={submit} disabled={pending || !body.trim()}>{pending ? "Posting…" : "Comment"}</Button>
          </div>
        )}
      </div>
    </Section>
  );
}

function Documents({ leadId, documents, canEdit, onChange }: { leadId: string; documents: DocRow[]; canEdit: boolean; onChange: () => void }) {
  const [uploading, setUploading] = useState(false);

  async function onFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true);
    try {
      const supabase = createClient();
      const path = `leads/${leadId}/${crypto.randomUUID()}-${file.name}`;
      const { error: upErr } = await supabase.storage.from("lead-documents").upload(path, file);
      if (upErr) throw upErr;
      const { data: me } = await supabase.rpc("current_app_user_id");
      const { error: insErr } = await supabase.from("documents").insert({
        lead_id: leadId, uploaded_by: me as string, filename: file.name,
        storage_path: path, mime_type: file.type, size_bytes: file.size,
      });
      if (insErr) throw insErr;
      toast.success("Uploaded");
      onChange();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Upload failed");
    } finally {
      setUploading(false);
      e.target.value = "";
    }
  }

  async function download(doc: DocRow) {
    const supabase = createClient();
    const { data } = await supabase.storage.from("lead-documents").createSignedUrl(doc.storage_path, 60);
    if (data?.signedUrl) window.open(data.signedUrl, "_blank");
  }

  return (
    <Section title={`Documents (${documents.length})`}>
      <div className="space-y-2">
        {documents.map((d) => (
          <button key={d.id} onClick={() => download(d)} className="flex w-full items-center gap-2 rounded-md border px-3 py-2 text-left text-sm hover:bg-muted/40">
            <Paperclip className="h-4 w-4 text-muted-foreground" />
            <span className="flex-1 truncate">{d.filename}</span>
            <span className="text-xs text-muted-foreground">{d.size_bytes ? `${Math.round(d.size_bytes / 1024)} KB` : ""}</span>
          </button>
        ))}
        {documents.length === 0 && <p className="text-sm text-muted-foreground">No documents.</p>}
        {canEdit && (
          <label className="inline-flex cursor-pointer items-center gap-1.5 rounded-md border px-3 py-1.5 text-sm hover:bg-accent">
            <Upload className="h-4 w-4" /> {uploading ? "Uploading…" : "Upload"}
            <input type="file" className="hidden" onChange={onFile} disabled={uploading} />
          </label>
        )}
      </div>
    </Section>
  );
}
