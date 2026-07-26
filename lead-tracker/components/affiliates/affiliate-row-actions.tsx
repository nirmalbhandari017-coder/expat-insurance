"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { MoreHorizontal } from "lucide-react";
import { Button } from "@/components/ui/button";
import { DropdownMenu, DropdownMenuTrigger, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator } from "@/components/ui/dropdown-menu";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { setAffiliateActive, deleteAffiliate } from "@/lib/actions/affiliates";

export function AffiliateRowActions({
  id,
  name,
  isActive,
  canManage,
  canDelete,
}: {
  id: string;
  name: string;
  isActive: boolean;
  canManage: boolean;
  canDelete: boolean;
}) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [confirm, setConfirm] = useState(false);

  if (!canManage && !canDelete) return null;

  function toggleActive() {
    start(async () => {
      const res = await setAffiliateActive(id, !isActive);
      if (res.ok) { toast.success(isActive ? "Deactivated" : "Activated"); router.refresh(); }
      else toast.error(res.error);
    });
  }

  function remove() {
    start(async () => {
      const res = await deleteAffiliate(id);
      if (res.ok) { toast.success(`Deleted ${name}`); setConfirm(false); router.refresh(); }
      else toast.error(res.error); // e.g. "has N leads — deactivate instead"
    });
  }

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="ghost" size="icon-sm" aria-label="Actions"><MoreHorizontal className="h-4 w-4" /></Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end">
          {canManage && (
            <DropdownMenuItem onSelect={toggleActive}>{isActive ? "Deactivate" : "Activate"}</DropdownMenuItem>
          )}
          {canDelete && (
            <>
              <DropdownMenuSeparator />
              <DropdownMenuItem className="text-destructive focus:text-destructive" onSelect={() => setConfirm(true)}>
                Delete
              </DropdownMenuItem>
            </>
          )}
        </DropdownMenuContent>
      </DropdownMenu>

      <Dialog open={confirm} onOpenChange={setConfirm}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Delete {name}?</DialogTitle>
            <DialogDescription>
              This removes the affiliate from lists. It&apos;s blocked if the affiliate still has leads —
              deactivate it instead so their lead history stays intact.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setConfirm(false)}>Cancel</Button>
            <Button variant="destructive" onClick={remove} disabled={pending}>{pending ? "Deleting…" : "Delete"}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
