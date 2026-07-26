"use client";

import Link from "next/link";
import { ChevronDown } from "lucide-react";
import { StatusBadge } from "@/components/leads/status-badge";
import { StatusMenu } from "./status-menu";
import { shortDate, relativeAge } from "@/lib/format";
import type { LeadRow, PipelinePerms } from "@/lib/types";
import type { LeadStatus } from "@/lib/domain/pipeline";
import { cn } from "@/lib/utils";

export function LeadsTable({
  leads,
  perms,
  selected,
  onToggle,
  onToggleAll,
  onChangeStatus,
}: {
  leads: LeadRow[];
  perms: PipelinePerms;
  selected: Set<string>;
  onToggle: (id: string) => void;
  onToggleAll: (on: boolean) => void;
  onChangeStatus: (lead: LeadRow, to: LeadStatus) => void;
}) {
  const allChecked = leads.length > 0 && leads.every((l) => selected.has(l.id));

  function canEdit(l: LeadRow) {
    return perms.canUpdate && (perms.updateScope === "all" || l.assigned_rm_id === perms.currentUserId);
  }

  return (
    <div className="overflow-x-auto rounded-lg border">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b bg-muted/40 text-left text-xs text-muted-foreground">
            <th className="w-8 px-3 py-2">
              <input type="checkbox" checked={allChecked} onChange={(e) => onToggleAll(e.target.checked)} aria-label="Select all" />
            </th>
            <th className="px-3 py-2 font-medium">Code</th>
            <th className="px-3 py-2 font-medium">Customer</th>
            <th className="px-3 py-2 font-medium">Affiliate</th>
            <th className="px-3 py-2 font-medium">Status</th>
            <th className="px-3 py-2 font-medium">RM</th>
            <th className="px-3 py-2 font-medium">Created</th>
            <th className="px-3 py-2 font-medium">Age in stage</th>
          </tr>
        </thead>
        <tbody>
          {leads.map((l) => (
            <tr key={l.id} className={cn("border-b transition-colors hover:bg-muted/30", selected.has(l.id) && "bg-primary/5")}>
              <td className="px-3 py-2">
                <input type="checkbox" checked={selected.has(l.id)} onChange={() => onToggle(l.id)} aria-label={`Select ${l.lead_code}`} />
              </td>
              <td className="tabular px-3 py-2 text-muted-foreground">{l.lead_code}</td>
              <td className="px-3 py-2">
                <Link href={`/leads/${l.lead_code}`} className="font-medium hover:underline">{l.customer_name}</Link>
                {l.email && <div className="truncate text-xs text-muted-foreground">{l.email}</div>}
              </td>
              <td className="px-3 py-2">{l.affiliate?.name ?? "—"}</td>
              <td className="px-3 py-2">
                {canEdit(l) ? (
                  <StatusMenu current={l.current_status} perms={perms} onSelect={(to) => onChangeStatus(l, to)}>
                    <button className="inline-flex items-center gap-1 rounded hover:opacity-80">
                      <StatusBadge status={l.current_status} />
                      <ChevronDown className="h-3 w-3 text-muted-foreground" />
                    </button>
                  </StatusMenu>
                ) : (
                  <StatusBadge status={l.current_status} />
                )}
              </td>
              <td className="px-3 py-2 text-muted-foreground">{l.rm?.full_name ?? "—"}</td>
              <td className="px-3 py-2 text-muted-foreground">{shortDate(l.created_at)}</td>
              <td className="tabular px-3 py-2 text-muted-foreground">{relativeAge(l.stage_entered_at)}</td>
            </tr>
          ))}
          {leads.length === 0 && (
            <tr><td colSpan={8} className="px-3 py-10 text-center text-sm text-muted-foreground">No leads match these filters.</td></tr>
          )}
        </tbody>
      </table>
    </div>
  );
}
