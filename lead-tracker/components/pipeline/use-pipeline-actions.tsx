"use client";

import { useCallback, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import {
  changeStage,
  bulkChangeStage,
  setQualification,
  markLost,
  reopenLead,
} from "@/lib/actions/leads";
import { isBackward, type PipelineStage, type QualificationStatus } from "@/lib/domain/pipeline";
import { LostReasonDialog, type LostReasonResult } from "@/components/leads/lost-reason-dialog";
import { ReasonDialog } from "@/components/leads/reason-dialog";
import type { LeadRow } from "@/lib/types";

interface PendingStage {
  ids: string[];
  stage: PipelineStage;
  bulk: boolean;
}

type LeadLike = Pick<LeadRow, "id" | "stage" | "qualification" | "opportunity">;

export function usePipelineActions(onDone?: () => void) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [lost, setLost] = useState<{ ids: string[] } | null>(null);
  const [correction, setCorrection] = useState<PendingStage | null>(null);

  const after = useCallback(
    (msg: string) => {
      toast.success(msg);
      router.refresh();
      onDone?.();
    },
    [router, onDone],
  );

  const runStage = useCallback(
    (p: PendingStage, reason?: string) => {
      startTransition(async () => {
        if (p.bulk) {
          const res = await bulkChangeStage({ ids: p.ids, stage: p.stage, reason });
          if (res.ok) {
            const { updated, failed } = res.data;
            after(`${updated} updated${failed ? `, ${failed} skipped` : ""}`);
          } else toast.error(res.error);
        } else {
          const res = await changeStage({ id: p.ids[0], stage: p.stage, reason });
          if (res.ok) after("Stage updated");
          else toast.error(res.error);
        }
      });
    },
    [after],
  );

  /**
   * Moving a deal backwards is legitimate practice, so it is allowed — but it
   * asks for a reason, because an unexplained reversal is the kind of thing
   * someone will want to understand three months later.
   */
  const request = useCallback(
    (lead: LeadLike, stage: PipelineStage) => {
      if (lead.stage === stage) return;
      if (lead.qualification !== "qualified") {
        toast.error("Qualify this lead before moving it through the pipeline.");
        return;
      }
      if (lead.opportunity === "lost") {
        toast.error("Reopen this lead before changing its stage.");
        return;
      }
      const pending: PendingStage = { ids: [lead.id], stage, bulk: false };
      if (lead.stage && isBackward(lead.stage, stage)) setCorrection(pending);
      else runStage(pending);
    },
    [runStage],
  );

  const requestBulk = useCallback(
    (ids: string[], stage: PipelineStage) => {
      if (ids.length === 0) return;
      runStage({ ids, stage, bulk: true });
    },
    [runStage],
  );

  const requestQualification = useCallback(
    (id: string, qualification: QualificationStatus) => {
      startTransition(async () => {
        const res = await setQualification({ id, qualification });
        if (res.ok) {
          after(
            qualification === "qualified"
              ? "Lead qualified — now in the pipeline"
              : qualification === "not_qualified"
                ? "Marked Not Qualified"
                : "Moved back to Pending Qualification",
          );
        } else toast.error(res.error);
      });
    },
    [after],
  );

  const requestLost = useCallback((ids: string[]) => {
    if (ids.length) setLost({ ids });
  }, []);

  const requestReopen = useCallback(
    (id: string, stage?: PipelineStage | null) => {
      startTransition(async () => {
        const res = await reopenLead({ id, stage: stage ?? undefined });
        if (res.ok) after("Lead reopened");
        else toast.error(res.error);
      });
    },
    [after],
  );

  const confirmLost = useCallback(
    (ids: string[], r: LostReasonResult) => {
      startTransition(async () => {
        let done = 0;
        let failed = 0;
        for (const id of ids) {
          const res = await markLost({ id, lostReasonId: r.lostReasonId, lostNotes: r.lostNotes });
          if (res.ok) done++;
          else failed++;
        }
        if (done) after(`${done} marked lost${failed ? `, ${failed} skipped` : ""}`);
        else toast.error("Could not mark as lost");
      });
    },
    [after],
  );

  const dialogs = (
    <>
      <LostReasonDialog
        open={!!lost}
        count={lost?.ids.length ?? 1}
        onOpenChange={(o) => !o && setLost(null)}
        onConfirm={(r) => {
          if (lost) confirmLost(lost.ids, r);
          setLost(null);
        }}
      />
      <ReasonDialog
        open={!!correction}
        title="Moving this deal backwards"
        description="This is allowed, but the reason is recorded in the lead's history."
        onOpenChange={(o) => !o && setCorrection(null)}
        onConfirm={(reason) => {
          if (correction) runStage(correction, reason);
          setCorrection(null);
        }}
      />
    </>
  );

  return {
    request,
    requestBulk,
    requestQualification,
    requestLost,
    requestReopen,
    dialogs,
    isPending,
  };
}
