"use server";

import Papa from "papaparse";
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { requirePermission } from "@/lib/auth";
import { importRowSchema } from "@/lib/schemas/misc";
import {
  PIPELINE_STAGES,
  STAGE_LABEL,
  type PipelineStage,
  type QualificationStatus,
} from "@/lib/domain/pipeline";
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
  qualification: QualificationStatus;
  stage: PipelineStage | null;
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

const STAGE_BY_LABEL = new Map<string, PipelineStage>(
  PIPELINE_STAGES.flatMap((s) => [
    [s.toLowerCase(), s],
    [STAGE_LABEL[s].toLowerCase(), s],
  ]),
);

const QUALIFICATION_BY_LABEL = new Map<string, QualificationStatus>([
  ["pending", "pending"],
  ["pending qualification", "pending"],
  ["qualified", "qualified"],
  ["not qualified", "not_qualified"],
  ["not_qualified", "not_qualified"],
]);

function normalizePhone(phone?: string) {
  return (phone ?? "").replace(/[^0-9+]/g, "");
}

interface Resolved {
  valid: { insert: TablesInsert<"leads">; productIds: string[]; preview: ImportPreviewRow }[];
  errors: ImportError[];
  duplicateRows: number;
  totalRows: number;
}

async function resolveRows(csvText: string): Promise<Resolved> {
  const supabase = await createClient();

  const [{ data: affiliates }, { data: products }, { data: generators }, { data: brokers }] =
    await Promise.all([
      supabase.from("affiliates").select("id, name").is("deleted_at", null),
      supabase.from("products").select("id, name").is("deleted_at", null),
      supabase.from("generators").select("id, full_name, affiliate_id").is("deleted_at", null),
      supabase.from("brokers").select("id, full_name").is("deleted_at", null),
    ]);
  const affMap = new Map((affiliates ?? []).map((a) => [a.name.toLowerCase().trim(), a.id]));
  const productMap = new Map((products ?? []).map((t) => [t.name.toLowerCase().trim(), t.id]));
  const generatorMap = new Map(
    (generators ?? []).map((g) => [
      g.affiliate_id + "::" + (g.full_name ?? "").toLowerCase().trim(),
      g.id,
    ]),
  );
  const brokerMap = new Map(
    (brokers ?? []).map((b) => [(b.full_name ?? "").toLowerCase().trim(), b.id]),
  );

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
      errors.push({ row: rowNum, field: "affiliate", message: `Unknown source "${r.affiliate}"` });
      return;
    }

    // Products are comma-separated in one column: "Health, Life".
    const productIds: string[] = [];
    if (r.product) {
      const names = r.product.split(",").map((x) => x.trim()).filter(Boolean);
      let bad = false;
      for (const name of names) {
        const pid = productMap.get(name.toLowerCase());
        if (!pid) {
          errors.push({ row: rowNum, field: "product", message: `Unknown product "${name}"` });
          bad = true;
          break;
        }
        productIds.push(pid);
      }
      if (bad) return;
    }

    let generatorId: string | null = null;
    if (r.generator) {
      generatorId = generatorMap.get(affId + "::" + r.generator.toLowerCase().trim()) ?? null;
      if (!generatorId) {
        errors.push({
          row: rowNum,
          field: "generator",
          message: `"${r.generator}" is not an agent for ${r.affiliate}`,
        });
        return;
      }
    }

    let brokerId: string | null = null;
    if (r.broker) {
      brokerId = brokerMap.get(r.broker.toLowerCase().trim()) ?? null;
      if (!brokerId) {
        errors.push({ row: rowNum, field: "broker", message: `Unknown CRM "${r.broker}"` });
        return;
      }
    }

    let qualification: QualificationStatus = "pending";
    if (r.qualification) {
      const mapped = QUALIFICATION_BY_LABEL.get(r.qualification.toLowerCase().trim());
      if (!mapped) {
        errors.push({
          row: rowNum,
          field: "qualification",
          message: `Unknown qualification "${r.qualification}"`,
        });
        return;
      }
      qualification = mapped;
    }

    let stage: PipelineStage | null = null;
    if (r.stage) {
      const mapped = STAGE_BY_LABEL.get(r.stage.toLowerCase().trim());
      if (!mapped) {
        errors.push({ row: rowNum, field: "stage", message: `Unknown stage "${r.stage}"` });
        return;
      }
      stage = mapped;
      qualification = "qualified"; // holding a stage implies qualification
    } else if (qualification === "qualified") {
      stage = "qualified";
    }

    if (!r.email && !r.phone && !r.whatsapp_phone) {
      errors.push({
        row: rowNum,
        field: "email",
        message: "Provide at least an email, phone or WhatsApp number",
      });
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
        customer_name: (r.first_name + ' ' + r.last_name).trim(),
        title: r.title || null,
        first_name: r.first_name,
        last_name: r.last_name,
        date_of_birth: r.date_of_birth || null,
        email: r.email || null,
        phone: r.phone || null,
        whatsapp_phone: r.whatsapp_phone || r.phone || null,
        whatsapp_same_as_phone: !r.whatsapp_phone && !!r.phone,
        nationality: r.nationality || null,
        country_of_residence: r.country_of_residence || null,
        affiliate_id: affId,
        generator_id: generatorId,
        broker_id: brokerId,
        qualification,
        stage,
        policy_number: r.policy_number || null,
        notes: r.notes || null,
        source_channel: "csv",
      },
      productIds,
      preview: {
        row: rowNum,
        customer_name: r.first_name + ' ' + r.last_name,
        email: r.email || "",
        affiliate: r.affiliate,
        qualification,
        stage,
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
      const slice = resolved.valid.slice(i, i + CHUNK);
      const chunk = slice.map((v) => ({ ...v.insert, import_job_id: jobId }));
      const { data, error } = await supabase.from("leads").insert(chunk).select("id");
      if (error) {
        await supabase.from("import_jobs").update({ status: "failed" }).eq("id", jobId);
        return fail(messageFromError(error));
      }
      // Products live in a join table, so they are linked once ids exist.
      const links = (data ?? []).flatMap((row, idx) =>
        (slice[idx]?.productIds ?? []).map((product_id) => ({ lead_id: row.id, product_id })),
      );
      if (links.length) await supabase.from("lead_products").insert(links);
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
