"use client";

import { useRouter, usePathname, useSearchParams } from "next/navigation";
import { PERIODS, type Period } from "@/lib/domain/period";
import { cn } from "@/lib/utils";

// YTD / Monthly / Weekly switch. Persists the choice in the URL so the whole
// server-rendered dashboard re-queries for that period.
export function PeriodToggle({ current }: { current: Period }) {
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();

  function set(p: Period) {
    const sp = new URLSearchParams(params.toString());
    sp.set("period", p);
    router.push(`${pathname}?${sp.toString()}`);
  }

  return (
    <div className="inline-flex items-center rounded-md border p-0.5 text-xs">
      {PERIODS.map((p) => (
        <button
          key={p.value}
          onClick={() => set(p.value)}
          aria-pressed={current === p.value}
          className={cn(
            "rounded px-2.5 py-1 transition-colors",
            current === p.value ? "bg-secondary font-medium text-foreground" : "text-muted-foreground hover:text-foreground",
          )}
        >
          {p.label}
        </button>
      ))}
    </div>
  );
}
