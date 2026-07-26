"use client";

import { useTransition } from "react";
import { toast } from "sonner";
import { Download, FileSpreadsheet, Printer } from "lucide-react";
import { Button } from "@/components/ui/button";
import { exportLeads } from "@/lib/actions/export";
import type { LeadFilters } from "@/lib/filters";

function downloadBase64(filename: string, mime: string, base64: string) {
  const bytes = Uint8Array.from(atob(base64), (c) => c.charCodeAt(0));
  const url = URL.createObjectURL(new Blob([bytes], { type: mime }));
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

export function ExportBar({ filters, canExport }: { filters: LeadFilters; canExport: boolean }) {
  const [pending, start] = useTransition();

  function run(format: "csv" | "xlsx") {
    start(async () => {
      const res = await exportLeads(filters, format);
      if (res.ok) {
        downloadBase64(res.data.filename, res.data.mime, res.data.base64);
        toast.success(`Exported ${res.data.filename}`);
      } else toast.error(res.error);
    });
  }

  if (!canExport) return null;
  return (
    <div className="flex items-center gap-2">
      <Button variant="outline" size="sm" disabled={pending} onClick={() => run("csv")}>
        <Download className="h-4 w-4" /> CSV
      </Button>
      <Button variant="outline" size="sm" disabled={pending} onClick={() => run("xlsx")}>
        <FileSpreadsheet className="h-4 w-4" /> Excel
      </Button>
      <Button variant="outline" size="sm" onClick={() => window.print()}>
        <Printer className="h-4 w-4" /> Print / PDF
      </Button>
    </div>
  );
}
