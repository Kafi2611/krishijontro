"use server";
// Server actions for the provider's own account: business details and operators.
// Each one checks on the server that the user is a PROVIDER.
import { revalidatePath } from "next/cache";
import { requireRole } from "@/lib/auth";
import { createOperator } from "@/lib/services/operator";
import { updateProviderBusiness } from "@/lib/services/provider";
import { operatorSchema, type OperatorInput } from "@/lib/validators/operator";
import { providerBusinessSchema, type ProviderBusinessInput } from "@/lib/validators/provider";
import type { ActionResult } from "@/lib/validators/types";

/** Saves the provider's business details (what the admin checks for approval). */
export async function updateProviderBusinessAction(values: ProviderBusinessInput): Promise<ActionResult> {
  const provider = await requireRole("PROVIDER");
  const parsed = providerBusinessSchema.safeParse(values);
  if (!parsed.success) {
    return { ok: false, error: "somethingWrong" };
  }

  const result = await updateProviderBusiness(provider.id, parsed.data);
  if (result.ok) {
    revalidatePath("/", "layout");
  }
  return result;
}

/** Creates an operator account that works for this provider. */
export async function createOperatorAction(values: OperatorInput): Promise<ActionResult> {
  const provider = await requireRole("PROVIDER");
  const parsed = operatorSchema.safeParse(values);
  if (!parsed.success) {
    return { ok: false, error: "somethingWrong" };
  }

  const result = await createOperator(provider.id, provider.name, parsed.data);
  if (result.ok) {
    revalidatePath("/", "layout");
  }
  return result;
}
