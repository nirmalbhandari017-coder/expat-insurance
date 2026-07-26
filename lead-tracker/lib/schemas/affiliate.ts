import { z } from "zod";

const affiliateType = z.enum([
  "relocation_agency",
  "expat_services",
  "referral_partner",
  "financial_advisor",
  "other",
]);

export const affiliateSchema = z.object({
  name: z.string().min(1, "Name is required").max(200),
  contactPerson: z.string().max(200).optional().or(z.literal("").transform(() => undefined)),
  email: z.string().email().optional().or(z.literal("").transform(() => undefined)),
  phone: z.string().max(40).optional().or(z.literal("").transform(() => undefined)),
  commissionPct: z
    .number()
    .min(0)
    .max(100)
    .optional()
    .nullable(),
  type: affiliateType.default("other"),
  country: z.string().max(2).optional().or(z.literal("").transform(() => undefined)),
  externalRef: z.string().max(200).optional().or(z.literal("").transform(() => undefined)),
  isActive: z.boolean().default(true),
  notes: z.string().max(5000).optional().or(z.literal("").transform(() => undefined)),
});
export type AffiliateInput = z.infer<typeof affiliateSchema>;

export const affiliateUpdateSchema = affiliateSchema.partial().extend({
  id: z.string().uuid(),
});
export type AffiliateUpdateInput = z.infer<typeof affiliateUpdateSchema>;
