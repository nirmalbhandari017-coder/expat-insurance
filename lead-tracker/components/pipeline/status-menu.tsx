"use client";

import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
} from "@/components/ui/dropdown-menu";
import { StageDot } from "@/components/leads/status-badge";
import {
  PIPELINE_STAGES,
  STAGE_LABEL,
  isBackward,
  type PipelineStage,
  type QualificationStatus,
  type OpportunityStatus,
} from "@/lib/domain/pipeline";
import type { ReactNode } from "react";

/**
 * Every stage is reachable in both directions (spec §7). Backward moves are
 * labelled so the choice is deliberate, not so it is blocked.
 */
export function StageMenu({
  current,
  qualification,
  opportunity,
  onSelect,
  onQualify,
  onMarkLost,
  onReopen,
  children,
}: {
  current: PipelineStage | null;
  qualification: QualificationStatus;
  opportunity: OpportunityStatus;
  onSelect: (to: PipelineStage) => void;
  onQualify?: (q: QualificationStatus) => void;
  onMarkLost?: () => void;
  onReopen?: () => void;
  children: ReactNode;
}) {
  const isLost = opportunity === "lost";
  const isQualified = qualification === "qualified";

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>{children}</DropdownMenuTrigger>
      <DropdownMenuContent align="start" className="w-56">
        {!isQualified && (
          <>
            <DropdownMenuLabel>Qualification</DropdownMenuLabel>
            <DropdownMenuSeparator />
            <DropdownMenuItem onSelect={() => onQualify?.("qualified")}>
              Mark Qualified
            </DropdownMenuItem>
            {qualification !== "not_qualified" && (
              <DropdownMenuItem onSelect={() => onQualify?.("not_qualified")}>
                Mark Not Qualified
              </DropdownMenuItem>
            )}
            {qualification === "not_qualified" && (
              <DropdownMenuItem onSelect={() => onQualify?.("pending")}>
                Back to Pending
              </DropdownMenuItem>
            )}
          </>
        )}

        {isQualified && isLost && (
          <>
            <DropdownMenuLabel>Lost</DropdownMenuLabel>
            <DropdownMenuSeparator />
            <DropdownMenuItem onSelect={() => onReopen?.()}>Reopen lead</DropdownMenuItem>
          </>
        )}

        {isQualified && !isLost && (
          <>
            <DropdownMenuLabel>Move to</DropdownMenuLabel>
            <DropdownMenuSeparator />
            {PIPELINE_STAGES.filter((s) => s !== current).map((to) => (
              <DropdownMenuItem key={to} onSelect={() => onSelect(to)}>
                <StageDot stage={to} />
                <span className="flex-1">{STAGE_LABEL[to]}</span>
                {current && isBackward(current, to) && (
                  <span className="text-[10px] uppercase tracking-wide text-muted-foreground">
                    back
                  </span>
                )}
              </DropdownMenuItem>
            ))}
            <DropdownMenuSeparator />
            <DropdownMenuItem
              onSelect={() => onMarkLost?.()}
              className="text-red-600 dark:text-red-400"
            >
              Mark as Lost
            </DropdownMenuItem>
          </>
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
