import { z } from "zod";

const blank = <T extends z.ZodTypeAny>(s: T) =>
  s.optional().or(z.literal("").transform(() => undefined));

export const brokerSchema = z.object({
  firstName: z.string().min(1, "First name is required").max(100),
  lastName: z.string().min(1, "Last name is required").max(100),
  company: blank(z.string().max(200)),
  email: blank(z.string().email("Invalid email")),
  phone: blank(z.string().max(40)),
  notes: blank(z.string().max(5000)),
  // Optional link to a login account, so a broker can see their own leads.
  appUserId: z.string().uuid().nullable().optional(),
  isActive: z.boolean().default(true),
});
export type BrokerInput = z.infer<typeof brokerSchema>;

export const brokerUpdateSchema = brokerSchema.partial().extend({
  id: z.string().uuid(),
});
export type BrokerUpdateInput = z.infer<typeof brokerUpdateSchema>;
