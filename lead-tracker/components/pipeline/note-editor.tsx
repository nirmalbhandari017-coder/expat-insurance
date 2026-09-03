"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Pencil } from "lucide-react";
import { Popover, PopoverTrigger, PopoverContent } from "@/components/ui/popover";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { saveLeadNote } from "@/lib/actions/interactions";
import { relativeAge } from "@/lib/format";
import { cn } from "@/lib/utils";

/**
 * Edits a lead's latest note straight from the pipeline. Saving amends your own
 * most recent note, or adds a new one if the last note was someone else's.
 */
export function NoteEditor({
  leadId,
  note,
  noteAt,
  variant = "cell",
}: {
  leadId: string;
  note: string | null;
  noteAt: string | null;
  /** "cell" for the table column, "card" for the compact kanban card. */
  variant?: "cell" | "card";
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [draft, setDraft] = useState(note ?? "");
  const [pending, start] = useTransition();

  // Re-sync when the popover opens so an external change isn't overwritten.
  function onOpenChange(next: boolean) {
    if (next) setDraft(note ?? "");
    setOpen(next);
  }

  function save() {
    const body = draft.trim();
    if (!body) {
      toast.error("Note cannot be empty");
      return;
    }
    start(async () => {
      const res = await saveLeadNote({ leadId, body });
      if (res.ok) {
        toast.success("Note saved");
        setOpen(false);
        router.refresh();
      } else toast.error(res.error);
    });
  }

  return (
    <Popover open={open} onOpenChange={onOpenChange}>
      <PopoverTrigger asChild>
        <button
          title={note ?? "Add a note"}
          className={cn(
            "group/note w-full rounded text-left hover:bg-muted/60",
            variant === "cell" ? "px-1 py-0.5" : "px-1 py-0.5",
          )}
        >
          {note ? (
            <>
              <span
                className={cn(
                  "line-clamp-2 leading-snug",
                  variant === "cell" ? "text-xs" : "text-[11px] text-muted-foreground",
                )}
              >
                {note}
              </span>
              {noteAt && variant === "cell" && (
                <span className="mt-0.5 block text-[11px] text-muted-foreground">
                  {relativeAge(noteAt)} ago
                </span>
              )}
            </>
          ) : (
            <span
              className={cn(
                "inline-flex items-center gap-1 text-muted-foreground",
                variant === "cell" ? "text-xs" : "text-[11px]",
              )}
            >
              <Pencil className="h-3 w-3 opacity-0 transition-opacity group-hover/note:opacity-100" />
              Add a note
            </span>
          )}
        </button>
      </PopoverTrigger>
      <PopoverContent align="start" className="w-80 space-y-2">
        <Textarea
          autoFocus
          rows={4}
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          placeholder="What happened with this client?"
          onKeyDown={(e) => {
            if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) save();
            if (e.key === "Escape") setOpen(false);
          }}
        />
        <div className="flex items-center justify-between">
          <span className="text-[11px] text-muted-foreground">⌘/Ctrl + Enter to save</span>
          <div className="flex gap-2">
            <Button variant="outline" size="sm" onClick={() => setOpen(false)}>
              Cancel
            </Button>
            <Button size="sm" onClick={save} disabled={pending}>
              {pending ? "Saving…" : "Save"}
            </Button>
          </div>
        </div>
      </PopoverContent>
    </Popover>
  );
}
