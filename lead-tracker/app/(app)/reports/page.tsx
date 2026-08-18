import { redirect } from "next/navigation";

// Reports were merged into Analytics (they read the same rollups). Kept as a
// redirect so existing links and bookmarks keep working.
export default function ReportsPage() {
  redirect("/analytics");
}
