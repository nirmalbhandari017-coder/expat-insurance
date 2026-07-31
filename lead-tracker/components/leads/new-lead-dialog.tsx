"use client";

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Plus } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectTrigger,
  SelectValue,
  SelectContent,
  SelectItem,
} from "@/components/ui/select";
import { createLead, findDuplicates } from "@/lib/actions/leads";
import { ageFromDob } from "@/lib/domain/pipeline";
import type { Option, GeneratorOption, DuplicateMatch } from "@/lib/types";

const NONE = "__none__";

/**
 * Ordered for speed of entry (spec §21/27): who sent it, who they are, how to
 * reach them, what they want. Generator options depend on the chosen source.
 */
export function NewLeadDialog({
  affiliates,
  generators,
  brokers,
  products,
}: {
  affiliates: Option[];
  generators: GeneratorOption[];
  brokers: Option[];
  products: Option[];
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [pending, startTransition] = useTransition();
  const [errors, setErrors] = useState<Record<string, string[]>>({});

  const [affiliateId, setAffiliateId] = useState("");
  const [generatorId, setGeneratorId] = useState("");
  const [brokerId, setBrokerId] = useState("");
  const [productIds, setProductIds] = useState<string[]>([]);
  const [qualification, setQualification] = useState<"pending" | "qualified">("pending");

  const [phone, setPhone] = useState("");
  const [sameWhatsapp, setSameWhatsapp] = useState(true);
  const [whatsapp, setWhatsapp] = useState("");
  const [dups, setDups] = useState<DuplicateMatch[]>([]);

  const availableGenerators = useMemo(
    () => generators.filter((g) => g.affiliateId === affiliateId),
    [generators, affiliateId],
  );

  function toggleProduct(id: string) {
    setProductIds((prev) => (prev.includes(id) ? prev.filter((p) => p !== id) : [...prev, id]));
  }

  async function checkDup(partial: Partial<Record<string, string>>) {
    const rows = await findDuplicates(partial);
    setDups(rows);
  }

  function reset() {
    setErrors({});
    setDups([]);
    setAffiliateId("");
    setGeneratorId("");
    setBrokerId("");
    setProductIds([]);
    setQualification("pending");
    setPhone("");
    setWhatsapp("");
    setSameWhatsapp(true);
  }

  function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    const input = {
      title: String(fd.get("title") ?? ""),
      firstName: String(fd.get("firstName") ?? ""),
      lastName: String(fd.get("lastName") ?? ""),
      dateOfBirth: String(fd.get("dateOfBirth") ?? ""),
      countryOfResidence: String(fd.get("countryOfResidence") ?? ""),
      nationality: String(fd.get("nationality") ?? ""),
      email: String(fd.get("email") ?? ""),
      phone,
      whatsappSameAsPhone: sameWhatsapp,
      whatsappPhone: sameWhatsapp ? phone : whatsapp,
      productIds,
      affiliateId,
      generatorId: generatorId || null,
      brokerId: brokerId || null,
      qualification,
      note: String(fd.get("note") ?? ""),
      sourceChannel: "manual" as const,
    };
    startTransition(async () => {
      const res = await createLead(input);
      if (res.ok) {
        toast.success(`Lead ${res.data.lead_code} created`);
        setOpen(false);
        reset();
        router.refresh();
      } else {
        setErrors(res.fieldErrors ?? {});
        toast.error(res.error);
      }
    });
  }

  const err = (k: string) =>
    errors[k] ? <p className="text-xs text-destructive">{errors[k][0]}</p> : null;

  return (
    <Dialog
      open={open}
      onOpenChange={(o) => {
        setOpen(o);
        if (!o) reset();
      }}
    >
      <DialogTrigger asChild>
        <Button size="sm">
          <Plus className="h-4 w-4" /> New lead
        </Button>
      </DialogTrigger>
      <DialogContent className="max-h-[85vh] max-w-2xl overflow-y-auto">
        <DialogHeader>
          <DialogTitle>New lead</DialogTitle>
        </DialogHeader>
        <form onSubmit={onSubmit} className="space-y-4">
          {/* ---- Attribution first: it's the field people forget ---- */}
          <fieldset className="space-y-3 rounded-md border p-3">
            <legend className="px-1 text-xs font-medium text-muted-foreground">Attribution</legend>
            <div className="grid grid-cols-3 gap-3">
              <div className="space-y-1.5">
                <Label>Source *</Label>
                <Select
                  value={affiliateId}
                  onValueChange={(v) => {
                    setAffiliateId(v);
                    setGeneratorId("");
                  }}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Who sent it?" />
                  </SelectTrigger>
                  <SelectContent>
                    {affiliates.map((a) => (
                      <SelectItem key={a.id} value={a.id}>
                        {a.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                {err("affiliateId")}
              </div>
              <div className="space-y-1.5">
                <Label>Agent</Label>
                <Select
                  value={generatorId || NONE}
                  onValueChange={(v) => setGeneratorId(v === NONE ? "" : v)}
                  disabled={!affiliateId}
                >
                  <SelectTrigger>
                    <SelectValue placeholder={affiliateId ? "Optional" : "Pick a source first"} />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value={NONE}>— none —</SelectItem>
                    {availableGenerators.map((g) => (
                      <SelectItem key={g.id} value={g.id}>
                        {g.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label>CRM</Label>
                <Select
                  value={brokerId || NONE}
                  onValueChange={(v) => setBrokerId(v === NONE ? "" : v)}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Unassigned" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value={NONE}>— unassigned —</SelectItem>
                    {brokers.map((b) => (
                      <SelectItem key={b.id} value={b.id}>
                        {b.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
          </fieldset>

          {/* ---- Person ---- */}
          <div className="grid grid-cols-6 gap-3">
            <div className="col-span-1 space-y-1.5">
              <Label>Title</Label>
              <Input name="title" placeholder="Mr" />
            </div>
            <div className="col-span-2 space-y-1.5">
              <Label>First name *</Label>
              <Input name="firstName" autoFocus />
              {err("firstName")}
            </div>
            <div className="col-span-3 space-y-1.5">
              <Label>Last name *</Label>
              <Input
                name="lastName"
                onBlur={(e) => {
                  const form = e.currentTarget.form;
                  if (!form) return;
                  const fd = new FormData(form);
                  void checkDup({
                    firstName: String(fd.get("firstName") ?? ""),
                    lastName: e.target.value,
                    dateOfBirth: String(fd.get("dateOfBirth") ?? ""),
                  });
                }}
              />
              {err("lastName")}
            </div>
          </div>

          <div className="grid grid-cols-3 gap-3">
            <div className="space-y-1.5">
              <Label>Date of birth *</Label>
              <Input
                name="dateOfBirth"
                type="date"
                onChange={(e) => {
                  const a = ageFromDob(e.target.value);
                  const el = document.getElementById("age-hint");
                  if (el) el.textContent = a !== null ? `Age ${a}` : "";
                }}
              />
              <p id="age-hint" className="text-xs text-muted-foreground" />
              {err("dateOfBirth")}
            </div>
            <div className="space-y-1.5">
              <Label>Location *</Label>
              <Input name="countryOfResidence" placeholder="ISO-2, e.g. TH" maxLength={2} />
              {err("countryOfResidence")}
            </div>
            <div className="space-y-1.5">
              <Label>Nationality</Label>
              <Input name="nationality" placeholder="ISO-2, e.g. GB" maxLength={2} />
            </div>
          </div>

          {/* ---- Contact ---- */}
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label>Email</Label>
              <Input
                name="email"
                type="email"
                onBlur={(e) => e.target.value && void checkDup({ email: e.target.value })}
              />
              {err("email")}
            </div>
            <div className="space-y-1.5">
              <Label>Phone</Label>
              <Input
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                onBlur={(e) => e.target.value && void checkDup({ phone: e.target.value })}
                placeholder="+66…"
              />
            </div>
          </div>

          <div className="space-y-1.5">
            <label className="flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                checked={sameWhatsapp}
                onChange={(e) => setSameWhatsapp(e.target.checked)}
              />
              WhatsApp is the same as the contact number
            </label>
            {!sameWhatsapp && (
              <Input
                value={whatsapp}
                onChange={(e) => setWhatsapp(e.target.value)}
                onBlur={(e) => e.target.value && void checkDup({ whatsapp: e.target.value })}
                placeholder="WhatsApp number"
              />
            )}
          </div>

          {dups.length > 0 && (
            <div className="rounded-md border border-amber-500/40 bg-amber-500/10 p-2 text-xs">
              <p className="font-medium text-amber-700 dark:text-amber-400">
                Possible duplicate{dups.length > 1 ? "s" : ""} found
              </p>
              <ul className="mt-1 space-y-0.5">
                {dups.map((d) => (
                  <li key={d.id} className="text-muted-foreground">
                    {d.lead_code} — {d.customer_name} · {d.affiliate_name}{" "}
                    <span className="italic">({d.match_reason})</span>
                  </li>
                ))}
              </ul>
              <p className="mt-1 text-muted-foreground">
                You can still create this lead — the same person may legitimately come from a
                different source, and nothing is merged automatically.
              </p>
            </div>
          )}

          {/* ---- Product + status ---- */}
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label>Product *</Label>
              <div className="flex flex-wrap gap-2">
                {products.map((p) => (
                  <label
                    key={p.id}
                    className="flex cursor-pointer items-center gap-1.5 rounded-md border px-2 py-1 text-sm has-[:checked]:border-primary has-[:checked]:bg-primary/5"
                  >
                    <input
                      type="checkbox"
                      checked={productIds.includes(p.id)}
                      onChange={() => toggleProduct(p.id)}
                    />
                    {p.label}
                  </label>
                ))}
              </div>
              {err("productIds")}
            </div>
            <div className="space-y-1.5">
              <Label>Qualification</Label>
              <Select
                value={qualification}
                onValueChange={(v) => setQualification(v as "pending" | "qualified")}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="pending">Pending Qualification</SelectItem>
                  <SelectItem value="qualified">Qualified (enter pipeline)</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="space-y-1.5">
            <Label>Initial note</Label>
            <Textarea name="note" rows={2} />
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setOpen(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={pending}>
              {pending ? "Creating…" : "Create lead"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
