"use client";

import { DropdownMenu, DropdownMenuTrigger, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuSeparator } from "@/components/ui/dropdown-menu";
import { StatusDot } from "@/components/leads/status-badge";
import { allowedTransitions, transitionKind, STATUS_LABEL, type LeadStatus } from "@/lib/domain/pipeline";
import type { PipelinePerms } from "@/lib/types";
import type { ReactNode } from "react";

export function StatusMenu({
  current,
  perms,
  onSelect,
  children,
}: {
  current: LeadStatus;
  perms: PipelinePerms;
  onSelect: (to: LeadStatus) => void;
  children: ReactNode;
}) {
  const targets = allowedTransitions(current).filter((to) => {
    const kind = transitionKind(current, to);
    if (kind === "correction" && !perms.canCorrect) return false; // backward = admin/BD only
    return true;
  });

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>{children}</DropdownMenuTrigger>
      <DropdownMenuContent align="start" className="w-52">
        <DropdownMenuLabel>Move to</DropdownMenuLabel>
        <DropdownMenuSeparator />
        {targets.length === 0 && (
          <div className="px-2 py-1.5 text-xs text-muted-foreground">No moves available</div>
        )}
        {targets.map((to) => {
          const kind = transitionKind(current, to);
          return (
            <DropdownMenuItem key={to} onSelect={() => onSelect(to)}>
              <StatusDot status={to} />
              <span className="flex-1">{STATUS_LABEL[to]}</span>
              {kind && kind !== "progress" && (
                <span className="text-[10px] uppercase tracking-wide text-muted-foreground">{kind}</span>
              )}
            </DropdownMenuItem>
          );
        })}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
