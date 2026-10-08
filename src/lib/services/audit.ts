/**
 * Audit service — keeps a record of important admin and government actions.
 *
 * Example row: "Admin approved machine Mahindra 575 DI" (who, what, when).
 * Rows are only ever added, never changed, so later anyone can check who did what.
 * The admin reads them on the audit log page (Phase 7).
 */
import type { Prisma } from "@/generated/prisma/client";
import { db } from "@/lib/db";

export type AuditEntry = {
  actorId: string; // the user who did the action
  action: string; // short code, e.g. "MACHINE_APPROVED"
  entityType: string; // which table it is about, e.g. "Machine"
  entityId?: string; // which row of that table
  details?: string; // a short human-readable note
};

/**
 * Saves one audit log row.
 * Pass `tx` (a transaction) when the audit row must be saved together with
 * another change, so both are saved or neither is. Otherwise it uses `db`.
 */
export async function writeAuditLog(
  entry: AuditEntry,
  tx: Prisma.TransactionClient = db,
): Promise<void> {
  await tx.auditLog.create({ data: entry });
}
