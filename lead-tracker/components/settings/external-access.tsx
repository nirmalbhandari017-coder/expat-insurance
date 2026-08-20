"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from "@/components/ui/select";
import { linkSourceLogin, linkCrmLogin } from "@/lib/actions/admin";

export interface EntityRow {
  id: string;
  name: string;
  linkedUserId: string | null;
}
export interface UserOption {
  id: string;
  label: string;
}

const NONE = "__none__";

export function ExternalAccess({
  sources,
  crms,
  users,
}: {
  sources: EntityRow[];
  crms: EntityRow[];
  users: UserOption[];
}) {
  const router = useRouter();
  const [pending, start] = useTransition();

  function link(kind: "source" | "crm", entityId: string, userId: string | null) {
    start(async () => {
      const res = kind === "source" ? await linkSourceLogin(entityId, userId) : await linkCrmLogin(entityId, userId);
      if (res.ok) {
        toast.success(userId ? "Login linked" : "Login unlinked");
        router.refresh();
      } else toast.error(res.error);
    });
  }

  const table = (kind: "source" | "crm", rows: EntityRow[], colLabel: string) => (
    <div className="overflow-x-auto rounded-lg border">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b bg-muted/40 text-left text-xs text-muted-foreground">
            <th className="px-3 py-2 font-medium">{colLabel}</th>
            <th className="px-3 py-2 font-medium">Linked login</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => (
            <tr key={r.id} className="border-b">
              <td className="px-3 py-2 font-medium">{r.name}</td>
              <td className="px-3 py-2">
                <Select
                  value={r.linkedUserId ?? NONE}
                  onValueChange={(v) => link(kind, r.id, v === NONE ? null : v)}
                  disabled={pending}
                >
                  <SelectTrigger className="h-8 w-72"><SelectValue placeholder="Not linked" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value={NONE}>Not linked</SelectItem>
                    {users.map((u) => <SelectItem key={u.id} value={u.id}>{u.label}</SelectItem>)}
                  </SelectContent>
                </Select>
              </td>
            </tr>
          ))}
          {rows.length === 0 && (
            <tr><td colSpan={2} className="px-3 py-6 text-center text-muted-foreground">None yet.</td></tr>
          )}
        </tbody>
      </table>
    </div>
  );

  return (
    <div className="space-y-4">
      <p className="rounded-md border border-status-pending/30 bg-status-pending/5 px-3 py-2 text-xs text-muted-foreground">
        The person must <b>sign up</b> first (they start with no access), then link their login here.
        Linking sets their role and scopes them to only that Source&apos;s / CRM&apos;s leads.
      </p>

      <div>
        <h3 className="text-sm font-medium">Sources (external partners)</h3>
        <p className="text-xs text-muted-foreground">
          A linked login becomes a Source user — sees only that source&apos;s leads.
        </p>
      </div>
      {table("source", sources, "Source")}

      <div className="pt-1">
        <h3 className="text-sm font-medium">CRMs (internal staff)</h3>
        <p className="text-xs text-muted-foreground">
          Links a CRM record to their login so they see the leads assigned to them.
        </p>
      </div>
      {table("crm", crms, "CRM")}
    </div>
  );
}
