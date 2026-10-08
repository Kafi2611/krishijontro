// Zod rules for the provider's "Business details" form.
// The admin reads these details before approving the provider.
import { z } from "zod";
import { ProviderType } from "@/generated/prisma/enums";

/** A Bangladesh National ID number has 10, 13 or 17 digits. */
export const NID_REGEX = /^(\d{10}|\d{13}|\d{17})$/;

export const providerBusinessSchema = z.object({
  providerType: z.enum(ProviderType, "required"),
  businessName: z.string().trim().min(2, "required").max(80, "tooLong"),
  nid: z.string().trim().regex(NID_REGEX, "nidInvalid"),
  tradeLicenseNo: z.string().trim().max(40, "tooLong"), // optional (individual owners often have none)
  address: z.string().trim().min(3, "required").max(120, "tooLong"),
  locationId: z.string().min(1, "required"), // the provider's upazila
  payoutAccount: z.string().trim().min(5, "required").max(60, "tooLong"), // e.g. "bKash 01700000003"
});

export type ProviderBusinessInput = z.infer<typeof providerBusinessSchema>;
