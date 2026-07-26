import { z } from "zod";
import {
  PIPELINE_STAGES,
  type PipelineStage,
  type QualificationStatus,
} from "@/lib/domain/pipeline";

const stageEnum = z.enum(PIPELINE_STAGES as [PipelineStage, ...PipelineStage[]]);
const qualificationEnum = z.enum(["pending", "qualified", "not_qualified"]) satisfies z.ZodType<QualificationStatus>;
const sourceEnum = z.enum(["manual", "csv", "api"]);

const blankToUndefined = <T extends z.ZodTypeAny>(s: T) =>
  s.optional().or(z.literal("").transform(() => undefined));

const isoDate = blankToUndefined(z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Use YYYY-MM-DD"));
const optionalEmail = blankToUndefined(z.string().email("Invalid email"));

// International numbers: allow +, digits, spaces, dashes, parens; require 7-15 digits.
const phoneLike = blankToUndefined(
  z
    .string()
    .max(40)
    .refine((v) => (v.replace(/\D/g, "").length >= 7 && v.replace(/\D/g, "").length <= 15), {
      message: "Enter a valid international phone number",
    }),
);

const dobSchema = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/, "Date of birth is required (YYYY-MM-DD)")
  .refine((v) => {
    const d = new Date(v);
    return !Number.isNaN(d.getTime()) && d <= new Date();
  }, "Date of birth cannot be in the future")
  .refine((v) => new Date(v) > new Date("1900-01-01"), "Date of birth looks wrong");

/**
 * Create. Required per spec §25: first name, last name, product, location,
 * DOB, source, and at least one contact method.
 */
export const leadCreateSchema = z
  .object({
    title: blankToUndefined(z.string().max(20)),
    firstName: z.string().min(1, "First name is required").max(100),
    lastName: z.string().min(1, "Last name is required").max(100),
    dateOfBirth: dobSchema,
    countryOfResidence: z.string().min(1, "Location is required").max(2),
    nationality: blankToUndefined(z.string().max(2)),

    email: optionalEmail,
    phone: phoneLike,
    whatsappSameAsPhone: z.boolean().default(false),
    whatsappPhone: phoneLike,

    productIds: z.array(z.string().uuid()).min(1, "Select at least one product"),

    affiliateId: z.string().uuid("Select a source"),
    generatorId: blankToUndefined(z.string().uuid()).nullable().optional(),
    brokerId: blankToUndefined(z.string().uuid()).nullable().optional(),

    qualification: qualificationEnum.default("pending"),
    stage: stageEnum.optional().nullable(),

    note: blankToUndefined(z.string().max(5000)),
    sourceChannel: sourceEnum.default("manual"),
  })
  .refine((d) => d.email || d.phone || d.whatsappPhone, {
    message: "Provide at least one contact method (email, phone or WhatsApp)",
    path: ["email"],
  })
  .refine((d) => d.qualification === "qualified" || !d.stage, {
    message: "Only a qualified lead can start in a pipeline stage",
    path: ["stage"],
  });

export type LeadCreateInput = z.infer<typeof leadCreateSchema>;

/** Detail edit. Status axes have their own dedicated actions. */
export const leadUpdateSchema = z.object({
  id: z.string().uuid(),
  title: blankToUndefined(z.string().max(20)),
  firstName: z.string().min(1).max(100).optional(),
  lastName: z.string().min(1).max(100).optional(),
  dateOfBirth: isoDate,
  countryOfResidence: blankToUndefined(z.string().max(2)),
  nationality: blankToUndefined(z.string().max(2)),
  email: optionalEmail,
  phone: phoneLike,
  whatsappSameAsPhone: z.boolean().optional(),
  whatsappPhone: phoneLike,
  productIds: z.array(z.string().uuid()).min(1).optional(),
  affiliateId: z.string().uuid().optional(),
  generatorId: z.string().uuid().nullable().optional(),
  brokerId: z.string().uuid().nullable().optional(),
  policyNumber: blankToUndefined(z.string().max(60)),
  notes: blankToUndefined(z.string().max(5000)),
});
export type LeadUpdateInput = z.infer<typeof leadUpdateSchema>;

export const qualificationSchema = z.object({
  id: z.string().uuid(),
  qualification: qualificationEnum,
  reason: blankToUndefined(z.string().max(1000)),
});
export type QualificationInput = z.infer<typeof qualificationSchema>;

export const stageChangeSchema = z.object({
  id: z.string().uuid(),
  stage: stageEnum,
  reason: blankToUndefined(z.string().max(1000)),
});
export type StageChangeInput = z.infer<typeof stageChangeSchema>;

export const markLostSchema = z.object({
  id: z.string().uuid(),
  lostReasonId: z.string().uuid("Select a reason"),
  lostNotes: blankToUndefined(z.string().max(2000)),
});
export type MarkLostInput = z.infer<typeof markLostSchema>;

export const reopenSchema = z.object({
  id: z.string().uuid(),
  stage: stageEnum.optional().nullable(),
  reason: blankToUndefined(z.string().max(1000)),
});
export type ReopenInput = z.infer<typeof reopenSchema>;

export const bulkStageSchema = z.object({
  ids: z.array(z.string().uuid()).min(1).max(500),
  stage: stageEnum,
  reason: blankToUndefined(z.string().max(1000)),
});
export type BulkStageInput = z.infer<typeof bulkStageSchema>;

export const assignBrokerSchema = z.object({
  ids: z.array(z.string().uuid()).min(1).max(500),
  brokerId: z.string().uuid().nullable(),
});

export const duplicateCheckSchema = z.object({
  email: z.string().optional(),
  phone: z.string().optional(),
  whatsapp: z.string().optional(),
  firstName: z.string().optional(),
  lastName: z.string().optional(),
  dateOfBirth: z.string().optional(),
  excludeId: z.string().uuid().optional(),
});
export type DuplicateCheckInput = z.infer<typeof duplicateCheckSchema>;
