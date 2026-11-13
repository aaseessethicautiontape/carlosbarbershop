import { z } from "zod";
import { phoneField } from "./common";

export const walkinSchema = z.object({
  name: z.string().trim().min(1, "Please enter your first name").max(60),
  phone: phoneField,
  serviceId: z.union([z.uuid(), z.literal("")]).optional(),
});
export type WalkinInput = z.infer<typeof walkinSchema>;
