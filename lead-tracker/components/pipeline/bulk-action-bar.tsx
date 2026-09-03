"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { X, ChevronDown, UserCog } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
} from "@/components/ui/dropdown-menu";
import { StageDot } from "@/components/leads/status-badge";
import { assignBroker } from "@/lib/actions/leads";
import { PIPELINE_STAGES, STAGE_LABEL, type PipelineStage } from "@/lib/domain/pipeline";
import type { Option } from "@/lib/types";

export function BulkActionBar({
  count,
  ids,
  brokers,
  onBulkStage,
  onBulkLost,
  onClear,
}: {
  count: number;
  ids: string[];
  brokers: Option[];
  onBulkStage: (to: PipelineStage) => void;
  onBulkLost: () => void;
  onClear: () => void;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  function assign(brokerId: string | null) {
    startTransition(async () => {
      const res = await assignBroker({ ids, brokerId });
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
          <Button variant="outline" size="sm">
            Set stage <ChevronDown className="h-3.5 w-3.5" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent>
          <DropdownMenuLabel>Move {count} to</DropdownMenuLabel>
          <DropdownMenuSeparator />
          {PIPELINE_STAGES.map((s) => (
            <DropdownMenuItem key={s} onSelect={() => onBulkStage(s)}>
              <StageDot stage={s} /> {STAGE_LABEL[s]}
            </DropdownMenuItem>
          ))}
          <DropdownMenuSeparator />
          <DropdownMenuItem onSelect={onBulkLost} className="text-red-600 dark:text-red-400">
            Mark as Squander
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>

      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="outline" size="sm" disabled={pending}>
            <UserCog className="h-4 w-4" /> Assign CRM
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent>
          <DropdownMenuItem onSelect={() => assign(null)}>Unassign</DropdownMenuItem>
          <DropdownMenuSeparator />
          {brokers.map((b) => (
            <DropdownMenuItem key={b.id} onSelect={() => assign(b.id)}>
              {b.label}
            </DropdownMenuItem>
          ))}
        </DropdownMenuContent>
      </DropdownMenu>

      <Button variant="ghost" size="sm" onClick={onClear} className="ml-auto">
        <X className="h-4 w-4" /> Clear
      </Button>
    </div>
  );
}
