"use client";

import { useEffect, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Users, FileUser } from "lucide-react";
import { CommandDialog, CommandInput, CommandList, CommandEmpty, CommandGroup, CommandItem } from "@/components/ui/command";
import { StatusBadge } from "@/components/leads/status-badge";
import { globalSearch, type SearchResults } from "@/lib/actions/search";

export function CommandPalette() {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [q, setQ] = useState("");
  const [results, setResults] = useState<SearchResults>({ leads: [], affiliates: [] });
  const [, startTransition] = useTransition();

  // ⌘K / Ctrl+K toggles the palette.
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setOpen((o) => !o);
      }
    }
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, []);

  useEffect(() => {
    if (!open) return;
    const t = setTimeout(() => {
      startTransition(async () => setResults(await globalSearch(q)));
    }, 150);
    return () => clearTimeout(t);
  }, [q, open]);

  function go(href: string) {
    setOpen(false);
    setQ("");
    router.push(href);
  }

  return (
    <CommandDialog open={open} onOpenChange={setOpen}>
      <CommandInput placeholder="Search leads, affiliates…" value={q} onValueChange={setQ} />
      <CommandList>
        {q.length >= 2 && results.leads.length === 0 && results.affiliates.length === 0 && (
          <CommandEmpty>No results for “{q}”.</CommandEmpty>
        )}
        {results.leads.length > 0 && (
          <CommandGroup heading="Leads">
            {results.leads.map((l) => (
              <CommandItem key={l.id} value={`lead-${l.id}`} onSelect={() => go(`/leads/${l.lead_code}`)}>
                <FileUser className="h-4 w-4 text-muted-foreground" />
                <span className="flex-1 truncate">{l.customer_name}</span>
                <span className="tabular text-xs text-muted-foreground">{l.lead_code}</span>
                <StatusBadge status={l.current_status} />
              </CommandItem>
            ))}
          </CommandGroup>
        )}
        {results.affiliates.length > 0 && (
          <CommandGroup heading="Affiliates">
            {results.affiliates.map((a) => (
              <CommandItem key={a.id} value={`aff-${a.id}`} onSelect={() => go(`/affiliates/${a.id}`)}>
                <Users className="h-4 w-4 text-muted-foreground" />
                <span className="flex-1 truncate">{a.name}</span>
              </CommandItem>
            ))}
          </CommandGroup>
        )}
        {q.length < 2 && (
          <div className="px-3 py-6 text-center text-xs text-muted-foreground">
            Type to search leads by name, email, phone, policy or code.
          </div>
        )}
      </CommandList>
    </CommandDialog>
  );
}
