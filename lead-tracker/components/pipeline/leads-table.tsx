"use client";

import Link from "next/link";
import { ChevronDown } from "lucide-react";
import {
  StageBadge,
  QualificationBadge,
  OpportunityBadge,
} from "@/components/leads/status-badge";
import { StageMenu } from "./status-menu";
import { shortDate, relativeAge } from "@/lib/format";
import { ageFromDob, type PipelineStage, type QualificationStatus } from "@/lib/domain/pipeline";
import type { LeadRow, PipelinePerms } from "@/lib/types";
import { cn } from "@/lib/utils";

export function LeadsTable({
  leads,
  perms,
  selected,
  onToggle,
  onToggleAll,
  onChangeStage,
  onQualify,
  onMarkLost,
  onReopen,
}: {
  leads: LeadRow[];
  perms: PipelinePerms;
  selected: Set<string>;
  onToggle: (id: string) => void;
  onToggleAll: (on: boolean) => void;
  onChangeStage: (lead: LeadRow, to: PipelineStage) => void;
  onQualify?: (lead: LeadRow, q: QualificationStatus) => void;
  onMarkLost?: (lead: LeadRow) => void;
  onReopen?: (lead: LeadRow) => void;
}) {
  const allChecked = leads.length > 0 && leads.every((l) => selected.has(l.id));

  function canEdit(l: LeadRow) {
    return perms.canUpdate && (perms.updateScope === "all" || l.broker_id === perms.currentUserId);
  }

  return (
    <div className="overflow-x-auto rounded-lg border">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b bg-muted/40 text-left text-xs text-muted-foreground">
            <th className="w-8 px-3 py-2">
              <input
                type="checkbox"
                checked={allChecked}
                onChange={(e) => onToggleAll(e.target.checked)}
                aria-label="Select all"
              />
            </th>
            <th className="px-3 py-2 font-medium">Name</th>
            <th className="px-3 py-2 font-medium">Product</th>
            <th className="px-3 py-2 font-medium">Location</th>
            <th className="px-3 py-2 font-medium">Age</th>
            <th className="px-3 py-2 font-medium">Source / Agent</th>
            <th className="px-3 py-2 font-medium">CRM</th>
            <th className="px-3 py-2 font-medium">Qualification</th>
            <th className="px-3 py-2 font-medium">Stage</th>
            <th className="px-3 py-2 font-medium">Updated</th>
          </tr>
        </thead>
        <tbody>
          {leads.map((l) => {
            const age = ageFromDob(l.date_of_birth);
            const products = l.products?.map((p) => p.product?.name).filter(Boolean) ?? [];
            return (
              <tr
                key={l.id}
                className={cn(
                  "border-b transition-colors hover:bg-muted/30",
                  selected.has(l.id) && "bg-primary/5",
                )}
              >
                <td className="px-3 py-2">
                  <input
                    type="checkbox"
                    checked={selected.has(l.id)}
                    onChange={() => onToggle(l.id)}
                    aria-label={`Select ${l.lead_code}`}
                  />
                </td>
                <td className="px-3 py-2">
                  <Link href={`/leads/${l.lead_code}`} className="font-medium hover:underline">
                    {l.customer_name}
                  </Link>
                  <div className="tabular text-xs text-muted-foreground">{l.lead_code}</div>
                </td>
                <td className="px-3 py-2 text-xs">
                  {products.length ? products.join(", ") : <span className="text-muted-foreground">—</span>}
                </td>
                <td className="px-3 py-2 text-muted-foreground">{l.country_of_residence ?? "—"}</td>
                <td className="tabular px-3 py-2 text-muted-foreground">{age ?? "—"}</td>
                <td className="px-3 py-2">
                  {l.affiliate?.name ?? "—"}
                  <div className="truncate text-xs text-muted-foreground">
                    {l.generator?.full_name ?? "—"}
                  </div>
                </td>
                <td className="px-3 py-2">
                  {l.broker?.full_name ?? <span className="text-muted-foreground">—</span>}
                  {l.broker?.company && (
                    <div className="truncate text-xs text-muted-foreground">{l.broker.company}</div>
                  )}
                </td>
                <td className="px-3 py-2">
                  <QualificationBadge qualification={l.qualification} />
                </td>
                <td className="px-3 py-2">
                  <div className="flex items-center gap-1.5">
                    {canEdit(l) ? (
                      <StageMenu
                        current={l.stage}
                        qualification={l.qualification}
                        opportunity={l.opportunity}
                        onSelect={(to) => onChangeStage(l, to)}
                        onQualify={onQualify ? (q) => onQualify(l, q) : undefined}
                        onMarkLost={onMarkLost ? () => onMarkLost(l) : undefined}
                        onReopen={onReopen ? () => onReopen(l) : undefined}
                      >
                        <button className="inline-flex items-center gap-1 rounded hover:opacity-80">
                          {l.stage ? (
                            <StageBadge stage={l.stage} />
                          ) : (
                            <span className="text-xs text-muted-foreground">Not in pipeline</span>
                          )}
                          <ChevronDown className="h-3 w-3 text-muted-foreground" />
                        </button>
                      </StageMenu>
                    ) : l.stage ? (
                      <StageBadge stage={l.stage} />
                    ) : (
                      <span className="text-xs text-muted-foreground">—</span>
                    )}
                    <OpportunityBadge opportunity={l.opportunity} />
                  </div>
                  {l.opportunity === "lost" && l.stage_at_loss && (
                    <div className="mt-0.5 text-[11px] text-muted-foreground">
                      lost at {l.stage_at_loss.replace(/_/g, " ")}
                    </div>
                  )}
                </td>
                <td className="px-3 py-2 text-muted-foreground">
                  {shortDate(l.updated_at)}
                  <div className="tabular text-xs">{relativeAge(l.stage_entered_at)} in stage</div>
                </td>
              </tr>
            );
          })}
          {leads.length === 0 && (
            <tr>
              <td colSpan={10} className="px-3 py-10 text-center text-sm text-muted-foreground">
                No leads match these filters.
              </td>
            </tr>
          )}
        </tbody>
      </table>
    </div>
  );
}
