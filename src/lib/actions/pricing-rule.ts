"use server";
// Server action for the government's "price limit" form.
// It checks ON THE SERVER that the user is GOVT, checks the form again with Zod,
// then lets the pricing rule service save the new limit.
import { revalidatePath } from "next/cache";
import { requireRole } from "@/lib/auth";
import { savePricingRule, type PricingRuleSaveResult } from "@/lib/services/pricing-rule";
import { pricingRuleSchema, type PricingRuleInput } from "@/lib/validators/pricing-rule";

/**
 * Saves new price limits for one machine type.
 * Returns ok with how many machines are now outside the limit, or an error key.
 */
export async function savePricingRuleAction(
  machineTypeId: string,
  values: PricingRuleInput,
): Promise<PricingRuleSaveResult> {
  const govtUser = await requireRole("GOVT");
  // Never trust the browser: check the form again with the same Zod rules.
  const parsed = pricingRuleSchema.safeParse(values);
  if (!parsed.success) {
    return { ok: false, error: "somethingWrong" };
  }

  const result = await savePricingRule(machineTypeId, parsed.data, govtUser.id);
  if (result.ok) {
    // Prices show on many pages (machine form, search, calculator), so refresh them all.
    revalidatePath("/", "layout");
  }
  return result;
}
