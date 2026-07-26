import { redirect } from "next/navigation";
import { requireAppUser, getPermissionMatrix } from "@/lib/auth";
import { can } from "@/lib/domain/permissions";
import { ImportWizard } from "@/components/import/import-wizard";

export const dynamic = "force-dynamic";

export default async function ImportPage() {
  const [user, matrix] = await Promise.all([requireAppUser(), getPermissionMatrix()]);
  if (!can(matrix, user.role, "imports", "create")) redirect("/dashboard");

  return (
    <div className="mx-auto max-w-4xl space-y-4">
      <div>
        <h1 className="text-xl font-semibold tracking-tight">Import leads</h1>
        <p className="text-xs text-muted-foreground">
          Upload a CSV. We validate every row, flag duplicates, and let you download an error report before committing.
        </p>
      </div>
      <ImportWizard />
    </div>
  );
}
