"use client";

import { useCallback, useState } from "react";
import { LayoutGrid, Table2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { FilterBar } from "./filter-bar";
import { KanbanBoard } from "./kanban-board";
import { LeadsTable } from "./leads-table";
import { BulkActionBar } from "./bulk-action-bar";
import { NewLeadDialog } from "@/components/leads/new-lead-dialog";
import { usePipelineActions } from "./use-pipeline-actions";
import { updatePipelineView } from "@/lib/actions/interactions";
import type { LeadRow, PipelinePerms, Option, GeneratorOption } from "@/lib/types";
import type { LeadFilters } from "@/lib/filters";
import type { PipelineStage, QualificationStatus } from "@/lib/domain/pipeline";
import { cn } from "@/lib/utils";

type View = "kanban" | "table";

export function PipelineShell({
  leads,
  perms,
  initialView,
  filters,
  affiliates,
  generators,
  brokers,
  products,
  total,
}: {
  leads: LeadRow[];
  perms: PipelinePerms;
  initialView: View;
  filters: LeadFilters;
  affiliates: Option[];
  generators: GeneratorOption[];
  brokers: Option[];
  products: Option[];
  total: number;
}) {
  const [view, setView] = useState<View>(initialView);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const clearSelection = useCallback(() => setSelected(new Set()), []);
  const { request, requestBulk, requestQualification, requestLost, requestReopen, dialogs } =
    usePipelineActions(clearSelection);

  function switchView(v: View) {
    setView(v);
    void updatePipelineView(v);
  }

  const onChangeStage = useCallback(
    (lead: LeadRow, to: PipelineStage) => request(lead, to),
    [request],
  );
  const onQualify = useCallback(
    (lead: LeadRow, q: QualificationStatus) => requestQualification(lead.id, q),
    [requestQualification],
  );
  const onMarkLost = useCallback((lead: LeadRow) => requestLost([lead.id]), [requestLost]);
  const onReopen = useCallback(
    (lead: LeadRow) => requestReopen(lead.id, lead.stage_at_loss),
    [requestReopen],
  );

  function toggle(id: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }
  function toggleAll(on: boolean) {
    setSelected(on ? new Set(leads.map((l) => l.id)) : new Set());
  }

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-semibold tracking-tight">Pipeline</h1>
          <p className="text-xs text-muted-foreground">
            {total} lead{total === 1 ? "" : "s"}
            {perms.updateScope === "own" && " assigned to you"}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <div className="flex items-center rounded-md border p-0.5">
            <button
              onClick={() => switchView("kanban")}
              className={cn(
                "flex h-7 items-center gap-1.5 rounded px-2 text-xs",
                view === "kanban" ? "bg-secondary font-medium" : "text-muted-foreground",
              )}
            >
              <LayoutGrid className="h-3.5 w-3.5" /> Board
            </button>
            <button
              onClick={() => switchView("table")}
              className={cn(
                "flex h-7 items-center gap-1.5 rounded px-2 text-xs",
                view === "table" ? "bg-secondary font-medium" : "text-muted-foreground",
              )}
            >
              <Table2 className="h-3.5 w-3.5" /> Table
            </button>
          </div>
          {perms.canCreate && (
            <NewLeadDialog
              affiliates={affiliates}
              generators={generators}
              brokers={brokers}
              products={products}
            />
          )}
        </div>
      </div>

      <FilterBar
        filters={filters}
        affiliates={affiliates}
        generators={generators}
        brokers={brokers}
        products={products}
      />

      {view === "kanban" && (
        <p className="text-xs text-muted-foreground">
          The board shows qualified, active opportunities. Squandered leads are under the Outcome
          filter.
        </p>
      )}

      {selected.size > 0 && perms.canUpdate && (
        <BulkActionBar
          count={selected.size}
          ids={Array.from(selected)}
          brokers={brokers}
          onBulkStage={(to) => requestBulk(Array.from(selected), to)}
          onBulkLost={() => requestLost(Array.from(selected))}
          onClear={clearSelection}
        />
      )}

      {view === "kanban" ? (
        <KanbanBoard
          leads={leads}
          perms={perms}
          onChangeStage={onChangeStage}
          onQualify={onQualify}
          onMarkLost={onMarkLost}
          onReopen={onReopen}
        />
      ) : (
        <LeadsTable
          leads={leads}
          perms={perms}
          selected={selected}
          onToggle={toggle}
          onToggleAll={toggleAll}
          onChangeStage={onChangeStage}
          onQualify={onQualify}
          onMarkLost={onMarkLost}
          onReopen={onReopen}
        />
      )}

      {dialogs}
    </div>
  );
}
