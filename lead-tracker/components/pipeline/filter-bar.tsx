"use client";

import { useEffect, useState } from "react";
import { useRouter, usePathname } from "next/navigation";
import { Search, X, ListFilter } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from "@/components/ui/select";
import { DropdownMenu, DropdownMenuTrigger, DropdownMenuContent, DropdownMenuCheckboxItem, DropdownMenuLabel, DropdownMenuSeparator } from "@/components/ui/dropdown-menu";
import { StatusDot } from "@/components/leads/status-badge";
import { PIPELINE_STATUSES, STATUS_LABEL, type LeadStatus } from "@/lib/domain/pipeline";
import { serializeFilters, countActiveFilters, type LeadFilters } from "@/lib/filters";
import type { Option } from "@/lib/types";

const ALL = "__all__";

export function FilterBar({
  filters,
  affiliates,
  rms,
}: {
  filters: LeadFilters;
  affiliates: Option[];
  rms: Option[];
}) {
  const router = useRouter();
  const pathname = usePathname();
  const [q, setQ] = useState(filters.q ?? "");

  // Debounced search -> URL.
  useEffect(() => {
    const t = setTimeout(() => {
      if ((filters.q ?? "") !== q) apply({ ...filters, q: q || undefined });
    }, 200);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [q]);

  function apply(next: LeadFilters) {
    const qs = serializeFilters(next);
    router.push(qs ? `${pathname}?${qs}` : pathname);
  }

  function toggleStatus(s: LeadStatus) {
    const set = new Set(filters.status ?? []);
    if (set.has(s)) set.delete(s);
    else set.add(s);
    apply({ ...filters, status: set.size ? Array.from(set) : undefined });
  }

  const active = countActiveFilters(filters);

  return (
    <div className="flex flex-wrap items-center gap-2">
      <div className="relative">
        <Search className="pointer-events-none absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search name, email, phone, policy…" className="h-8 w-64 pl-8" />
      </div>

      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="outline" size="sm">
            <ListFilter className="h-4 w-4" />
            Status{filters.status?.length ? ` (${filters.status.length})` : ""}
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent className="w-52">
          <DropdownMenuLabel>Filter by status</DropdownMenuLabel>
          <DropdownMenuSeparator />
          {PIPELINE_STATUSES.map((s) => (
            <DropdownMenuCheckboxItem key={s} checked={filters.status?.includes(s) ?? false} onSelect={(e) => { e.preventDefault(); toggleStatus(s); }}>
              <span className="flex items-center gap-2"><StatusDot status={s} />{STATUS_LABEL[s]}</span>
            </DropdownMenuCheckboxItem>
          ))}
        </DropdownMenuContent>
      </DropdownMenu>

      <Select value={filters.affiliate ?? ALL} onValueChange={(v) => apply({ ...filters, affiliate: v === ALL ? undefined : v })}>
        <SelectTrigger className="h-8 w-44"><SelectValue placeholder="Affiliate" /></SelectTrigger>
        <SelectContent>
          <SelectItem value={ALL}>All affiliates</SelectItem>
          {affiliates.map((a) => <SelectItem key={a.id} value={a.id}>{a.label}</SelectItem>)}
        </SelectContent>
      </Select>

      <Select value={filters.rm ?? ALL} onValueChange={(v) => apply({ ...filters, rm: v === ALL ? undefined : v })}>
        <SelectTrigger className="h-8 w-40"><SelectValue placeholder="RM" /></SelectTrigger>
        <SelectContent>
          <SelectItem value={ALL}>All RMs</SelectItem>
          {rms.map((r) => <SelectItem key={r.id} value={r.id}>{r.label}</SelectItem>)}
        </SelectContent>
      </Select>

      {active > 0 && (
        <Button variant="ghost" size="sm" onClick={() => { setQ(""); router.push(pathname); }}>
          <X className="h-4 w-4" /> Clear ({active})
        </Button>
      )}
    </div>
  );
}
