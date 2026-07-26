"use client";

import { useMemo, useState } from "react";
import {
  DndContext,
  DragOverlay,
  PointerSensor,
  useSensor,
  useSensors,
  useDroppable,
  type DragStartEvent,
  type DragEndEvent,
} from "@dnd-kit/core";
import { LeadCard } from "./lead-card";
import { StageDot } from "@/components/leads/status-badge";
import {
  PIPELINE_STAGES,
  STAGE_LABEL,
  type PipelineStage,
  type QualificationStatus,
} from "@/lib/domain/pipeline";
import type { LeadRow, PipelinePerms } from "@/lib/types";
import { cn } from "@/lib/utils";

const COLUMN_CAP = 50; // windowed per column; a count badge shows the full total

/**
 * Columns are the six pipeline stages. Lost leads are excluded entirely
 * (spec §17) — they live behind the Lost filter, so the board only ever shows
 * live opportunities.
 */
export function KanbanBoard({
  leads,
  perms,
  onChangeStage,
  onQualify,
  onMarkLost,
  onReopen,
}: {
  leads: LeadRow[];
  perms: PipelinePerms;
  onChangeStage: (lead: LeadRow, to: PipelineStage) => void;
  onQualify?: (lead: LeadRow, q: QualificationStatus) => void;
  onMarkLost?: (lead: LeadRow) => void;
  onReopen?: (lead: LeadRow) => void;
}) {
  const [activeId, setActiveId] = useState<string | null>(null);
  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 4 } }));

  const live = useMemo(
    () => leads.filter((l) => l.opportunity === "active" && l.qualification === "qualified"),
    [leads],
  );

  const byStage = useMemo(() => {
    const map = new Map<PipelineStage, LeadRow[]>();
    for (const s of PIPELINE_STAGES) map.set(s, []);
    for (const l of live) if (l.stage) map.get(l.stage)?.push(l);
    return map;
  }, [live]);

  const activeLead = activeId ? (live.find((l) => l.id === activeId) ?? null) : null;

  function onDragStart(e: DragStartEvent) {
    setActiveId(String(e.active.id));
  }
  function onDragEnd(e: DragEndEvent) {
    setActiveId(null);
    const lead = live.find((l) => l.id === String(e.active.id));
    const to = e.over?.id as PipelineStage | undefined;
    if (!lead || !to || lead.stage === to) return;
    // Every stage is a valid drop target — moving backwards is allowed.
    onChangeStage(lead, to);
  }

  return (
    <DndContext sensors={sensors} onDragStart={onDragStart} onDragEnd={onDragEnd}>
      <div className="flex gap-3 overflow-x-auto pb-4">
        {PIPELINE_STAGES.map((stage) => (
          <Column
            key={stage}
            stage={stage}
            leads={byStage.get(stage) ?? []}
            perms={perms}
            onChangeStage={onChangeStage}
            onQualify={onQualify}
            onMarkLost={onMarkLost}
            onReopen={onReopen}
            isDragging={!!activeLead}
          />
        ))}
      </div>
      <DragOverlay>
        {activeLead ? (
          <div className="w-64">
            <LeadCard lead={activeLead} perms={perms} onChangeStage={() => {}} dragging />
          </div>
        ) : null}
      </DragOverlay>
    </DndContext>
  );
}

function Column({
  stage,
  leads,
  perms,
  onChangeStage,
  onQualify,
  onMarkLost,
  onReopen,
  isDragging,
}: {
  stage: PipelineStage;
  leads: LeadRow[];
  perms: PipelinePerms;
  onChangeStage: (lead: LeadRow, to: PipelineStage) => void;
  onQualify?: (lead: LeadRow, q: QualificationStatus) => void;
  onMarkLost?: (lead: LeadRow) => void;
  onReopen?: (lead: LeadRow) => void;
  isDragging: boolean;
}) {
  const { setNodeRef, isOver } = useDroppable({ id: stage });
  const shown = leads.slice(0, COLUMN_CAP);

  return (
    <div className="flex w-64 shrink-0 flex-col">
      <div className="mb-2 flex items-center justify-between px-1">
        <div className="flex items-center gap-2 text-sm font-medium">
          <StageDot stage={stage} />
          {STAGE_LABEL[stage]}
        </div>
        <span className="tabular rounded bg-muted px-1.5 text-xs text-muted-foreground">
          {leads.length}
        </span>
      </div>
      <div
        ref={setNodeRef}
        className={cn(
          "flex min-h-[120px] flex-1 flex-col gap-2 rounded-lg border border-transparent p-1 transition-colors",
          isOver && isDragging && "border-primary/40 bg-primary/5",
        )}
      >
        {shown.map((lead) => (
          <LeadCard
            key={lead.id}
            lead={lead}
            perms={perms}
            onChangeStage={(to) => onChangeStage(lead, to)}
            onQualify={onQualify ? (q) => onQualify(lead, q) : undefined}
            onMarkLost={onMarkLost ? () => onMarkLost(lead) : undefined}
            onReopen={onReopen ? () => onReopen(lead) : undefined}
          />
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
