"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { UploadCloud, AlertTriangle, CheckCircle2, Download } from "lucide-react";
import { Button } from "@/components/ui/button";
import { validateImport, commitImport, type ImportPreview } from "@/lib/actions/import";
import { STAGE_LABEL, QUALIFICATION_LABEL } from "@/lib/domain/pipeline";

const TEMPLATE = "customer_name,email,phone,nationality,country_of_residence,insurance_type,affiliate,status,policy_number,notes";

export function ImportWizard() {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [filename, setFilename] = useState("");
  const [csvText, setCsvText] = useState("");
  const [preview, setPreview] = useState<ImportPreview | null>(null);
  const [done, setDone] = useState<{ inserted: number; skipped: number } | null>(null);

  async function onFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    const text = await file.text();
    setFilename(file.name);
    setCsvText(text);
    setPreview(null);
    setDone(null);
    start(async () => {
      const res = await validateImport(text, file.name);
      if (res.ok) setPreview(res.data);
      else toast.error(res.error);
    });
  }

  function commit() {
    if (!preview) return;
    start(async () => {
      const res = await commitImport(preview.jobId, csvText);
      if (res.ok) {
        setDone(res.data);
        toast.success(`Imported ${res.data.inserted} leads`);
        router.refresh();
      } else toast.error(res.error);
    });
  }

  function downloadErrors() {
    if (!preview) return;
    const csv = ["row,field,message", ...preview.errors.map((e) => `${e.row},"${e.field}","${e.message.replace(/"/g, '""')}"`)].join("\n");
    const url = URL.createObjectURL(new Blob([csv], { type: "text/csv" }));
    const a = document.createElement("a");
    a.href = url; a.download = "import-errors.csv"; a.click();
    URL.revokeObjectURL(url);
  }

  if (done) {
    return (
      <div className="rounded-lg border p-8 text-center">
        <CheckCircle2 className="mx-auto h-10 w-10 text-status-open" />
        <h2 className="mt-3 text-lg font-semibold">Import complete</h2>
        <p className="mt-1 text-sm text-muted-foreground">{done.inserted} leads imported · {done.skipped} rows skipped.</p>
        <div className="mt-4 flex justify-center gap-2">
          <Button variant="outline" onClick={() => { setPreview(null); setDone(null); setCsvText(""); setFilename(""); }}>Import another</Button>
          <Button onClick={() => router.push("/pipeline")}>Go to pipeline</Button>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {!preview && (
        <label className="flex cursor-pointer flex-col items-center justify-center gap-2 rounded-lg border border-dashed py-12 text-center hover:bg-muted/30">
          <UploadCloud className="h-8 w-8 text-muted-foreground" />
          <span className="text-sm font-medium">{pending ? "Validating…" : "Choose a CSV file"}</span>
          <span className="text-xs text-muted-foreground">Columns: {TEMPLATE}</span>
          <input type="file" accept=".csv,text/csv" className="hidden" onChange={onFile} disabled={pending} />
        </label>
      )}

      {preview && (
        <>
          <div className="grid grid-cols-4 gap-3">
            <Stat label="Total rows" value={preview.totalRows} />
            <Stat label="Valid" value={preview.validRows} tone="open" />
            <Stat label="Errors" value={preview.errorRows} tone={preview.errorRows ? "lost" : undefined} />
            <Stat label="Duplicates" value={preview.duplicateRows} tone={preview.duplicateRows ? "pending" : undefined} />
          </div>

          <div className="text-sm text-muted-foreground">{filename}</div>

          {preview.errors.length > 0 && (
            <div className="rounded-lg border border-status-lost/30">
              <div className="flex items-center justify-between border-b bg-status-lost/5 px-3 py-2 text-sm">
                <span className="flex items-center gap-2 font-medium"><AlertTriangle className="h-4 w-4 text-status-lost" /> {preview.errors.length} row error(s)</span>
                <Button variant="outline" size="sm" onClick={downloadErrors}><Download className="h-4 w-4" /> Error report</Button>
              </div>
              <div className="max-h-48 overflow-y-auto text-sm">
                {preview.errors.slice(0, 50).map((e, i) => (
                  <div key={i} className="flex gap-3 border-b px-3 py-1.5 last:border-0">
                    <span className="tabular w-12 text-muted-foreground">Row {e.row}</span>
                    <span className="w-28 text-muted-foreground">{e.field}</span>
                    <span>{e.message}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {preview.preview.length > 0 && (
            <div className="overflow-x-auto rounded-lg border">
              <table className="w-full text-sm">
                <thead><tr className="border-b bg-muted/40 text-left text-xs text-muted-foreground">
                  <th className="px-3 py-2">Row</th><th className="px-3 py-2">Customer</th><th className="px-3 py-2">Email</th>
                  <th className="px-3 py-2">Affiliate</th><th className="px-3 py-2">Status</th><th className="px-3 py-2">Flags</th>
                </tr></thead>
                <tbody>
                  {preview.preview.map((r) => (
                    <tr key={r.row} className="border-b">
                      <td className="tabular px-3 py-1.5 text-muted-foreground">{r.row}</td>
                      <td className="px-3 py-1.5">{r.customer_name}</td>
                      <td className="px-3 py-1.5 text-muted-foreground">{r.email || "—"}</td>
                      <td className="px-3 py-1.5">{r.affiliate}</td>
                      <td className="px-3 py-1.5">
                        {r.stage ? STAGE_LABEL[r.stage] : QUALIFICATION_LABEL[r.qualification]}
                      </td>
                      <td className="px-3 py-1.5">{r.duplicate && <span className="text-xs text-status-pending">possible duplicate</span>}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
              <div className="px-3 py-1.5 text-xs text-muted-foreground">Showing first {preview.preview.length} valid rows.</div>
            </div>
          )}

          <div className="flex items-center justify-end gap-2">
            <Button variant="outline" onClick={() => { setPreview(null); setCsvText(""); }}>Cancel</Button>
            <Button onClick={commit} disabled={pending || preview.validRows === 0}>
              {pending ? "Importing…" : `Import ${preview.validRows} valid lead(s)`}
            </Button>
          </div>
        </>
      )}
    </div>
  );
}

function Stat({ label, value, tone }: { label: string; value: number; tone?: "open" | "lost" | "pending" }) {
  return (
    <div className="rounded-lg border p-3">
      <div className="text-xs text-muted-foreground">{label}</div>
      <div className={`tabular mt-0.5 text-xl font-semibold ${tone ? `text-status-${tone}` : ""}`}>{value}</div>
    </div>
  );
}
