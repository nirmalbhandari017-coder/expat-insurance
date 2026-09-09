"use client";

import { useEffect, useState } from "react";
import { useRouter, usePathname } from "next/navigation";
import { Search, X, ListFilter } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectTrigger,
  SelectValue,
  SelectContent,
  SelectItem,
} from "@/components/ui/select";
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuCheckboxItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
} from "@/components/ui/dropdown-menu";
import { StageDot } from "@/components/leads/status-badge";
import {
  PIPELINE_STAGES,
  STAGE_LABEL,
  QUALIFICATION_LABEL,
  type PipelineStage,
  type QualificationStatus,
} from "@/lib/domain/pipeline";
import { serializeFilters, countActiveFilters, type LeadFilters } from "@/lib/filters";
import type { Option } from "@/lib/types";

const ALL = "__all__";
const QUALIFICATIONS: QualificationStatus[] = ["pending", "qualified", "not_qualified"];

export function FilterBar({
  filters,
  affiliates,
  brokers,
  products,
}: {
  filters: LeadFilters;
  affiliates: Option[];
  brokers: Option[];
  products: Option[];
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

  function toggleStage(s: PipelineStage) {
    const set = new Set(filters.stage ?? []);
    if (set.has(s)) set.delete(s);
    else set.add(s);
    apply({ ...filters, stage: set.size ? Array.from(set) : undefined });
  }

  function toggleQualification(s: QualificationStatus) {
    const set = new Set(filters.qualification ?? []);
    if (set.has(s)) set.delete(s);
    else set.add(s);
    apply({ ...filters, qualification: set.size ? Array.from(set) : undefined });
  }

  const active = countActiveFilters(filters);
  // Everything selected inside the Stage menu, so an active Squander filter
  // isn't invisible when no stage is picked.
  const stageMenuCount =
    (filters.stage?.length ?? 0) +
    (filters.qualification?.length ?? 0) +
    (filters.opportunity === "lost" ? 1 : 0);

  return (
    <div className="flex flex-wrap items-center gap-2">
      <div className="relative">
        <Search className="pointer-events-none absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Search name, email, phone, WhatsApp…"
          className="h-8 w-64 pl-8"
        />
      </div>

      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="outline" size="sm">
            <ListFilter className="h-4 w-4" />
            Stage{stageMenuCount ? ` (${stageMenuCount})` : ""}
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent className="w-56">
          <DropdownMenuLabel>Pipeline stage</DropdownMenuLabel>
          <DropdownMenuSeparator />
          {PIPELINE_STAGES.map((s) => (
            <DropdownMenuCheckboxItem
              key={s}
              checked={filters.stage?.includes(s) ?? false}
              onSelect={(e) => {
                e.preventDefault();
                toggleStage(s);
              }}
            >
              <span className="flex items-center gap-2">
                <StageDot stage={s} />
                {STAGE_LABEL[s]}
              </span>
            </DropdownMenuCheckboxItem>
          ))}
          {/* Squander sits with the stages because it is the board's final
              column, but it is an outcome — so it drives `opportunity`. */}
          <DropdownMenuCheckboxItem
            checked={filters.opportunity === "lost"}
            onSelect={(e) => {
              e.preventDefault();
              apply({
                ...filters,
                opportunity: filters.opportunity === "lost" ? undefined : "lost",
              });
            }}
          >
            <span className="flex items-center gap-2">
              <span className="h-2 w-2 rounded-full bg-red-500" />
              Squander
            </span>
          </DropdownMenuCheckboxItem>
          <DropdownMenuSeparator />
          <DropdownMenuLabel>Qualification</DropdownMenuLabel>
          {QUALIFICATIONS.map((s) => (
            <DropdownMenuCheckboxItem
              key={s}
              checked={filters.qualification?.includes(s) ?? false}
              onSelect={(e) => {
                e.preventDefault();
                toggleQualification(s);
              }}
            >
              {QUALIFICATION_LABEL[s]}
            </DropdownMenuCheckboxItem>
          ))}
        </DropdownMenuContent>
      </DropdownMenu>

      <Select
        value={filters.opportunity ?? ALL}
        onValueChange={(v) =>
          apply({ ...filters, opportunity: v === ALL ? undefined : (v as "active" | "lost") })
        }
      >
        <SelectTrigger className="h-8 w-32">
          <SelectValue placeholder="Outcome" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value={ALL}>Active + Squander</SelectItem>
          <SelectItem value="active">Active only</SelectItem>
          <SelectItem value="lost">Squander only</SelectItem>
        </SelectContent>
      </Select>

      <Select
        value={filters.affiliate ?? ALL}
        onValueChange={(v) =>
          // Clear any inherited generator filter — agents are no longer surfaced.
          apply({
            ...filters,
            affiliate: v === ALL ? undefined : v,
            generator: undefined,
          })
        }
      >
        <SelectTrigger className="h-8 w-44">
          <SelectValue placeholder="Affiliate" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value={ALL}>All affiliates</SelectItem>
          {affiliates.map((a) => (
            <SelectItem key={a.id} value={a.id}>
              {a.label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>

      <Select
        value={filters.broker ?? ALL}
        onValueChange={(v) => apply({ ...filters, broker: v === ALL ? undefined : v })}
      >
        <SelectTrigger className="h-8 w-40">
          <SelectValue placeholder="CRM" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value={ALL}>All CRMs</SelectItem>
          {brokers.map((b) => (
            <SelectItem key={b.id} value={b.id}>
              {b.label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>

      <Select
        value={filters.product ?? ALL}
        onValueChange={(v) => apply({ ...filters, product: v === ALL ? undefined : v })}
      >
        <SelectTrigger className="h-8 w-36">
          <SelectValue placeholder="Product" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value={ALL}>All products</SelectItem>
          {products.map((p) => (
            <SelectItem key={p.id} value={p.id}>
              {p.label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>

      {active > 0 && (
        <Button
          variant="ghost"
          size="sm"
          onClick={() => {
            setQ("");
            router.push(pathname);
          }}
        >
          <X className="h-4 w-4" /> Clear ({active})
        </Button>
      )}
    </div>
  );
}
