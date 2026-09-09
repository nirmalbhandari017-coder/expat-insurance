import { redirect } from "next/navigation";

// Agents are no longer surfaced in the app. The generators table and its data
// are untouched, so this can be restored by putting the page back.
export default function GeneratorsPage() {
  redirect("/pipeline");
}
