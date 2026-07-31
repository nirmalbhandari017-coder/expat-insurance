import { z } from "zod";

const blank = <T extends z.ZodTypeAny>(s: T) =>
  s.optional().or(z.literal("").transform(() => undefined));

export const generatorSchema = z.object({
  firstName: z.string().min(1, "First name is required").max(100),
  lastName: z.string().min(1, "Last name is required").max(100),
  affiliateId: z.string().uuid("Select the source this agent belongs to"),
  email: blank(z.string().email("Invalid email")),
  phone: blank(z.string().max(40)),
  notes: blank(z.string().max(5000)),
  isActive: z.boolean().default(true),
});
export type GeneratorInput = z.infer<typeof generatorSchema>;

export const generatorUpdateSchema = generatorSchema.partial().extend({
  id: z.string().uuid(),
});
export type GeneratorUpdateInput = z.infer<typeof generatorUpdateSchema>;
