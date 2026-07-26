"use client";

import { useCallback, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { changeLeadStatus, bulkChangeStatus } from "@/lib/actions/leads";
import { transitionKind, isTransitionAllowed, type LeadStatus } from "@/lib/domain/pipeline";
import { LostReasonDialog, type LostReasonResult } from "@/components/leads/lost-reason-dialog";
import { ReasonDialog } from "@/components/leads/reason-dialog";
import type { LeadRow } from "@/lib/types";

interface Pending {
  ids: string[];
  toStatus: LeadStatus;
  bulk: boolean;
}

export function usePipelineActions(onDone?: () => void) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [lost, setLost] = useState<Pending | null>(null);
  const [correction, setCorrection] = useState<Pending | null>(null);

  const run = useCallback(
    (p: Pending, extra?: { reason?: string } & Partial<LostReasonResult>) => {
      startTransition(async () => {
        if (p.bulk) {
          const res = await bulkChangeStatus({
            ids: p.ids,
            toStatus: p.toStatus,
            reason: extra?.reason,
            lostReason: extra?.lostReason,
            lostReasonDetail: extra?.lostReasonDetail,
          });
          if (res.ok) {
            const { updated, failed } = res.data;
            toast.success(`${updated} updated${failed ? `, ${failed} skipped` : ""}`);
            router.refresh();
            onDone?.();
          } else toast.error(res.error);
        } else {
          const res = await changeLeadStatus({
            id: p.ids[0],
            toStatus: p.toStatus,
            reason: extra?.reason,
            lostReason: extra?.lostReason,
            lostReasonDetail: extra?.lostReasonDetail,
          });
          if (res.ok) {
            toast.success("Status updated");
            router.refresh();
            onDone?.();
          } else toast.error(res.error);
        }
      });
    },
    [router, onDone],
  );

  const request = useCallback(
    (lead: Pick<LeadRow, "id" | "current_status">, toStatus: LeadStatus) => {
      if (lead.current_status === toStatus) return;
      if (!isTransitionAllowed(lead.current_status, toStatus)) {
        toast.error("That status change isn't allowed.");
        return;
      }
      const kind = transitionKind(lead.current_status, toStatus);
      const pending: Pending = { ids: [lead.id], toStatus, bulk: false };
      if (toStatus === "lost") setLost(pending);
      else if (kind === "correction") setCorrection(pending);
      else run(pending);
    },
    [run],
  );

  const requestBulk = useCallback(
    (ids: string[], toStatus: LeadStatus) => {
      if (ids.length === 0) return;
      const pending: Pending = { ids, toStatus, bulk: true };
      if (toStatus === "lost") setLost(pending);
      else run(pending); // corrections aren't offered in bulk
    },
    [run],
  );

  const dialogs = (
    <>
      <LostReasonDialog
        open={!!lost}
        count={lost?.ids.length ?? 1}
        onOpenChange={(o) => !o && setLost(null)}
        onConfirm={(r) => {
          if (lost) run(lost, r);
          setLost(null);
        }}
      />
      <ReasonDialog
        open={!!correction}
        title="Correcting status backward"
        description="Backward moves clear that stage's date. A reason is required and recorded."
        onOpenChange={(o) => !o && setCorrection(null)}
        onConfirm={(reason) => {
          if (correction) run(correction, { reason });
          setCorrection(null);
        }}
      />
    </>
  );

  return { request, requestBulk, dialogs, isPending };
}
