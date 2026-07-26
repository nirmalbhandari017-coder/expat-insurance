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
import type { LeadRow, PipelinePerms, Option } from "@/lib/types";
import type { LeadFilters } from "@/lib/filters";
import type { LeadStatus } from "@/lib/domain/pipeline";
import { cn } from "@/lib/utils";

type View = "kanban" | "table";

export function PipelineShell({
  leads,
  perms,
  initialView,
  filters,
  affiliates,
  rms,
  insuranceTypes,
  total,
}: {
  leads: LeadRow[];
  perms: PipelinePerms;
  initialView: View;
  filters: LeadFilters;
  affiliates: Option[];
  rms: Option[];
  insuranceTypes: Option[];
  total: number;
}) {
  const [view, setView] = useState<View>(initialView);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const clearSelection = useCallback(() => setSelected(new Set()), []);
  const { request, requestBulk, dialogs } = usePipelineActions(clearSelection);

  function switchView(v: View) {
    setView(v);
    void updatePipelineView(v);
  }

  const onChangeStatus = useCallback((lead: LeadRow, to: LeadStatus) => request(lead, to), [request]);

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
              className={cn("flex h-7 items-center gap-1.5 rounded px-2 text-xs", view === "kanban" ? "bg-secondary font-medium" : "text-muted-foreground")}
            >
              <LayoutGrid className="h-3.5 w-3.5" /> Board
            </button>
            <button
              onClick={() => switchView("table")}
              className={cn("flex h-7 items-center gap-1.5 rounded px-2 text-xs", view === "table" ? "bg-secondary font-medium" : "text-muted-foreground")}
            >
              <Table2 className="h-3.5 w-3.5" /> Table
            </button>
          </div>
          {perms.canCreate && <NewLeadDialog affiliates={affiliates} rms={rms} insuranceTypes={insuranceTypes} />}
        </div>
      </div>

      <FilterBar filters={filters} affiliates={affiliates} rms={rms} />

      {selected.size > 0 && perms.canUpdate && (
        <BulkActionBar
          count={selected.size}
          ids={Array.from(selected)}
          rms={rms}
          onBulkStatus={(to) => requestBulk(Array.from(selected), to)}
          onClear={clearSelection}
        />
      )}

      {view === "kanban" ? (
        <KanbanBoard leads={leads} perms={perms} onChangeStatus={onChangeStatus} />
      ) : (
        <LeadsTable
          leads={leads}
          perms={perms}
          selected={selected}
          onToggle={toggle}
          onToggleAll={toggleAll}
          onChangeStatus={onChangeStatus}
        />
      )}

      {dialogs}
    </div>
  );
}
