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
  stageRank,
  type PipelineStage,
  type QualificationStatus,
} from "@/lib/domain/pipeline";
import type { LeadRow, PipelinePerms } from "@/lib/types";
import { cn } from "@/lib/utils";

const COLUMN_CAP = 50; // windowed per column; a count badge shows the full total

/** Terminal column id for squandered leads — not a pipeline stage. */
const SQUANDER = "squander" as const;

/**
 * Columns are the six pipeline stages plus a terminal Squander column, so the
 * whole outcome of the pipeline is visible in one place. Dragging a card into
 * Squander asks for a reason; squandered cards can't be dragged back out (they
 * are reopened from the card menu, which restores the right stage).
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

  // Squandered leads keep their stage_at_loss, so the column is ordered by how
  // far each one got before it was lost.
  const squandered = useMemo(
    () =>
      leads
        .filter((l) => l.opportunity === "lost")
        .sort(
          (a, b) =>
            (b.stage_at_loss ? stageRank(b.stage_at_loss) : 0) -
            (a.stage_at_loss ? stageRank(a.stage_at_loss) : 0),
        ),
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
    const to = e.over?.id as PipelineStage | typeof SQUANDER | undefined;
    if (!lead || !to || lead.stage === to) return;
    if (to === SQUANDER) {
      // Needs a reason, so hand off to the same dialog the menu uses.
      onMarkLost?.(lead);
      return;
    }
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
        <Column
          stage={SQUANDER}
          leads={squandered}
          perms={perms}
          onChangeStage={onChangeStage}
          onQualify={onQualify}
          onMarkLost={onMarkLost}
          onReopen={onReopen}
          isDragging={!!activeLead}
        />
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
  stage: PipelineStage | typeof SQUANDER;
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
  const isSquander = stage === SQUANDER;

  return (
    <div className={cn("flex w-64 shrink-0 flex-col", isSquander && "ml-2 border-l pl-3")}>
      <div className="mb-2 flex items-center justify-between px-1">
        <div className="flex items-center gap-2 text-sm font-medium">
          {isSquander ? (
            <span className="h-2 w-2 rounded-full bg-red-500" />
          ) : (
            <StageDot stage={stage} />
          )}
          {isSquander ? "Squander" : STAGE_LABEL[stage]}
        </div>
        <span className="tabular rounded bg-muted px-1.5 text-xs text-muted-foreground">
          {leads.length}
        </span>
      </div>
      <div
        ref={setNodeRef}
        className={cn(
          "flex min-h-[120px] flex-1 flex-col gap-2 rounded-lg border border-transparent p-1 transition-colors",
          isOver && isDragging && (isSquander ? "border-red-500/40 bg-red-500/5" : "border-primary/40 bg-primary/5"),
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
