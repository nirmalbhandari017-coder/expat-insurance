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
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
} from "@/components/ui/dropdown-menu";
import {
  StageBadge,
  StageDot,
  QualificationBadge,
  OpportunityBadge,
} from "@/components/leads/status-badge";
import { StageMenu } from "@/components/pipeline/status-menu";
import { usePipelineActions } from "@/components/pipeline/use-pipeline-actions";
import { createClient } from "@/lib/supabase/client";
import { addComment } from "@/lib/actions/interactions";
import { assignBroker, updateLead } from "@/lib/actions/leads";
import {
  PIPELINE_STAGES,
  STAGE_LABEL,
  stageRank,
  ageFromDob,
  type PipelineStage,
  type QualificationStatus,
  type OpportunityStatus,
  type LeadState,
} from "@/lib/domain/pipeline";
import { shortDate, relativeAge } from "@/lib/format";
import type { Option, PipelinePerms } from "@/lib/types";
import { cn } from "@/lib/utils";

interface DetailLead {
  id: string;
  lead_code: string;
  customer_name: string;
  title: string | null;
  first_name: string;
  last_name: string;
  email: string | null;
  phone: string | null;
  whatsapp_phone: string | null;
  date_of_birth: string | null;
  nationality: string | null;
  country_of_residence: string | null;
  lead_state: LeadState;
  qualification: QualificationStatus;
  stage: PipelineStage | null;
  opportunity: OpportunityStatus;
  stage_at_loss: PipelineStage | null;
  lost_notes: string | null;
  lost_at: string | null;
  broker_id: string | null;
  quote_date: string | null;
  application_date: string | null;
  payment_date: string | null;
  policy_number: string | null;
  notes: string | null;
  source_channel: string;
  created_at: string;
  updated_at: string;
  affiliate: { id: string; name: string } | null;
  generator: { id: string; full_name: string } | null;
  broker: { id: string; full_name: string; company: string | null } | null;
  lost_reason: { label: string } | null;
  products: { product: { id: string; name: string } | null }[];
}
interface StageHistoryRow {
  id: string;
  from_stage: PipelineStage | null;
  to_stage: PipelineStage | null;
  kind: string;
  reason: string | null;
  changed_at: string;
  changed_by_user: { full_name: string } | null;
}
interface CommentRow {
  id: string;
  body: string;
  created_at: string;
  author: { full_name: string } | null;
}
interface ActivityRow {
  id: string;
  kind: string;
  summary: string;
  old_value: string | null;
  new_value: string | null;
  created_at: string;
  actor: { full_name: string } | null;
}
interface DocRow {
  id: string;
  filename: string;
  storage_path: string;
  mime_type: string | null;
  size_bytes: number | null;
  created_at: string;
}

