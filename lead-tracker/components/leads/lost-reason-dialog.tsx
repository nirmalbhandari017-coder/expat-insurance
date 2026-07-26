"use client";

import { useEffect, useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectTrigger,
  SelectValue,
  SelectContent,
  SelectItem,
} from "@/components/ui/select";
import { createClient } from "@/lib/supabase/client";

export interface LostReasonResult {
  lostReasonId: string;
  lostNotes?: string;
}

interface Reason {
  id: string;
  code: string;
  label: string;
}

/**
 * Reasons come from the `lost_reasons` table rather than a hard-coded enum, so
 * the list can be edited without a migration (spec §22).
 */
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
  const [reasons, setReasons] = useState<Reason[]>([]);
  const [reasonId, setReasonId] = useState("");
  const [notes, setNotes] = useState("");

  useEffect(() => {
    if (!open) return;
    const supabase = createClient();
    supabase
      .from("lost_reasons")
      .select("id, code, label")
      .eq("is_active", true)
      .order("sort_order")
      .then(({ data }) => setReasons(data ?? []));
  }, [open]);

  const selected = reasons.find((r) => r.id === reasonId);
  const needsNotes = selected?.code === "other";
  const valid = !!reasonId && (!needsNotes || notes.trim().length > 0);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Mark as Lost</DialogTitle>
          <DialogDescription>
            {count > 1 ? `${count} leads` : "This lead"} didn&apos;t convert. The current stage is kept
            so you can see where deals are being lost.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-3">
          <div className="space-y-1.5">
            <Label>Lost reason</Label>
            <Select value={reasonId} onValueChange={setReasonId}>
              <SelectTrigger>
                <SelectValue placeholder="Select a reason…" />
              </SelectTrigger>
              <SelectContent>
                {reasons.map((r) => (
                  <SelectItem key={r.id} value={r.id}>
                    {r.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label>
              Lost notes {needsNotes ? "" : <span className="text-muted-foreground">(optional)</span>}
            </Label>
            <Textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Any detail worth remembering…"
            />
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button
            variant="destructive"
            disabled={!valid}
            onClick={() => {
              if (!reasonId) return;
              onConfirm({ lostReasonId: reasonId, lostNotes: notes.trim() || undefined });
              setReasonId("");
              setNotes("");
            }}
          >
            Mark as Lost
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
