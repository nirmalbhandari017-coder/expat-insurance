"use server";

import Papa from "papaparse";
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { requirePermission } from "@/lib/auth";
import { importRowSchema } from "@/lib/schemas/misc";
import { PIPELINE_STATUSES, STATUS_LABEL, type LeadStatus } from "@/lib/domain/pipeline";
import { ok, fail, messageFromError, type ActionResult } from "./_result";
import type { TablesInsert, Json } from "@/types/database";

export interface ImportError {
  row: number; // 1-based data row
  field: string;
  message: string;
}
export interface ImportPreviewRow {
  row: number;
  customer_name: string;
  email: string;
  affiliate: string;
  status: LeadStatus;
  duplicate: boolean;
  valid: boolean;
}
export interface ImportPreview {
  jobId: string;
  totalRows: number;
  validRows: number;
  errorRows: number;
  duplicateRows: number;
  errors: ImportError[];
  preview: ImportPreviewRow[];
}

const STATUS_BY_LABEL = new Map<string, LeadStatus>(
  PIPELINE_STATUSES.flatMap((s) => [
    [s.toLowerCase(), s],
    [STATUS_LABEL[s].toLowerCase(), s],
  ]),
);

function normalizePhone(phone?: string) {
  return (phone ?? "").replace(/[^0-9+]/g, "");
}

interface Resolved {
  valid: { insert: TablesInsert<"leads">; preview: ImportPreviewRow }[];
  errors: ImportError[];
  duplicateRows: number;
  totalRows: number;
}

async function resolveRows(csvText: string): Promise<Resolved> {
  const supabase = await createClient();

  const [{ data: affiliates }, { data: types }] = await Promise.all([
    supabase.from("affiliates").select("id, name").is("deleted_at", null),
    supabase.from("insurance_types").select("id, name").is("deleted_at", null),
  ]);
  const affMap = new Map((affiliates ?? []).map((a) => [a.name.toLowerCase().trim(), a.id]));
  const typeMap = new Map((types ?? []).map((t) => [t.name.toLowerCase().trim(), t.id]));

  const parsed = Papa.parse<Record<string, string>>(csvText, {
    header: true,
    skipEmptyLines: true,
    transformHeader: (h) => h.trim().toLowerCase().replace(/\s+/g, "_"),
  });
  const rows = parsed.data;

  // Batch duplicate lookup: existing emails/phones in DB.
  const emails = rows.map((r) => (r.email ?? "").trim().toLowerCase()).filter(Boolean);
  const phones = rows.map((r) => normalizePhone(r.phone)).filter(Boolean);
  const existingEmail = new Set<string>();
  const existingPhone = new Set<string>();
  if (emails.length) {
    const { data } = await supabase.from("leads").select("email").is("deleted_at", null).in("email", emails);
    for (const d of data ?? []) if (d.email) existingEmail.add(d.email.toLowerCase());
  }
  if (phones.length) {
    const { data } = await supabase.from("leads").select("phone_normalized").is("deleted_at", null).in("phone_normalized", phones);
    for (const d of data ?? []) if (d.phone_normalized) existingPhone.add(d.phone_normalized);
  }

  const seenInFile = new Set<string>();
  const errors: ImportError[] = [];
  const valid: Resolved["valid"] = [];
  let duplicateRows = 0;

  rows.forEach((raw, i) => {
    const rowNum = i + 1;
    const check = importRowSchema.safeParse(raw);
    if (!check.success) {
      for (const issue of check.error.issues) {
        errors.push({ row: rowNum, field: String(issue.path[0] ?? "row"), message: issue.message });
      }
      return;
    }
    const r = check.data;

    const affId = affMap.get(r.affiliate.toLowerCase().trim());
    if (!affId) {
      errors.push({ row: rowNum, field: "affiliate", message: `Unknown affiliate "${r.affiliate}"` });
      return;
    }
    let typeId: string | null = null;
    if (r.insurance_type) {
      typeId = typeMap.get(r.insurance_type.toLowerCase().trim()) ?? null;
      if (!typeId) {
        errors.push({ row: rowNum, field: "insurance_type", message: `Unknown insurance type "${r.insurance_type}"` });
        return;
      }
    }
    let status: LeadStatus = "inbound";
    if (r.status) {
      const mapped = STATUS_BY_LABEL.get(r.status.toLowerCase().trim());
      if (!mapped) {
        errors.push({ row: rowNum, field: "status", message: `Unknown status "${r.status}"` });
        return;
      }
      status = mapped;
    }
    if (status === "lost") {
      errors.push({ row: rowNum, field: "status", message: "Importing directly as Lost isn't allowed (needs a lost reason)" });
      return;
    }
    if (!r.email && !r.phone) {
      errors.push({ row: rowNum, field: "email", message: "Provide at least an email or phone" });
      return;
    }

    const emailKey = (r.email ?? "").toLowerCase();
    const phoneKey = normalizePhone(r.phone);
    const fileKey = emailKey || phoneKey;
    const isDup =
      (emailKey && existingEmail.has(emailKey)) ||
      (phoneKey && existingPhone.has(phoneKey)) ||
      (fileKey && seenInFile.has(fileKey));
    if (fileKey) seenInFile.add(fileKey);
    if (isDup) duplicateRows++;

    valid.push({
      insert: {
        customer_name: r.customer_name,
        email: r.email || null,
        phone: r.phone || null,
        nationality: r.nationality || null,
        country_of_residence: r.country_of_residence || null,
        insurance_type_id: typeId,
        affiliate_id: affId,
        current_status: status,
        policy_number: r.policy_number || null,
        notes: r.notes || null,
        source_channel: "csv",
      },
      preview: {
        row: rowNum,
        customer_name: r.customer_name,
        email: r.email || "",
        affiliate: r.affiliate,
        status,
        duplicate: Boolean(isDup),
        valid: true,
      },
    });
  });

  return { valid, errors, duplicateRows, totalRows: rows.length };
}

