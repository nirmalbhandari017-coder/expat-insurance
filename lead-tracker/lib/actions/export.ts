"use server";

import ExcelJS from "exceljs";
import { createClient } from "@/lib/supabase/server";
import { requireAppUser, getPermissionMatrix } from "@/lib/auth";
import { can } from "@/lib/domain/permissions";
import { applyLeadFilters } from "@/lib/queries/leads";
import { STAGE_LABEL, QUALIFICATION_LABEL } from "@/lib/domain/pipeline";
import type { LeadFilters } from "@/lib/filters";
import { ok, fail, messageFromError, type ActionResult } from "./_result";

export interface ExportFile {
  filename: string;
  mime: string;
  base64: string;
}

// PII columns are withheld unless the user has leads:export_pii (Admin/BD).
const PII_COLUMNS = new Set([
  "customer_name",
  "email",
  "phone",
  "whatsapp_phone",
  "date_of_birth",
  "nationality",
  "policy_number",
]);

const ALL_COLUMNS: { key: string; header: string }[] = [
  { key: "lead_code", header: "Lead Code" },
  { key: "customer_name", header: "Customer" },
  { key: "email", header: "Email" },
  { key: "phone", header: "Phone" },
  { key: "nationality", header: "Nationality" },
  { key: "country_of_residence", header: "Residence" },
  { key: "qualification", header: "Qualification" },
  { key: "stage", header: "Pipeline Stage" },
  { key: "opportunity", header: "Outcome" },
  { key: "affiliate_name", header: "Source" },
  { key: "broker_name", header: "CRM" },
  { key: "generator_name", header: "Agent" },
  { key: "policy_number", header: "Policy #" },
  { key: "source_channel", header: "Source" },
  { key: "quote_date", header: "Quote Date" },
  { key: "application_date", header: "Application Date" },
  { key: "payment_date", header: "Payment Date" },
  { key: "created_at", header: "Created" },
];

async function loadRows(filters: LeadFilters, includePii: boolean) {
  const supabase = await createClient();
  const columns =
    "lead_code, customer_name, email, phone, whatsapp_phone, date_of_birth, nationality, " +
    "country_of_residence, qualification, stage, opportunity, " +
    "source_channel, policy_number, quote_date, application_date, payment_date, created_at, " +
    "affiliate:affiliates(name), generator:generators(full_name), broker:brokers(full_name)";

  const { data, error } = await applyLeadFilters(supabase, filters, { columns }).limit(50000);
  if (error) throw error;
  const rows = (data ?? []) as unknown as Record<string, unknown>[];

  return rows.map((r) => {
    const flat: Record<string, unknown> = {
      lead_code: r.lead_code,
      customer_name: r.customer_name,
      email: r.email,
      phone: r.phone,
      nationality: r.nationality,
      country_of_residence: r.country_of_residence,
      whatsapp_phone: r.whatsapp_phone,
      date_of_birth: r.date_of_birth,
      qualification:
        QUALIFICATION_LABEL[r.qualification as keyof typeof QUALIFICATION_LABEL] ?? r.qualification,
      stage: r.stage ? (STAGE_LABEL[r.stage as keyof typeof STAGE_LABEL] ?? r.stage) : "",
      opportunity: r.opportunity,
      affiliate_name: (r.affiliate as { name?: string } | null)?.name ?? "",
      generator_name: (r.generator as { full_name?: string } | null)?.full_name ?? "",
      broker_name: (r.broker as { full_name?: string } | null)?.full_name ?? "",
      policy_number: r.policy_number,
      source_channel: r.source_channel,
      quote_date: r.quote_date,
      application_date: r.application_date,
      payment_date: r.payment_date,
      created_at: r.created_at,
    };
    if (!includePii) for (const c of PII_COLUMNS) flat[c] = "—";
    return flat;
  });
}

export async function exportLeads(
  filters: LeadFilters,
  format: "csv" | "xlsx",
): Promise<ActionResult<ExportFile>> {
  try {
    const user = await requireAppUser();
    const matrix = await getPermissionMatrix();
    if (!can(matrix, user.role, "leads", "export")) return fail("You don't have permission to export.");
    const includePii = can(matrix, user.role, "leads", "export_pii");

    const rows = await loadRows(filters, includePii);
    const stamp = new Date().toISOString().slice(0, 10);

    if (format === "csv") {
      const header = ALL_COLUMNS.map((c) => c.header).join(",");
      const body = rows
        .map((r) =>
          ALL_COLUMNS.map((c) => {
            const v = r[c.key] ?? "";
            const s = String(v).replace(/"/g, '""');
            return /[",\n]/.test(s) ? `"${s}"` : s;
          }).join(","),
        )
        .join("\n");
      const csv = `${header}\n${body}`;
      return ok({
        filename: `leads-${stamp}.csv`,
        mime: "text/csv",
        base64: Buffer.from(csv, "utf8").toString("base64"),
      });
    }

    const wb = new ExcelJS.Workbook();
    const ws = wb.addWorksheet("Leads");
    ws.columns = ALL_COLUMNS.map((c) => ({ header: c.header, key: c.key, width: 18 }));
    ws.getRow(1).font = { bold: true };
    rows.forEach((r) => ws.addRow(r));
    const buffer = await wb.xlsx.writeBuffer();
    return ok({
      filename: `leads-${stamp}.xlsx`,
      mime: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      base64: Buffer.from(buffer).toString("base64"),
    });
  } catch (e) {
    return fail(messageFromError(e));
  }
}
