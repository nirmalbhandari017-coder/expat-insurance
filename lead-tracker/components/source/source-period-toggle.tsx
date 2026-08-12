"use client";

import { useRouter, usePathname, useSearchParams } from "next/navigation";
import type { SourceMode } from "@/lib/domain/source-period";
import { cn } from "@/lib/utils";

const OPTIONS: { value: SourceMode; label: string }[] = [
  { value: "this_month", label: "This month" },
  { value: "prev_month", label: "Previous month" },
];

export function SourcePeriodToggle({ current }: { current: SourceMode }) {
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();

  function set(m: SourceMode) {
    const sp = new URLSearchParams(params.toString());
    sp.set("mode", m);
    sp.delete("from");
    sp.delete("to");
    router.push(`${pathname}?${sp.toString()}`);
  }

  return (
    <div className="inline-flex items-center rounded-md border p-0.5 text-xs">
      {OPTIONS.map((o) => (
        <button
          key={o.value}
          onClick={() => set(o.value)}
          aria-pressed={current === o.value}
          className={cn(
            "rounded px-2.5 py-1 transition-colors",
            current === o.value ? "bg-secondary font-medium text-foreground" : "text-muted-foreground hover:text-foreground",
          )}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}
