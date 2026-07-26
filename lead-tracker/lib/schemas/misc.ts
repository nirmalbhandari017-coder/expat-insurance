import { z } from "zod";

export const commentSchema = z.object({
  leadId: z.string().uuid(),
  body: z.string().min(1, "Comment cannot be empty").max(5000),
});
export type CommentInput = z.infer<typeof commentSchema>;

export const savedFilterSchema = z.object({
  name: z.string().min(1).max(120),
  queryString: z.string().max(4000),
  isShared: z.boolean().default(false),
});
export type SavedFilterInput = z.infer<typeof savedFilterSchema>;

export const documentMetaSchema = z.object({
  leadId: z.string().uuid(),
  filename: z.string().min(1).max(255),
  storagePath: z.string().min(1).max(500),
  mimeType: z.string().max(120).optional(),
  sizeBytes: z.number().int().nonnegative().optional(),
});
export type DocumentMetaInput = z.infer<typeof documentMetaSchema>;

// One CSV row as imported. Kept lenient (strings) — coercion + FK resolution
// (affiliate name -> id, insurance type name -> id) happens in the import action,
// which produces a per-row error report.
export const importRowSchema = z.object({
  customer_name: z.string().min(1, "Customer name required"),
  email: z.string().email("Invalid email").optional().or(z.literal("")),
  phone: z.string().optional().or(z.literal("")),
  nationality: z.string().max(2).optional().or(z.literal("")),
  country_of_residence: z.string().max(2).optional().or(z.literal("")),
  insurance_type: z.string().optional().or(z.literal("")),
  affiliate: z.string().min(1, "Affiliate required"),
  status: z.string().optional().or(z.literal("")),
  policy_number: z.string().optional().or(z.literal("")),
  notes: z.string().optional().or(z.literal("")),
});
export type ImportRow = z.infer<typeof importRowSchema>;
