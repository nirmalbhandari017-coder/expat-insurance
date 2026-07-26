"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { X, ChevronDown, UserCog } from "lucide-react";
import { Button } from "@/components/ui/button";
import { DropdownMenu, DropdownMenuTrigger, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuSeparator } from "@/components/ui/dropdown-menu";
import { StatusDot } from "@/components/leads/status-badge";
import { assignRm } from "@/lib/actions/leads";
import { PIPELINE_STATUSES, STATUS_LABEL, type LeadStatus } from "@/lib/domain/pipeline";
import type { Option } from "@/lib/types";

export function BulkActionBar({
  count,
  ids,
  rms,
  onBulkStatus,
  onClear,
}: {
  count: number;
  ids: string[];
  rms: Option[];
  onBulkStatus: (to: LeadStatus) => void;
  onClear: () => void;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  function assign(rmId: string | null) {
    startTransition(async () => {
      const res = await assignRm({ ids, rmId });
      if (res.ok) {
        toast.success(`Assigned ${res.data.updated}`);
        router.refresh();
        onClear();
      } else toast.error(res.error);
    });
  }

  return (
    <div className="flex items-center gap-2 rounded-lg border bg-card px-3 py-2 shadow-sm">
      <span className="text-sm font-medium">{count} selected</span>
      <div className="mx-1 h-4 w-px bg-border" />

      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="outline" size="sm">Set status <ChevronDown className="h-3.5 w-3.5" /></Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent>
          <DropdownMenuLabel>Move {count} to</DropdownMenuLabel>
          <DropdownMenuSeparator />
          {PIPELINE_STATUSES.map((s) => (
            <DropdownMenuItem key={s} onSelect={() => onBulkStatus(s)}>
              <StatusDot status={s} /> {STATUS_LABEL[s]}
            </DropdownMenuItem>
          ))}
        </DropdownMenuContent>
      </DropdownMenu>

      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="outline" size="sm" disabled={pending}><UserCog className="h-4 w-4" /> Assign RM</Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent>
          <DropdownMenuItem onSelect={() => assign(null)}>Unassign</DropdownMenuItem>
          <DropdownMenuSeparator />
          {rms.map((r) => <DropdownMenuItem key={r.id} onSelect={() => assign(r.id)}>{r.label}</DropdownMenuItem>)}
        </DropdownMenuContent>
      </DropdownMenu>

      <Button variant="ghost" size="sm" onClick={onClear} className="ml-auto"><X className="h-4 w-4" /> Clear</Button>
    </div>
  );
}
