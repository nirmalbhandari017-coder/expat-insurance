"use client";

import { useMemo, useState } from "react";
import { DndContext, DragOverlay, PointerSensor, useSensor, useSensors, useDroppable, type DragStartEvent, type DragEndEvent } from "@dnd-kit/core";
import { LeadCard } from "./lead-card";
import { StatusDot } from "@/components/leads/status-badge";
import { PIPELINE_STATUSES, STATUS_LABEL, isTransitionAllowed, type LeadStatus } from "@/lib/domain/pipeline";
import type { LeadRow, PipelinePerms } from "@/lib/types";
import { cn } from "@/lib/utils";

const COLUMN_CAP = 50; // windowed per column; a count badge shows the full total

export function KanbanBoard({
  leads,
  perms,
  onChangeStatus,
}: {
  leads: LeadRow[];
  perms: PipelinePerms;
  onChangeStatus: (lead: LeadRow, to: LeadStatus) => void;
}) {
  const [activeId, setActiveId] = useState<string | null>(null);
  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 4 } }));

  const byStatus = useMemo(() => {
    const map = new Map<LeadStatus, LeadRow[]>();
    for (const s of PIPELINE_STATUSES) map.set(s, []);
    for (const l of leads) map.get(l.current_status)?.push(l);
    return map;
  }, [leads]);

  const activeLead = activeId ? leads.find((l) => l.id === activeId) ?? null : null;

  function onDragStart(e: DragStartEvent) {
    setActiveId(String(e.active.id));
  }
  function onDragEnd(e: DragEndEvent) {
    setActiveId(null);
    const lead = leads.find((l) => l.id === String(e.active.id));
    const to = e.over?.id as LeadStatus | undefined;
    if (!lead || !to || lead.current_status === to) return;
    if (!isTransitionAllowed(lead.current_status, to)) return;
    onChangeStatus(lead, to);
  }

  return (
    <DndContext sensors={sensors} onDragStart={onDragStart} onDragEnd={onDragEnd}>
      <div className="flex gap-3 overflow-x-auto pb-4">
        {PIPELINE_STATUSES.map((status) => (
          <Column
            key={status}
            status={status}
            leads={byStatus.get(status) ?? []}
            perms={perms}
            onChangeStatus={onChangeStatus}
            activeLead={activeLead}
          />
        ))}
      </div>
      <DragOverlay>
        {activeLead ? (
          <div className="w-64">
            <LeadCard lead={activeLead} perms={perms} onChangeStatus={() => {}} dragging />
          </div>
        ) : null}
      </DragOverlay>
    </DndContext>
  );
}

function Column({
  status,
  leads,
  perms,
  onChangeStatus,
  activeLead,
}: {
  status: LeadStatus;
  leads: LeadRow[];
  perms: PipelinePerms;
  onChangeStatus: (lead: LeadRow, to: LeadStatus) => void;
  activeLead: LeadRow | null;
}) {
  const { setNodeRef, isOver } = useDroppable({ id: status });
  const canDrop = activeLead ? isTransitionAllowed(activeLead.current_status, status) : false;
  const shown = leads.slice(0, COLUMN_CAP);

  return (
    <div className="flex w-64 shrink-0 flex-col">
      <div className="mb-2 flex items-center justify-between px-1">
        <div className="flex items-center gap-2 text-sm font-medium">
          <StatusDot status={status} />
          {STATUS_LABEL[status]}
        </div>
        <span className="tabular rounded bg-muted px-1.5 text-xs text-muted-foreground">{leads.length}</span>
      </div>
      <div
        ref={setNodeRef}
        className={cn(
          "flex min-h-[120px] flex-1 flex-col gap-2 rounded-lg border border-transparent p-1 transition-colors",
          isOver && canDrop && "border-primary/40 bg-primary/5",
          isOver && !canDrop && activeLead && "border-destructive/30 bg-destructive/5",
        )}
      >
        {shown.map((lead) => (
          <LeadCard key={lead.id} lead={lead} perms={perms} onChangeStatus={(to) => onChangeStatus(lead, to)} />
        ))}
        {leads.length > COLUMN_CAP && (
          <div className="px-1 py-2 text-center text-xs text-muted-foreground">
            +{leads.length - COLUMN_CAP} more — narrow with filters
          </div>
        )}
      </div>
    </div>
  );
}
