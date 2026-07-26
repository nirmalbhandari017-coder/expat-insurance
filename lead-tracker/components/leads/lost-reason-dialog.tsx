"use client";

import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from "@/components/ui/select";
import { LOST_REASONS, LOST_REASON_LABEL, type LostReason } from "@/lib/domain/pipeline";

export interface LostReasonResult {
  lostReason: LostReason;
  lostReasonDetail?: string;
}

export function LostReasonDialog({
  open,
  onOpenChange,
  onConfirm,
  count = 1,
}: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  onConfirm: (r: LostReasonResult) => void;
  count?: number;
}) {
  const [reason, setReason] = useState<LostReason | "">("");
  const [detail, setDetail] = useState("");
  const needsDetail = reason === "other";
  const valid = reason && (!needsDetail || detail.trim().length > 0);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Mark as Lost</DialogTitle>
          <DialogDescription>
            {count > 1 ? `${count} leads` : "This lead"} never converted. A reason is required — it&apos;s the
            single most valuable reporting field.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-3">
          <div className="space-y-1.5">
            <Label>Lost reason</Label>
            <Select value={reason} onValueChange={(v) => setReason(v as LostReason)}>
              <SelectTrigger><SelectValue placeholder="Select a reason…" /></SelectTrigger>
              <SelectContent>
                {LOST_REASONS.map((r) => (
                  <SelectItem key={r} value={r}>{LOST_REASON_LABEL[r]}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          {needsDetail && (
            <div className="space-y-1.5">
              <Label>Details</Label>
              <Textarea value={detail} onChange={(e) => setDetail(e.target.value)} placeholder="Explain the reason…" />
            </div>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button
            variant="destructive"
            disabled={!valid}
            onClick={() => {
              if (!reason) return;
              onConfirm({ lostReason: reason, lostReasonDetail: needsDetail ? detail.trim() : undefined });
              setReason("");
              setDetail("");
            }}
          >
            Mark as Lost
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
