"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { AlertTriangle } from "lucide-react";
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from "@/components/ui/select";
import { setUserRole, setUserRm, linkSourceLogin } from "@/lib/actions/admin";
import { ROLE_LABEL, ASSIGNABLE_ROLES, type Role } from "@/lib/domain/permissions";
import type { Option } from "@/lib/types";

const NONE = "__none__";

export interface TeamMember {
  id: string;
  full_name: string;
  email: string;
  role: Role;
  is_rm: boolean;
  /** Source (affiliate) this login is linked to, if any. */
  linkedSourceId: string | null;
  /** CRM (broker) record this login is linked to, if any. */
  linkedCrmName: string | null;
}

export function TeamTable({
  members,
  currentUserId,
  sources,
}: {
  members: TeamMember[];
  currentUserId: string;
  sources: Option[];
}) {
  const router = useRouter();
  const [pending, start] = useTransition();

  function changeRole(id: string, role: Role) {
    start(async () => {
      const res = await setUserRole(id, role);
      if (res.ok) {
        toast.success("Role updated");
        router.refresh();
      } else toast.error(res.error);
    });
  }

  function changeSource(userId: string, affiliateId: string | null) {
    start(async () => {
      // Unlinking needs the affiliate that is currently linked to this user.
      const current = members.find((m) => m.id === userId)?.linkedSourceId ?? null;
      const res = affiliateId
        ? await linkSourceLogin(affiliateId, userId)
        : current
          ? await linkSourceLogin(current, null)
          : { ok: true as const, data: undefined };
      if (res.ok) {
        toast.success(affiliateId ? "Source linked" : "Source unlinked");
        router.refresh();
      } else toast.error(res.error);
    });
  }

  function toggleRm(id: string, isRm: boolean) {
    start(async () => {
      const res = await setUserRm(id, isRm);
      if (res.ok) router.refresh();
      else toast.error(res.error);
    });
  }

  return (
    <div className="overflow-x-auto rounded-lg border">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b bg-muted/40 text-left text-xs text-muted-foreground">
            <th className="px-3 py-2 font-medium">Name</th>
            <th className="px-3 py-2 font-medium">Email</th>
            <th className="px-3 py-2 font-medium">Role</th>
            <th className="px-3 py-2 font-medium">Assigned to</th>
            <th className="px-3 py-2 font-medium">Is CRM</th>
          </tr>
        </thead>
        <tbody>
          {members.map((m) => (
            <tr key={m.id} className="border-b align-top">
              <td className="px-3 py-2 font-medium">
                {m.full_name}
                {m.id === currentUserId && (
                  <span className="ml-1 text-xs text-muted-foreground">(you)</span>
                )}
              </td>
              <td className="px-3 py-2 text-muted-foreground">{m.email}</td>
              <td className="px-3 py-2">
                <Select
                  value={m.role}
                  onValueChange={(v) => changeRole(m.id, v as Role)}
                  disabled={pending}
                >
                  <SelectTrigger className="h-8 w-48">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {ASSIGNABLE_ROLES.map((r) => (
                      <SelectItem key={r} value={r}>
                        {ROLE_LABEL[r]}
                      </SelectItem>
                    ))}
                    {/* Deprecated roles stay selectable-as-current so the row renders. */}
                    {!ASSIGNABLE_ROLES.includes(m.role) && (
                      <SelectItem value={m.role}>{ROLE_LABEL[m.role]}</SelectItem>
                    )}
                  </SelectContent>
                </Select>
              </td>

              {/* Which Source / CRM record this login is scoped to */}
              <td className="px-3 py-2">
                {m.role === "source" ? (
                  <div className="space-y-1">
                    <Select
                      value={m.linkedSourceId ?? NONE}
                      onValueChange={(v) => changeSource(m.id, v === NONE ? null : v)}
                      disabled={pending}
                    >
                      <SelectTrigger className="h-8 w-56">
                        <SelectValue placeholder="Select a source…" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value={NONE}>Not linked</SelectItem>
                        {sources.map((s) => (
                          <SelectItem key={s.id} value={s.id}>
                            {s.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    {!m.linkedSourceId && (
                      <p className="flex items-center gap-1 text-xs text-status-pending">
                        <AlertTriangle className="h-3 w-3" /> Not linked — sees no data
                      </p>
                    )}
                  </div>
                ) : m.role === "rm_staff" ? (
                  m.linkedCrmName ? (
                    <span className="text-muted-foreground">{m.linkedCrmName}</span>
                  ) : (
                    <p className="flex items-center gap-1 text-xs text-status-pending">
                      <AlertTriangle className="h-3 w-3" /> No CRM record — sees no leads
                    </p>
                  )
                ) : (
                  <span className="text-xs text-muted-foreground">All data</span>
                )}
              </td>

              <td className="px-3 py-2">
                <input
                  type="checkbox"
                  checked={m.is_rm}
                  onChange={(e) => toggleRm(m.id, e.target.checked)}
                  aria-label="Is CRM"
                />
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
