"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from "@/components/ui/select";
import { setUserRole, setUserRm } from "@/lib/actions/admin";
import { ROLE_LABEL, type Role } from "@/lib/domain/permissions";
import { Constants } from "@/types/database";

const USER_ROLES = Constants.public.Enums.user_role;

export interface TeamMember { id: string; full_name: string; email: string; role: Role; is_rm: boolean }

export function TeamTable({ members, currentUserId }: { members: TeamMember[]; currentUserId: string }) {
  const router = useRouter();
  const [, start] = useTransition();

  function changeRole(id: string, role: Role) {
    start(async () => {
      const res = await setUserRole(id, role);
      if (res.ok) { toast.success("Role updated"); router.refresh(); } else toast.error(res.error);
    });
  }
  function toggleRm(id: string, isRm: boolean) {
    start(async () => {
      const res = await setUserRm(id, isRm);
      if (res.ok) router.refresh(); else toast.error(res.error);
    });
  }

  return (
    <div className="overflow-x-auto rounded-lg border">
      <table className="w-full text-sm">
        <thead><tr className="border-b bg-muted/40 text-left text-xs text-muted-foreground">
          <th className="px-3 py-2 font-medium">Name</th><th className="px-3 py-2 font-medium">Email</th>
          <th className="px-3 py-2 font-medium">Role</th><th className="px-3 py-2 font-medium">Is RM</th>
        </tr></thead>
        <tbody>
          {members.map((m) => (
            <tr key={m.id} className="border-b">
              <td className="px-3 py-2 font-medium">{m.full_name}{m.id === currentUserId && <span className="ml-1 text-xs text-muted-foreground">(you)</span>}</td>
              <td className="px-3 py-2 text-muted-foreground">{m.email}</td>
              <td className="px-3 py-2">
                <Select value={m.role} onValueChange={(v) => changeRole(m.id, v as Role)}>
                  <SelectTrigger className="h-8 w-48"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {USER_ROLES.map((r) => <SelectItem key={r} value={r}>{ROLE_LABEL[r]}</SelectItem>)}
                  </SelectContent>
                </Select>
              </td>
              <td className="px-3 py-2">
                <input type="checkbox" checked={m.is_rm} onChange={(e) => toggleRm(m.id, e.target.checked)} aria-label="Is RM" />
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