export function LeadDetail({
  lead,
  history,
  comments,
  activity,
  documents,
  brokers,
  perms,
  canComment,
}: {
  lead: DetailLead;
  history: StageHistoryRow[];
  comments: CommentRow[];
  activity: ActivityRow[];
  documents: DocRow[];
  brokers: Option[];
  perms: PipelinePerms;
  canComment: boolean;
  canViewAudit: boolean;
}) {
  const router = useRouter();
  const { request, requestQualification, requestLost, requestReopen, dialogs } =
    usePipelineActions();
  const canEdit =
    perms.canUpdate && (perms.updateScope === "all" || lead.broker_id === perms.currentUserId);

  const age = ageFromDob(lead.date_of_birth);
  const products = lead.products?.map((p) => p.product?.name).filter(Boolean) ?? [];

  return (
    <div className="mx-auto max-w-5xl space-y-5">
      <Link
        href="/pipeline"
        className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
      >
        <ArrowLeft className="h-4 w-4" /> Pipeline
      </Link>

      {/* Header — everything you need to place this lead at a glance */}
      <div className="flex flex-wrap items-start justify-between gap-3 border-b pb-4">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-2xl font-semibold tracking-tight">
              {lead.title ? `${lead.title} ` : ""}
              {lead.customer_name}
            </h1>
            <span className="tabular text-sm text-muted-foreground">{lead.lead_code}</span>
          </div>
          <div className="mt-1 text-sm text-muted-foreground">
            {age !== null && <>{age} years old · </>}
            {lead.country_of_residence ?? "—"}
            {products.length > 0 && <> · {products.join(" + ")}</>}
          </div>
          <div className="mt-2 flex flex-wrap items-center gap-1.5">
            <QualificationBadge qualification={lead.qualification} />
            {lead.stage && <StageBadge stage={lead.stage} />}
            <OpportunityBadge opportunity={lead.opportunity} />
          </div>
        </div>
        <div className="flex items-center gap-2">
          {canEdit ? (
            <StageMenu
              current={lead.stage}
              qualification={lead.qualification}
              opportunity={lead.opportunity}
              onSelect={(to) => request(lead, to)}
              onQualify={(q) => requestQualification(lead.id, q)}
              onMarkLost={() => requestLost([lead.id])}
              onReopen={() => requestReopen(lead.id, lead.stage_at_loss)}
            >
              <Button variant="outline" size="sm">
                Change status <ChevronDown className="h-4 w-4" />
              </Button>
            </StageMenu>
          ) : null}
          {canEdit && (
            <AssignBrokerButton
              leadId={lead.id}
              brokers={brokers}
              current={lead.broker?.full_name}
            />
          )}
          {canEdit && <EditLeadButton lead={lead} />}
        </div>
      </div>

      {lead.opportunity === "lost" && (
        <div className="rounded-md border border-red-500/30 bg-red-500/5 px-3 py-2 text-sm">
          <span className="font-medium">Lost</span>
          {lead.stage_at_loss && <> at {STAGE_LABEL[lead.stage_at_loss]}</>}
          {lead.lost_reason?.label && <> — {lead.lost_reason.label}</>}
          {lead.lost_notes ? <span className="text-muted-foreground"> · {lead.lost_notes}</span> : null}
          {lead.lost_at && (
            <span className="text-muted-foreground"> · {shortDate(lead.lost_at)}</span>
          )}
        </div>
      )}

      {/* Pipeline progress */}
      {lead.qualification === "qualified" && (
        <PipelineProgress
          current={lead.stage}
          lostAt={lead.opportunity === "lost" ? lead.stage_at_loss : null}
        />
      )}

      {lead.qualification === "pending" && canEdit && (
        <div className="flex flex-wrap items-center gap-2 rounded-md border bg-muted/30 px-3 py-2 text-sm">
          <span className="text-muted-foreground">
            This lead hasn&apos;t been qualified yet.
          </span>
          <Button size="sm" onClick={() => requestQualification(lead.id, "qualified")}>
            Mark Qualified
          </Button>
          <Button
            size="sm"
            variant="outline"
            onClick={() => requestQualification(lead.id, "not_qualified")}
          >
            Not Qualified
          </Button>
        </div>
      )}

      <div className="grid gap-5 md:grid-cols-3">
        <div className="space-y-4">
          {/* Attribution: source -> generator -> broker, the core question */}
          <Section title="Attribution">
            <Fact label="Source" value={lead.affiliate?.name ?? null} />
            <Fact label="Agent" value={lead.generator?.full_name ?? null} />
            <Fact
              label="CRM"
              value={
                lead.broker
                  ? lead.broker.company
                    ? `${lead.broker.full_name} (${lead.broker.company})`
                    : lead.broker.full_name
                  : null
              }
            />
            <Fact label="Channel" value={lead.source_channel} />
          </Section>

          <Section title="Contact">
            <ContactFact label="Email" value={lead.email} href={lead.email ? `mailto:${lead.email}` : null} />
            <ContactFact label="Phone" value={lead.phone} href={lead.phone ? `tel:${lead.phone}` : null} />
            <ContactFact
              label="WhatsApp"
              value={lead.whatsapp_phone}
              href={
                lead.whatsapp_phone
                  ? `https://wa.me/${lead.whatsapp_phone.replace(/[^0-9]/g, "")}`
                  : null
              }
            />
          </Section>

          <Section title="Details">
            <Fact label="Date of birth" value={shortDate(lead.date_of_birth)} />
            <Fact label="Age" value={age !== null ? String(age) : null} />
            <Fact label="Nationality" value={lead.nationality} />
            <Fact label="Location" value={lead.country_of_residence} />
            <Fact label="Products" value={products.join(", ") || null} />
            <Fact label="Policy #" value={lead.policy_number} />
          </Section>

          <Section title="Milestones">
            <Fact label="Created" value={shortDate(lead.created_at)} />
            <Fact label="Quote" value={shortDate(lead.quote_date)} />
            <Fact label="Application" value={shortDate(lead.application_date)} />
            <Fact label="Payment" value={shortDate(lead.payment_date)} />
          </Section>
        </div>

        <div className="space-y-5 md:col-span-2">
          {lead.notes && (
            <Section title="Summary note">
              <p className="whitespace-pre-wrap text-sm">{lead.notes}</p>
            </Section>
          )}

          <Comments leadId={lead.id} comments={comments} canComment={canComment} />

          <Documents
            leadId={lead.id}
            documents={documents}
            canEdit={canEdit}
            onChange={() => router.refresh()}
          />

          {history.length > 0 && (
            <Section title="Stage history">
              <ol className="space-y-3">
                {history.map((h) => (
                  <li key={h.id} className="flex gap-3 text-sm">
                    {h.to_stage ? (
                      <StageDot stage={h.to_stage} className="mt-1.5" />
                    ) : (
                      <span className="mt-1.5 inline-block h-2.5 w-2.5 shrink-0 rounded-full bg-muted-foreground/40" />
                    )}
                    <div>
                      <div>
                        {h.from_stage ? `${STAGE_LABEL[h.from_stage]} → ` : "Entered pipeline at "}
                        <span className="font-medium">
                          {h.to_stage ? STAGE_LABEL[h.to_stage] : "removed"}
                        </span>
                        {h.kind !== "progress" && (
                          <span className="ml-1.5 text-[10px] uppercase tracking-wide text-muted-foreground">
                            {h.kind}
                          </span>
                        )}
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
          )}

          {activity.length > 0 && (
            <Section title="Activity history">
              <ol className="space-y-2">
                {activity.map((a) => (
                  <li key={a.id} className="text-xs">
                    <div className="flex items-baseline justify-between gap-3">
                      <span className="text-foreground">{a.summary}</span>
                      <span className="shrink-0 text-muted-foreground">
                        {relativeAge(a.created_at)} ago · {a.actor?.full_name ?? "system"}
                      </span>
                    </div>
                    {(a.old_value || a.new_value) && a.kind !== "stage_changed" && (
                      <div className="text-muted-foreground">
                        {a.old_value ?? "—"} → {a.new_value ?? "—"}
                      </div>
                    )}
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

/** Visual pipeline bar. A lost deal shows where it died rather than hiding it. */
function PipelineProgress({
  current,
  lostAt,
}: {
  current: PipelineStage | null;
  lostAt: PipelineStage | null;
}) {
  const markerStage = lostAt ?? current;
  const rank = markerStage ? stageRank(markerStage) : 0;

  return (
    <div className="flex flex-wrap items-center gap-1">
      {PIPELINE_STAGES.map((s) => {
        const r = stageRank(s);
        const reached = r <= rank;
        const isCurrent = s === markerStage;
        return (
          <div
            key={s}
            className={cn(
              "flex-1 rounded-md border px-2 py-1.5 text-center text-xs transition-colors",
              reached ? "bg-muted/60" : "text-muted-foreground",
              isCurrent && !lostAt && "border-primary bg-primary/10 font-medium text-foreground",
              isCurrent && lostAt && "border-red-500/50 bg-red-500/10 font-medium text-foreground",
            )}
            title={isCurrent && lostAt ? "Lost at this stage" : undefined}
          >
            {STAGE_LABEL[s]}
          </div>
        );
      })}
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
function ContactFact({
  label,
  value,
  href,
}: {
  label: string;
  value: string | null;
  href: string | null;
}) {
  return (
    <div className="flex justify-between gap-4 py-1 text-sm">
      <span className="text-muted-foreground">{label}</span>
      {href && value ? (
        <a
          href={href}
          target={href.startsWith("http") ? "_blank" : undefined}
          rel="noreferrer"
          className="text-right underline-offset-2 hover:underline"
        >
          {value}
        </a>
      ) : (
        <span className="text-right">—</span>
      )}
    </div>
  );
}

function AssignBrokerButton({
  leadId,
  brokers,
  current,
}: {
  leadId: string;
  brokers: Option[];
  current?: string;
}) {
  const router = useRouter();
  const [pending, start] = useTransition();
  function assign(brokerId: string | null) {
    start(async () => {
      const res = await assignBroker({ ids: [leadId], brokerId });
      if (res.ok) {
        toast.success("CRM updated");
        router.refresh();
      } else toast.error(res.error);
    });
  }
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="outline" size="sm" disabled={pending}>
          <UserCog className="h-4 w-4" /> {current ?? "Assign CRM"}
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        <DropdownMenuItem onSelect={() => assign(null)}>Unassign</DropdownMenuItem>
        <DropdownMenuSeparator />
        {brokers.map((b) => (
          <DropdownMenuItem key={b.id} onSelect={() => assign(b.id)}>
            {b.label}
          </DropdownMenuItem>
        ))}
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
        title: String(fd.get("title") ?? ""),
        firstName: String(fd.get("firstName") ?? ""),
        lastName: String(fd.get("lastName") ?? ""),
        dateOfBirth: String(fd.get("dateOfBirth") ?? ""),
        email: String(fd.get("email") ?? ""),
        phone: String(fd.get("phone") ?? ""),
        whatsappPhone: String(fd.get("whatsappPhone") ?? ""),
        nationality: String(fd.get("nationality") ?? ""),
        countryOfResidence: String(fd.get("countryOfResidence") ?? ""),
        policyNumber: String(fd.get("policyNumber") ?? ""),
        notes: String(fd.get("notes") ?? ""),
      });
      if (res.ok) {
        toast.success("Lead updated");
        setOpen(false);
        router.refresh();
      } else toast.error(res.error);
    });
  }
  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <Button variant="outline" size="sm" onClick={() => setOpen(true)}>
        <Pencil className="h-4 w-4" /> Edit
      </Button>
      <DialogContent className="max-h-[85vh] max-w-lg overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Edit lead</DialogTitle>
        </DialogHeader>
        <form onSubmit={onSubmit} className="space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <Field name="title" label="Title" defaultValue={lead.title} />
            <Field name="firstName" label="First name" defaultValue={lead.first_name} />
            <Field name="lastName" label="Last name" defaultValue={lead.last_name} />
            <Field
              name="dateOfBirth"
              label="Date of birth"
              defaultValue={lead.date_of_birth}
              type="date"
            />
            <Field name="email" label="Email" defaultValue={lead.email} />
            <Field name="phone" label="Phone" defaultValue={lead.phone} />
            <Field name="whatsappPhone" label="WhatsApp" defaultValue={lead.whatsapp_phone} />
            <Field
              name="nationality"
              label="Nationality"
              defaultValue={lead.nationality}
              maxLength={2}
            />
            <Field
              name="countryOfResidence"
              label="Location"
              defaultValue={lead.country_of_residence}
              maxLength={2}
            />
            <Field name="policyNumber" label="Policy #" defaultValue={lead.policy_number} />
          </div>
          <div className="space-y-1.5">
            <Label>Summary note</Label>
            <Textarea name="notes" defaultValue={lead.notes ?? ""} />
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setOpen(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={pending}>
              {pending ? "Saving…" : "Save"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
function Field({
  name,
  label,
  defaultValue,
  maxLength,
  type,
}: {
  name: string;
  label: string;
  defaultValue: string | null;
  maxLength?: number;
  type?: string;
}) {
  return (
    <div className="space-y-1.5">
      <Label>{label}</Label>
      <Input name={name} defaultValue={defaultValue ?? ""} maxLength={maxLength} type={type} />
    </div>
  );
}

function Comments({
  leadId,
  comments,
  canComment,
}: {
  leadId: string;
  comments: CommentRow[];
  canComment: boolean;
}) {
  const router = useRouter();
  const [body, setBody] = useState("");
  const [pending, start] = useTransition();
  function submit() {
    if (!body.trim()) return;
    start(async () => {
      const res = await addComment({ leadId, body: body.trim() });
      if (res.ok) {
        setBody("");
        router.refresh();
      } else toast.error(res.error);
    });
  }
  return (
    <Section title={`Notes (${comments.length})`}>
      <div className="space-y-3">
        {canComment && (
          <div className="space-y-2">
            <Textarea
              value={body}
              onChange={(e) => setBody(e.target.value)}
              placeholder="Add a note…"
            />
            <Button size="sm" onClick={submit} disabled={pending || !body.trim()}>
              {pending ? "Posting…" : "Add note"}
            </Button>
          </div>
        )}
        {comments.map((c) => (
          <div key={c.id} className="border-t pt-3 text-sm first:border-t-0 first:pt-0">
            <div className="flex items-center gap-2">
              <span className="font-medium">{c.author?.full_name ?? "Unknown"}</span>
              <span className="text-xs text-muted-foreground">{shortDate(c.created_at)}</span>
            </div>
            <p className="whitespace-pre-wrap text-muted-foreground">{c.body}</p>
          </div>
        ))}
        {comments.length === 0 && <p className="text-sm text-muted-foreground">No notes yet.</p>}
      </div>
    </Section>
  );
}

function Documents({
  leadId,
  documents,
  canEdit,
  onChange,
}: {
  leadId: string;
  documents: DocRow[];
  canEdit: boolean;
  onChange: () => void;
}) {
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
        lead_id: leadId,
        uploaded_by: me as string,
        filename: file.name,
        storage_path: path,
        mime_type: file.type,
        size_bytes: file.size,
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
    const { data } = await supabase.storage
      .from("lead-documents")
      .createSignedUrl(doc.storage_path, 60);
    if (data?.signedUrl) window.open(data.signedUrl, "_blank");
  }

  return (
    <Section title={`Documents (${documents.length})`}>
      <div className="space-y-2">
        {documents.map((d) => (
          <button
            key={d.id}
            onClick={() => download(d)}
            className="flex w-full items-center gap-2 rounded-md border px-3 py-2 text-left text-sm hover:bg-muted/40"
          >
            <Paperclip className="h-4 w-4 text-muted-foreground" />
            <span className="flex-1 truncate">{d.filename}</span>
            <span className="text-xs text-muted-foreground">
              {d.size_bytes ? `${Math.round(d.size_bytes / 1024)} KB` : ""}
            </span>
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
