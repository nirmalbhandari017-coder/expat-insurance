import { redirect } from "next/navigation";

// The affiliate directory moved into Analytics & Reports. Kept as a redirect so
// existing links and bookmarks keep working; /affiliates/[id] is unaffected.
export default function AffiliatesPage() {
  redirect("/analytics");
}
