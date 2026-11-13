import { z } from "zod";
import { nameField, optionalEmail, phoneField } from "./common";

export const bookingSchema = z.object({
  serviceId: z.uuid(),
  barberId: z.union([z.uuid(), z.literal("any")]),
  startsAt: z.iso.datetime(),
  name: nameField,
  phone: phoneField,
  email: optionalEmail,
});
export type BookingInput = z.infer<typeof bookingSchema>;

export const rescheduleSchema = z.object({ token: z.string().min(10).max(400), startsAt: z.iso.datetime() });
export const tokenOnlySchema = z.object({ token: z.string().min(10).max(400) });

export const availabilityQuery = z.object({
  service: z.uuid(),
  barber: z.union([z.uuid(), z.literal("any")]).default("any"),
  day: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
});
