"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { updateNotificationRule } from "@/lib/actions/admin";

export interface Rule {
  id: string; rule_key: string; name: string; threshold_days: number | null;
  is_active: boolean; notify_assigned_rm: boolean;
}

export function RulesTable({ rules }: { rules: Rule[] }) {
  const router = useRouter();
  const [, start] = useTransition();
  const [drafts, setDrafts] = useState<Record<string, string>>(
    Object.fromEntries(rules.map((r) => [r.id, r.threshold_days?.toString() ?? ""])),
  );

  function save(id: string, patch: Parameters<typeof updateNotificationRule>[1]) {
    start(async () => {
      const res = await updateNotificationRule(id, patch);
      if (res.ok) { toast.success("Rule updated"); router.refresh(); } else toast.error(res.error);
    });
  }

  return (
    <div className="overflow-x-auto rounded-lg border">
      <table className="w-full text-sm">
        <thead><tr className="border-b bg-muted/40 text-left text-xs text-muted-foreground">
          <th className="px-3 py-2 font-medium">Rule</th>
          <th className="px-3 py-2 font-medium">Threshold (days)</th>
          <th className="px-3 py-2 font-medium">Notify RM</th>
          <th className="px-3 py-2 font-medium">Active</th>
          <th className="px-3 py-2" />
        </tr></thead>
        <tbody>
          {rules.map((r) => (
            <tr key={r.id} className="border-b">
              <td className="px-3 py-2"><div className="font-medium">{r.name}</div><div className="text-xs text-muted-foreground">{r.rule_key}</div></td>
              <td className="px-3 py-2">
                {r.threshold_days === null && r.rule_key === "new_lead" ? (
                  <span className="text-xs text-muted-foreground">event-driven</span>
                ) : (
                  <Input
                    type="number" min={1} className="h-8 w-24"
                    value={drafts[r.id] ?? ""}
                    onChange={(e) => setDrafts((d) => ({ ...d, [r.id]: e.target.value }))}
                  />
                )}
              </td>
              <td className="px-3 py-2">
                <input type="checkbox" checked={r.notify_assigned_rm} onChange={(e) => save(r.id, { notify_assigned_rm: e.target.checked })} aria-label="Notify RM" />
              </td>
              <td className="px-3 py-2">
                <input type="checkbox" checked={r.is_active} onChange={(e) => save(r.id, { is_active: e.target.checked })} aria-label="Active" />
              </td>
              <td className="px-3 py-2">
                {r.threshold_days !== null && (
                  <Button size="sm" variant="outline" onClick={() => save(r.id, { threshold_days: drafts[r.id] ? Number(drafts[r.id]) : null })}>
                    Save
                  </Button>
                )}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
