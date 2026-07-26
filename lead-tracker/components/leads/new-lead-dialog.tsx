"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Plus } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogTrigger } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from "@/components/ui/select";
import { createLead, findDuplicates } from "@/lib/actions/leads";
import type { Option } from "@/lib/types";

interface Dup { id: string; lead_code: string; customer_name: string }

export function NewLeadDialog({
  affiliates,
  rms,
  insuranceTypes,
}: {
  affiliates: Option[];
  rms: Option[];
  insuranceTypes: Option[];
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [pending, startTransition] = useTransition();
  const [errors, setErrors] = useState<Record<string, string[]>>({});
  const [affiliateId, setAffiliateId] = useState("");
  const [rmId, setRmId] = useState("");
  const [typeId, setTypeId] = useState("");
  const [dups, setDups] = useState<Dup[]>([]);

  async function checkDup(email: string, phone: string) {
    if (!email && !phone) return setDups([]);
    const rows = await findDuplicates({ email: email || undefined, phone: phone || undefined });
    setDups(rows as Dup[]);
  }

  function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    const input = {
      customerName: String(fd.get("customerName") ?? ""),
      email: String(fd.get("email") ?? ""),
      phone: String(fd.get("phone") ?? ""),
      nationality: String(fd.get("nationality") ?? ""),
      countryOfResidence: String(fd.get("countryOfResidence") ?? ""),
      affiliateId,
      assignedRmId: rmId || null,
      insuranceTypeId: typeId || null,
      notes: String(fd.get("notes") ?? ""),
      currentStatus: "inbound" as const,
      sourceChannel: "manual" as const,
    };
    startTransition(async () => {
      const res = await createLead(input);
      if (res.ok) {
        toast.success(`Lead ${res.data.lead_code} created`);
        setOpen(false);
        setErrors({});
        setDups([]);
        setAffiliateId(""); setRmId(""); setTypeId("");
        router.refresh();
      } else {
        setErrors(res.fieldErrors ?? {});
        toast.error(res.error);
      }
    });
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button size="sm"><Plus className="h-4 w-4" /> New lead</Button>
      </DialogTrigger>
      <DialogContent className="max-w-xl">
        <DialogHeader><DialogTitle>New lead</DialogTitle></DialogHeader>
        <form onSubmit={onSubmit} className="space-y-3">
          <div className="space-y-1.5">
            <Label>Affiliate *</Label>
            <Select value={affiliateId} onValueChange={setAffiliateId}>
              <SelectTrigger><SelectValue placeholder="Which affiliate sent this lead?" /></SelectTrigger>
              <SelectContent>
                {affiliates.map((a) => <SelectItem key={a.id} value={a.id}>{a.label}</SelectItem>)}
              </SelectContent>
            </Select>
            {errors.affiliateId && <p className="text-xs text-destructive">{errors.affiliateId[0]}</p>}
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label>Customer name *</Label>
              <Input name="customerName" autoFocus />
              {errors.customerName && <p className="text-xs text-destructive">{errors.customerName[0]}</p>}
            </div>
            <div className="space-y-1.5">
              <Label>Insurance type</Label>
              <Select value={typeId} onValueChange={setTypeId}>
                <SelectTrigger><SelectValue placeholder="Optional" /></SelectTrigger>
                <SelectContent>
                  {insuranceTypes.map((t) => <SelectItem key={t.id} value={t.id}>{t.label}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label>Email</Label>
              <Input name="email" type="email" onBlur={(e) => checkDup(e.target.value, "")} />
              {errors.email && <p className="text-xs text-destructive">{errors.email[0]}</p>}
            </div>
            <div className="space-y-1.5">
              <Label>Phone</Label>
              <Input name="phone" onBlur={(e) => checkDup("", e.target.value)} />
            </div>
          </div>

          {dups.length > 0 && (
            <div className="rounded-md border border-amber-500/40 bg-amber-500/10 p-2 text-xs">
              <p className="font-medium text-amber-700 dark:text-amber-400">Possible duplicate{dups.length > 1 ? "s" : ""}:</p>
              <ul className="mt-1 space-y-0.5">
                {dups.map((d) => <li key={d.id} className="text-muted-foreground">{d.lead_code} — {d.customer_name}</li>)}
              </ul>
              <p className="mt-1 text-muted-foreground">You can still create this lead (affiliate attribution may differ).</p>
            </div>
          )}

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label>Nationality</Label>
              <Input name="nationality" placeholder="ISO-2, e.g. GB" maxLength={2} />
            </div>
            <div className="space-y-1.5">
              <Label>Country of residence</Label>
              <Input name="countryOfResidence" placeholder="ISO-2, e.g. TH" maxLength={2} />
            </div>
          </div>

          <div className="space-y-1.5">
            <Label>Assign RM</Label>
            <Select value={rmId} onValueChange={setRmId}>
              <SelectTrigger><SelectValue placeholder="Unassigned" /></SelectTrigger>
              <SelectContent>
                {rms.map((r) => <SelectItem key={r.id} value={r.id}>{r.label}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-1.5">
            <Label>Notes</Label>
            <Textarea name="notes" />
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setOpen(false)}>Cancel</Button>
            <Button type="submit" disabled={pending}>{pending ? "Creating…" : "Create lead"}</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
