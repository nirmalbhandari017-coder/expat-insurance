"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Plus } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogTrigger } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from "@/components/ui/select";
import { createAffiliate } from "@/lib/actions/affiliates";

const TYPES = [
  ["relocation_agency", "Relocation agency"],
  ["expat_services", "Expat services"],
  ["referral_partner", "Referral partner"],
  ["financial_advisor", "Financial advisor"],
  ["other", "Other"],
] as const;

export function NewAffiliateDialog({ canSeeCommission }: { canSeeCommission: boolean }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [type, setType] = useState<string>("other");
  const [pending, start] = useTransition();

  function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    const commission = fd.get("commissionPct");
    start(async () => {
      const res = await createAffiliate({
        name: String(fd.get("name") ?? ""),
        contactPerson: String(fd.get("contactPerson") ?? ""),
        email: String(fd.get("email") ?? ""),
        phone: String(fd.get("phone") ?? ""),
        country: String(fd.get("country") ?? ""),
        commissionPct: commission ? Number(commission) : null,
        type: type as never,
        isActive: true,
      });
      if (res.ok) { toast.success("Affiliate created"); setOpen(false); router.refresh(); }
      else toast.error(res.error);
    });
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button size="sm"><Plus className="h-4 w-4" /> New affiliate</Button>
      </DialogTrigger>
      <DialogContent className="max-w-lg">
        <DialogHeader><DialogTitle>New affiliate</DialogTitle></DialogHeader>
        <form onSubmit={onSubmit} className="space-y-3">
          <div className="space-y-1.5">
            <Label>Name *</Label>
            <Input name="name" required autoFocus />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5"><Label>Contact person</Label><Input name="contactPerson" /></div>
            <div className="space-y-1.5">
              <Label>Type</Label>
              <Select value={type} onValueChange={setType}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>{TYPES.map(([v, l]) => <SelectItem key={v} value={v}>{l}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5"><Label>Email</Label><Input name="email" type="email" /></div>
            <div className="space-y-1.5"><Label>Phone</Label><Input name="phone" /></div>
            <div className="space-y-1.5"><Label>Country</Label><Input name="country" placeholder="ISO-2" maxLength={2} /></div>
            {canSeeCommission && (
              <div className="space-y-1.5"><Label>Commission %</Label><Input name="commissionPct" type="number" step="0.01" min="0" max="100" /></div>
            )}
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setOpen(false)}>Cancel</Button>
            <Button type="submit" disabled={pending}>{pending ? "Creating…" : "Create"}</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
