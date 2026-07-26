"use client";

import Link from "next/link";
import { useDraggable } from "@dnd-kit/core";
import { GripVertical, MoreHorizontal } from "lucide-react";
import { StatusMenu } from "./status-menu";
import { Button } from "@/components/ui/button";
import { relativeAge } from "@/lib/format";
import type { LeadRow, PipelinePerms } from "@/lib/types";
import type { LeadStatus } from "@/lib/domain/pipeline";
import { cn } from "@/lib/utils";

export function LeadCard({
  lead,
  perms,
  onChangeStatus,
  dragging,
}: {
  lead: LeadRow;
  perms: PipelinePerms;
  onChangeStatus: (to: LeadStatus) => void;
  dragging?: boolean;
}) {
  const canDrag = perms.canUpdate && (perms.updateScope === "all" || lead.assigned_rm_id === perms.currentUserId);
  const { attributes, listeners, setNodeRef, isDragging } = useDraggable({ id: lead.id, disabled: !canDrag });

  return (
    <div
      ref={setNodeRef}
      className={cn(
        "group rounded-md border bg-card p-2.5 shadow-sm transition-colors hover:border-foreground/20",
        (isDragging || dragging) && "opacity-50",
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
          <Link href={`/leads/${lead.lead_code}`} className="block truncate text-sm font-medium hover:underline">
            {lead.customer_name}
          </Link>
          <div className="mt-0.5 truncate text-xs text-muted-foreground">{lead.affiliate?.name ?? "—"}</div>
        </div>
        {canDrag && (
          <StatusMenu current={lead.current_status} perms={perms} onSelect={onChangeStatus}>
            <Button variant="ghost" size="icon-sm" className="opacity-0 group-hover:opacity-100">
              <MoreHorizontal className="h-4 w-4" />
            </Button>
          </StatusMenu>
        )}
      </div>
      <div className="mt-2 flex items-center justify-between text-[11px] text-muted-foreground">
        <span className="tabular">{lead.lead_code}</span>
        <div className="flex items-center gap-2">
          {lead.rm && (
            <span className="inline-flex h-4 w-4 items-center justify-center rounded-full bg-secondary text-[9px] font-medium text-secondary-foreground">
              {initials(lead.rm.full_name)}
            </span>
          )}
          <span title="Time in stage">{relativeAge(lead.stage_entered_at)}</span>
        </div>
      </div>
    </div>
  );
}

function initials(name: string) {
  return name.split(" ").map((p) => p[0]).slice(0, 2).join("").toUpperCase();
}