export async function validateImport(csvText: string, filename: string): Promise<ActionResult<ImportPreview>> {
  try {
    const user = await requirePermission("imports", "create");
    const supabase = await createClient();
    const resolved = await resolveRows(csvText);

    const { data: job, error } = await supabase
      .from("import_jobs")
      .insert({
        filename,
        uploaded_by: user.id,
        status: "preview_ready",
        total_rows: resolved.totalRows,
        valid_rows: resolved.valid.length,
        error_rows: resolved.errors.length,
        error_report: resolved.errors as unknown as Json,
      })
      .select("id")
      .single();
    if (error) return fail(messageFromError(error));

    return ok({
      jobId: job.id,
      totalRows: resolved.totalRows,
      validRows: resolved.valid.length,
      errorRows: resolved.errors.length,
      duplicateRows: resolved.duplicateRows,
      errors: resolved.errors.slice(0, 500),
      preview: [
        ...resolved.valid.slice(0, 50).map((v) => v.preview),
      ],
    });
  } catch (e) {
    return fail(messageFromError(e));
  }
}

export async function commitImport(
  jobId: string,
  csvText: string,
): Promise<ActionResult<{ inserted: number; skipped: number }>> {
  try {
    await requirePermission("imports", "create");
    const supabase = await createClient();

    // Idempotency: a committed/committing job is a no-op.
    const { data: job } = await supabase.from("import_jobs").select("status").eq("id", jobId).single();
    if (!job) return fail("Import job not found");
    if (job.status === "done") return ok({ inserted: 0, skipped: 0 });

    await supabase.from("import_jobs").update({ status: "committing" }).eq("id", jobId);
    const resolved = await resolveRows(csvText);

    let inserted = 0;
    const CHUNK = 500;
    for (let i = 0; i < resolved.valid.length; i += CHUNK) {
      const chunk = resolved.valid.slice(i, i + CHUNK).map((v) => ({ ...v.insert, import_job_id: jobId }));
      const { data, error } = await supabase.from("leads").insert(chunk).select("id");
      if (error) {
        await supabase.from("import_jobs").update({ status: "failed" }).eq("id", jobId);
        return fail(messageFromError(error));
      }
      inserted += data?.length ?? 0;
    }

    await supabase.from("import_jobs").update({ status: "done", valid_rows: inserted }).eq("id", jobId);
    revalidatePath("/pipeline");
    revalidatePath("/dashboard");
    return ok({ inserted, skipped: resolved.errors.length });
  } catch (e) {
    return fail(messageFromError(e));
  }
}
