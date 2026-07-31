import Link from "next/link";
import { Search } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { requireAppUser, getPermissionMatrix } from "@/lib/auth";
import { can } from "@/lib/domain/permissions";
import { ROLE_LABEL } from "@/lib/domain/permissions";
import { CommandPalette } from "@/components/search/command-palette";
import { NotificationsPopover, type NotificationItem } from "@/components/notifications/notifications-popover";
import { ThemeToggle } from "@/components/theme-toggle";

const NAV = [
  { href: "/dashboard", label: "Dashboard", resource: null },
  { href: "/pipeline", label: "Pipeline", resource: null },
  { href: "/affiliates", label: "Sources", resource: null },
  { href: "/generators", label: "Agents", resource: null },
  { href: "/brokers", label: "CRMs", resource: null },
  { href: "/analytics", label: "Analytics", resource: null },
  { href: "/reports", label: "Reports", resource: null },
] as const;

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const [user, matrix, supabase] = await Promise.all([requireAppUser(), getPermissionMatrix(), createClient()]);

  const { data: notifs } = await supabase
    .from("notifications")
    .select("id, title, body, read_at, created_at, lead:leads(lead_code)")
    .order("created_at", { ascending: false })
    .limit(15);

  const items: NotificationItem[] = (notifs ?? []).map((n) => ({
    id: n.id, title: n.title, body: n.body, read_at: n.read_at, created_at: n.created_at,
    lead_code: (n.lead as { lead_code: string } | null)?.lead_code ?? null,
  }));
  const unread = items.filter((n) => !n.read_at).length;

  const canImport = can(matrix, user.role, "imports", "create");
  const isAdmin = user.role === "admin";

  return (
    <div className="flex min-h-screen flex-col">
      <header className="sticky top-0 z-30 flex h-14 items-center gap-5 border-b bg-background/95 px-6 backdrop-blur">
        <Link href="/dashboard" className="text-sm font-semibold tracking-tight">Lead Tracker</Link>
        <nav className="flex items-center gap-0.5 text-sm">
          {NAV.map((n) => (
            <Link key={n.href} href={n.href} className="rounded-md px-3 py-1.5 text-muted-foreground transition hover:bg-accent hover:text-foreground">
              {n.label}
            </Link>
          ))}
          {canImport && <Link href="/import" className="rounded-md px-3 py-1.5 text-muted-foreground transition hover:bg-accent hover:text-foreground">Import</Link>}
          {isAdmin && <Link href="/settings" className="rounded-md px-3 py-1.5 text-muted-foreground transition hover:bg-accent hover:text-foreground">Settings</Link>}
        </nav>

        <div className="ml-auto flex items-center gap-2 text-sm">
          <CommandHint />
          <NotificationsPopover items={items} unread={unread} />
          <ThemeToggle />
          <div className="ml-1 text-right leading-tight">
            <div className="font-medium">{user.full_name}</div>
            <div className="text-xs text-muted-foreground">{ROLE_LABEL[user.role]}</div>
          </div>
          <form action="/auth/signout" method="post">
            <button className="rounded-md border px-3 py-1.5 text-sm transition hover:bg-accent">Sign out</button>
          </form>
        </div>
      </header>
      <main className="flex-1 px-6 py-6">{children}</main>
      <CommandPalette />
    </div>
  );
}

function CommandHint() {
  return (
    <div className="hidden items-center gap-1.5 rounded-md border px-2 py-1 text-xs text-muted-foreground sm:flex">
      <Search className="h-3 w-3" />
      <span>Search</span>
      <kbd className="rounded bg-muted px-1 font-mono text-[10px]">⌘K</kbd>
    </div>
  );
}
