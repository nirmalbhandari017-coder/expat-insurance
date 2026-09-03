"use client";

import Link from "next/link";
import { useDraggable } from "@dnd-kit/core";
import { GripVertical, MoreHorizontal } from "lucide-react";
import { StageMenu } from "./status-menu";
import { NoteEditor } from "./note-editor";
import { Button } from "@/components/ui/button";
import { relativeAge } from "@/lib/format";
import { ageFromDob, type PipelineStage, type QualificationStatus } from "@/lib/domain/pipeline";
import type { LeadRow, PipelinePerms } from "@/lib/types";
import { cn } from "@/lib/utils";

export function LeadCard({
  lead,
  perms,
  onChangeStage,
  onQualify,
  onMarkLost,
  onReopen,
  dragging,
}: {
  lead: LeadRow;
  perms: PipelinePerms;
  onChangeStage: (to: PipelineStage) => void;
  onQualify?: (q: QualificationStatus) => void;
  onMarkLost?: () => void;
  onReopen?: () => void;
  dragging?: boolean;
}) {
  const canDrag =
    perms.canUpdate &&
    (perms.updateScope === "all" || lead.broker_id === perms.currentUserId) &&
    lead.opportunity === "active";
  const { attributes, listeners, setNodeRef, isDragging } = useDraggable({
    id: lead.id,
    disabled: !canDrag,
  });

  const age = ageFromDob(lead.date_of_birth);
  const products = lead.products?.map((p) => p.product?.name).filter(Boolean) ?? [];

  return (
    <div
      ref={setNodeRef}
      className={cn(
        "group rounded-md border bg-card p-2.5 shadow-sm transition-colors hover:border-foreground/20",
        (isDragging || dragging) && "opacity-50",
        lead.opportunity === "lost" && "border-red-500/30 bg-red-500/[0.03]",
      )}
    >
      <div className="flex items-start gap-1.5">
        {canDrag && (
          <button
            {...attributes}
            {...listeners}
            className="mt-0.5 cursor-grab text-muted-foreground/40 hover:text-muted-foreground active:cursor-grabbing"
            aria-label="Drag to move"
          >
            <GripVertical className="h-3.5 w-3.5" />
          </button>
        )}
        <div className="min-w-0 flex-1">
          <Link
            href={`/leads/${lead.lead_code}`}
            className="block truncate text-sm font-medium hover:underline"
          >
            {lead.customer_name}
          </Link>
          <div className="mt-0.5 truncate text-xs text-muted-foreground">
            {lead.affiliate?.name ?? "—"}
            {lead.generator?.full_name && ` · ${lead.generator.full_name}`}
          </div>
        </div>
        {perms.canUpdate && (
          <StageMenu
            current={lead.stage}
            qualification={lead.qualification}
            opportunity={lead.opportunity}
            onSelect={onChangeStage}
            onQualify={onQualify}
            onMarkLost={onMarkLost}
            onReopen={onReopen}
          >
            <Button variant="ghost" size="icon-sm" className="opacity-0 group-hover:opacity-100">
              <MoreHorizontal className="h-4 w-4" />
            </Button>
          </StageMenu>
        )}
      </div>

      {(products.length > 0 || age !== null || lead.country_of_residence) && (
        <div className="mt-1.5 flex flex-wrap items-center gap-1 text-[11px] text-muted-foreground">
          {products.map((p) => (
            <span key={p} className="rounded border px-1 py-px">
              {p}
            </span>
          ))}
          {age !== null && <span>{age}y</span>}
          {lead.country_of_residence && <span>{lead.country_of_residence}</span>}
        </div>
      )}

      {perms.canComment ? (
        <div className="mt-1.5 rounded border-l-2 border-muted-foreground/25 bg-muted/40 py-0.5 pl-1 pr-0.5">
          <NoteEditor
            leadId={lead.id}
            note={lead.last_note}
            noteAt={lead.last_note_at}
            variant="card"
          />
        </div>
      ) : (
        lead.last_note && (
          <p
            title={lead.last_note}
            className="mt-1.5 line-clamp-2 rounded border-l-2 border-muted-foreground/25 bg-muted/40 py-1 pl-1.5 pr-1 text-[11px] leading-snug text-muted-foreground"
          >
            {lead.last_note}
          </p>
        )
      )}

      <div className="mt-2 flex items-center justify-between text-[11px] text-muted-foreground">
        <span className="tabular">{lead.lead_code}</span>
        <div className="flex items-center gap-2">
          {lead.broker && (
            <span
              title={lead.broker.full_name}
              className="inline-flex h-4 w-4 items-center justify-center rounded-full bg-secondary text-[9px] font-medium text-secondary-foreground"
            >
              {initials(lead.broker.full_name)}
            </span>
          )}
          <span title="Time in stage">{relativeAge(lead.stage_entered_at)}</span>
        </div>
      </div>
    </div>
  );
}

function initials(name: string) {
  return name
    .split(" ")
    .map((p) => p[0])
    .slice(0, 2)
    .join("")
    .toUpperCase();
}
