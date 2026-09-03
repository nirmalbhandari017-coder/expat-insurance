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
import { createBroker, updateBroker } from "@/lib/actions/brokers";
import type { Option } from "@/lib/types";

const NONE = "__none__";

export interface BrokerRow {
  id: string;
  first_name: string;
  last_name: string;
  full_name: string | null;
  company: string | null;
  email: string | null;
  phone: string | null;
  notes: string | null;
  app_user_id: string | null;
  is_active: boolean;
}
export interface BrokerStat {
  broker_id: string | null;
  active_leads: number | null;
  n_quotes: number | null;
  n_applications: number | null;
  n_policies: number | null;
  n_renewals: number | null;
  n_lost: number | null;
  total_leads: number | null;
}

export function BrokersTable({
  brokers,
  stats,
  appUsers,
  canManage,
}: {
  brokers: BrokerRow[];
  stats: BrokerStat[];
  appUsers: Option[];
  canManage: boolean;
}) {
  const [editing, setEditing] = useState<BrokerRow | "new" | null>(null);
  const statById = new Map(stats.map((s) => [s.broker_id, s]));

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-semibold tracking-tight">CRMs</h1>
          <p className="text-xs text-muted-foreground">
            The people handling leads. Link one to a login account to scope their view to their own
            leads.
          </p>
        </div>
        {canManage && (
          <Button size="sm" onClick={() => setEditing("new")}>
            <Plus className="h-4 w-4" /> New CRM
          </Button>
        )}
      </div>

      <div className="overflow-x-auto rounded-lg border">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b bg-muted/40 text-left text-xs text-muted-foreground">
              <th className="px-3 py-2 font-medium">Name</th>
              <th className="px-3 py-2 font-medium">Active leads</th>
              <th className="px-3 py-2 font-medium">Quotes</th>
              <th className="px-3 py-2 font-medium">Applications</th>
              <th className="px-3 py-2 font-medium">Policies</th>
              <th className="px-3 py-2 font-medium">Renewals</th>
              <th className="px-3 py-2 font-medium">Squander</th>
              <th className="px-3 py-2 font-medium">Login</th>
              <th className="px-3 py-2 font-medium">Status</th>
              {canManage && <th className="w-8 px-3 py-2" />}
            </tr>
          </thead>
          <tbody>
            {brokers.map((b) => {
              const s = statById.get(b.id);
              return (
                <tr key={b.id} className="border-b hover:bg-muted/30">
                  <td className="px-3 py-2">
                    <Link
                      href={`/pipeline?broker=${b.id}`}
                      className="font-medium hover:underline"
                      title="See this CRM's leads"
                    >
                      {b.full_name ?? `${b.first_name} ${b.last_name}`}
                    </Link>
                    {b.email && (
                      <div className="text-xs text-muted-foreground">{b.email}</div>
                    )}
                  </td>
                  <td className="tabular px-3 py-2">{s?.active_leads ?? 0}</td>
                  <td className="tabular px-3 py-2">{s?.n_quotes ?? 0}</td>
                  <td className="tabular px-3 py-2">{s?.n_applications ?? 0}</td>
                  <td className="tabular px-3 py-2">{s?.n_policies ?? 0}</td>
                  <td className="tabular px-3 py-2">{s?.n_renewals ?? 0}</td>
                  <td className="tabular px-3 py-2">{s?.n_lost ?? 0}</td>
                  <td className="px-3 py-2 text-xs text-muted-foreground">
                    {b.app_user_id ? "Linked" : "—"}
                  </td>
                  <td className="px-3 py-2">
                    <span className={b.is_active ? "text-status-open" : "text-muted-foreground"}>
                      {b.is_active ? "Active" : "Inactive"}
                    </span>
                  </td>
                  {canManage && (
                    <td className="px-3 py-2">
                      <Button variant="ghost" size="icon-sm" onClick={() => setEditing(b)}>
                        <Pencil className="h-3.5 w-3.5" />
                      </Button>
                    </td>
                  )}
                </tr>
              );
            })}
            {brokers.length === 0 && (
              <tr>
                <td colSpan={10} className="px-3 py-10 text-center text-sm text-muted-foreground">
                  No CRMs yet.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {editing && (
        <BrokerDialog
          value={editing === "new" ? null : editing}
          appUsers={appUsers}
          onClose={() => setEditing(null)}
        />
      )}
    </div>
  );
}

function BrokerDialog({
  value,
  appUsers,
  onClose,
}: {
  value: BrokerRow | null;
  appUsers: Option[];
  onClose: () => void;
}) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [errors, setErrors] = useState<Record<string, string[]>>({});
  const [appUserId, setAppUserId] = useState(value?.app_user_id ?? "");
  const [isActive, setIsActive] = useState(value?.is_active ?? true);

  function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    const input = {
      firstName: String(fd.get("firstName") ?? ""),
      lastName: String(fd.get("lastName") ?? ""),
      email: String(fd.get("email") ?? ""),
      phone: String(fd.get("phone") ?? ""),
      notes: String(fd.get("notes") ?? ""),
      appUserId: appUserId || null,
      isActive,
    };
    start(async () => {
      const res = value ? await updateBroker({ ...input, id: value.id }) : await createBroker(input);
      if (res.ok) {
        toast.success(value ? "CRM updated" : "CRM created");
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
          <DialogTitle>{value ? "Edit CRM" : "New CRM"}</DialogTitle>
        </DialogHeader>
        <form onSubmit={onSubmit} className="space-y-3">
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
          </div>
          <div className="grid grid-cols-2 gap-3">
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
            <Label>Linked login account</Label>
            <Select
              value={appUserId || NONE}
              onValueChange={(v) => setAppUserId(v === NONE ? "" : v)}
            >
              <SelectTrigger>
                <SelectValue placeholder="Not linked" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={NONE}>— not linked —</SelectItem>
                {appUsers.map((u) => (
                  <SelectItem key={u.id} value={u.id}>
                    {u.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <p className="text-xs text-muted-foreground">
              Only needed if this CRM signs in. Linking is what scopes their staff account to its
              own leads.
            </p>
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
