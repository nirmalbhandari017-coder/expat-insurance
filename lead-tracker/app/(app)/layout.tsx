import Link from "next/link";
import { Search } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { requireAppUser, getPermissionMatrix, homeForRole } from "@/lib/auth";
import { can, isInternalRole, ROLE_LABEL } from "@/lib/domain/permissions";
import { CommandPalette } from "@/components/search/command-palette";
import { NotificationsPopover, type NotificationItem } from "@/components/notifications/notifications-popover";
import { ThemeToggle } from "@/components/theme-toggle";

const INTERNAL_NAV = [
  { href: "/dashboard", label: "Dashboard" },
  { href: "/pipeline", label: "Pipeline" },
  { href: "/affiliates", label: "Sources" },
  { href: "/brokers", label: "CRMs" },
  { href: "/analytics", label: "Analytics & Reports" },
];

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const [user, matrix, supabase] = await Promise.all([requireAppUser(), getPermissionMatrix(), createClient()]);
  const internal = isInternalRole(user.role);

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

  const canImport = internal && can(matrix, user.role, "imports", "create");
  const isAdmin = user.role === "admin";

  // External users get only their own scoped entry (spec §11).
  const nav = internal
    ? INTERNAL_NAV
    : user.role === "source"
      ? [{ href: "/source", label: "My Reporting" }]
      : [{ href: "/pipeline", label: "My Leads" }]; // crm

  return (
    <div className="flex min-h-screen flex-col">
      <header className="sticky top-0 z-30 flex h-14 items-center gap-5 border-b bg-background/95 px-6 backdrop-blur">
        <Link href={homeForRole(user.role)} className="text-sm font-semibold tracking-tight">Lead Tracker</Link>
        <nav className="flex items-center gap-0.5 text-sm">
          {nav.map((n) => (
            <Link key={n.href} href={n.href} className="rounded-md px-3 py-1.5 text-muted-foreground transition hover:bg-accent hover:text-foreground">
              {n.label}
            </Link>
          ))}
          {canImport && <Link href="/import" className="rounded-md px-3 py-1.5 text-muted-foreground transition hover:bg-accent hover:text-foreground">Import</Link>}
          {isAdmin && <Link href="/settings" className="rounded-md px-3 py-1.5 text-muted-foreground transition hover:bg-accent hover:text-foreground">Settings</Link>}
        </nav>

        <div className="ml-auto flex items-center gap-2 text-sm">
          {internal && <CommandHint />}
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
      {internal && <CommandPalette />}
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
