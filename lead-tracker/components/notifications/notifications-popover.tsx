"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Bell } from "lucide-react";
import { Popover, PopoverTrigger, PopoverContent } from "@/components/ui/popover";
import { Button } from "@/components/ui/button";
import { markNotificationRead, markAllNotificationsRead } from "@/lib/actions/interactions";
import { relativeAge } from "@/lib/format";
import { cn } from "@/lib/utils";

export interface NotificationItem {
  id: string;
  title: string;
  body: string | null;
  read_at: string | null;
  created_at: string;
  lead_code: string | null;
}

export function NotificationsPopover({ items, unread }: { items: NotificationItem[]; unread: number }) {
  const router = useRouter();
  const [, start] = useTransition();
  const [open, setOpen] = useState(false);

  function openItem(n: NotificationItem) {
    start(async () => {
      if (!n.read_at) await markNotificationRead(n.id);
      if (n.lead_code) router.push(`/leads/${n.lead_code}`);
      setOpen(false);
      router.refresh();
    });
  }

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button variant="ghost" size="icon-sm" className="relative" aria-label="Notifications">
          <Bell className="h-4 w-4" />
          {unread > 0 && (
            <span className="absolute -right-0.5 -top-0.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-destructive px-1 text-[9px] font-semibold text-destructive-foreground">
              {unread > 9 ? "9+" : unread}
            </span>
          )}
        </Button>
      </PopoverTrigger>
      <PopoverContent align="end" className="w-80 p-0">
        <div className="flex items-center justify-between border-b px-3 py-2">
          <span className="text-sm font-medium">Notifications</span>
          {unread > 0 && (
            <button
              className="text-xs text-muted-foreground hover:text-foreground"
              onClick={() => start(async () => { await markAllNotificationsRead(); router.refresh(); })}
            >
              Mark all read
            </button>
          )}
        </div>
        <div className="max-h-96 overflow-y-auto">
          {items.length === 0 && <div className="px-3 py-8 text-center text-sm text-muted-foreground">You&apos;re all caught up.</div>}
          {items.map((n) => (
            <button
              key={n.id}
              onClick={() => openItem(n)}
              className={cn("flex w-full flex-col items-start gap-0.5 border-b px-3 py-2 text-left last:border-0 hover:bg-muted/40", !n.read_at && "bg-primary/5")}
            >
              <div className="flex w-full items-center justify-between gap-2">
                <span className="text-sm font-medium">{n.title}</span>
                <span className="shrink-0 text-[10px] text-muted-foreground">{relativeAge(n.created_at)}</span>
              </div>
              {n.body && <span className="text-xs text-muted-foreground">{n.body}</span>}
            </button>
          ))}
        </div>
      </PopoverContent>
    </Popover>
  );
}
