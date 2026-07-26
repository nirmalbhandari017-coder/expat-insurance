"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Plus, Pencil } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
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
import { createGenerator, updateGenerator } from "@/lib/actions/generators";
import { formatPct } from "@/lib/domain/conversion";
import type { Option } from "@/lib/types";

export interface GeneratorRow {
  id: string;
  first_name: string;
  last_name: string;
  full_name: string | null;
  affiliate_id: string;
  email: string | null;
  phone: string | null;
  notes: string | null;
  is_active: boolean;
}
export interface GeneratorStat {
  generator_id: string | null;
  total_leads: number | null;
  n_qualified: number | null;
  n_policies: number | null;
  n_lost: number | null;
  conversion_rate: number | null;
}

export function GeneratorsTable({
  generators,
  stats,
  affiliates,
  canManage,
}: {
  generators: GeneratorRow[];
  stats: GeneratorStat[];
  affiliates: Option[];
  canManage: boolean;
}) {
  const [editing, setEditing] = useState<GeneratorRow | "new" | null>(null);
  const [affiliateFilter, setAffiliateFilter] = useState("__all__");

  const statById = new Map(stats.map((s) => [s.generator_id, s]));
  const affById = new Map(affiliates.map((a) => [a.id, a.label]));
  const shown =
    affiliateFilter === "__all__"
      ? generators
      : generators.filter((g) => g.affiliate_id === affiliateFilter);

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-semibold tracking-tight">Generators</h1>
          <p className="text-xs text-muted-foreground">
            The individual people who bring in leads, each belonging to one source.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Select value={affiliateFilter} onValueChange={setAffiliateFilter}>
            <SelectTrigger className="h-8 w-48">
              <SelectValue placeholder="Source" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="__all__">All sources</SelectItem>
              {affiliates.map((a) => (
                <SelectItem key={a.id} value={a.id}>
                  {a.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          {canManage && (
            <Button size="sm" onClick={() => setEditing("new")}>
              <Plus className="h-4 w-4" /> New generator
            </Button>
          )}
        </div>
      </div>

      <div className="overflow-x-auto rounded-lg border">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b bg-muted/40 text-left text-xs text-muted-foreground">
              <th className="px-3 py-2 font-medium">Name</th>
              <th className="px-3 py-2 font-medium">Source</th>
              <th className="px-3 py-2 font-medium">Contact</th>
              <th className="px-3 py-2 font-medium">Leads</th>
              <th className="px-3 py-2 font-medium">Qualified</th>
              <th className="px-3 py-2 font-medium">Policies</th>
              <th className="px-3 py-2 font-medium">Lost</th>
              <th className="px-3 py-2 font-medium">Conversion</th>
              <th className="px-3 py-2 font-medium">Status</th>
              {canManage && <th className="w-8 px-3 py-2" />}
            </tr>
          </thead>
          <tbody>
            {shown.map((g) => {
              const s = statById.get(g.id);
              return (
                <tr key={g.id} className="border-b hover:bg-muted/30">
                  <td className="px-3 py-2">
                    <Link
                      href={`/pipeline?generator=${g.id}`}
                      className="font-medium hover:underline"
                      title="See this generator's leads"
                    >
                      {g.full_name ?? `${g.first_name} ${g.last_name}`}
                    </Link>
                  </td>
                  <td className="px-3 py-2">
                    <Link
                      href={`/affiliates/${g.affiliate_id}`}
                      className="text-muted-foreground hover:underline"
                    >
                      {affById.get(g.affiliate_id) ?? "—"}
                    </Link>
                  </td>
                  <td className="px-3 py-2 text-xs text-muted-foreground">
                    {g.email ?? "—"}
                    {g.phone && <div>{g.phone}</div>}
                  </td>
                  <td className="tabular px-3 py-2">{s?.total_leads ?? 0}</td>
                  <td className="tabular px-3 py-2">{s?.n_qualified ?? 0}</td>
                  <td className="tabular px-3 py-2">{s?.n_policies ?? 0}</td>
                  <td className="tabular px-3 py-2">{s?.n_lost ?? 0}</td>
                  <td className="tabular px-3 py-2">{formatPct(s?.conversion_rate ?? null)}</td>
                  <td className="px-3 py-2">
                    <span className={g.is_active ? "text-status-open" : "text-muted-foreground"}>
                      {g.is_active ? "Active" : "Inactive"}
                    </span>
                  </td>
                  {canManage && (
                    <td className="px-3 py-2">
                      <Button variant="ghost" size="icon-sm" onClick={() => setEditing(g)}>
                        <Pencil className="h-3.5 w-3.5" />
                      </Button>
                    </td>
                  )}
                </tr>
              );
            })}
            {shown.length === 0 && (
              <tr>
                <td colSpan={10} className="px-3 py-10 text-center text-sm text-muted-foreground">
                  No generators yet.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {editing && (
        <GeneratorDialog
          value={editing === "new" ? null : editing}
          affiliates={affiliates}
          onClose={() => setEditing(null)}
        />
      )}
    </div>
  );
}

function GeneratorDialog({
  value,
  affiliates,
  onClose,
}: {
  value: GeneratorRow | null;
  affiliates: Option[];
  onClose: () => void;
}) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [errors, setErrors] = useState<Record<string, string[]>>({});
  const [affiliateId, setAffiliateId] = useState(value?.affiliate_id ?? "");
  const [isActive, setIsActive] = useState(value?.is_active ?? true);

  function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    const input = {
      firstName: String(fd.get("firstName") ?? ""),
      lastName: String(fd.get("lastName") ?? ""),
      affiliateId,
      email: String(fd.get("email") ?? ""),
      phone: String(fd.get("phone") ?? ""),
      notes: String(fd.get("notes") ?? ""),
      isActive,
    };
    start(async () => {
      const res = value
        ? await updateGenerator({ ...input, id: value.id })
        : await createGenerator(input);
      if (res.ok) {
        toast.success(value ? "Generator updated" : "Generator created");
        onClose();
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
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>{value ? "Edit generator" : "New generator"}</DialogTitle>
        </DialogHeader>
        <form onSubmit={onSubmit} className="space-y-3">
          <div className="space-y-1.5">
            <Label>Source *</Label>
            <Select value={affiliateId} onValueChange={setAffiliateId}>
              <SelectTrigger>
                <SelectValue placeholder="Which source do they work with?" />
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
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label>First name *</Label>
              <Input name="firstName" defaultValue={value?.first_name ?? ""} autoFocus />
              {err("firstName")}
            </div>
            <div className="space-y-1.5">
              <Label>Last name *</Label>
              <Input name="lastName" defaultValue={value?.last_name ?? ""} />
              {err("lastName")}
            </div>
            <div className="space-y-1.5">
              <Label>Email</Label>
              <Input name="email" type="email" defaultValue={value?.email ?? ""} />
              {err("email")}
            </div>
            <div className="space-y-1.5">
              <Label>Phone</Label>
              <Input name="phone" defaultValue={value?.phone ?? ""} />
            </div>
          </div>
          <div className="space-y-1.5">
            <Label>Notes</Label>
            <Textarea name="notes" defaultValue={value?.notes ?? ""} rows={2} />
          </div>
          <label className="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              checked={isActive}
              onChange={(e) => setIsActive(e.target.checked)}
            />
            Active
          </label>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={onClose}>
              Cancel
            </Button>
            <Button type="submit" disabled={pending}>
              {pending ? "Saving…" : "Save"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
