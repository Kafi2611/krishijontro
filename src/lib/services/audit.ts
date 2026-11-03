/**
 * Audit service — keeps a record of important admin and government actions.
 *
 * Example row: "Admin approved machine Mahindra 575 DI" (who, what, when).
 * Rows are only ever added, never changed, so later anyone can check who did what.
 * The admin reads them on the Audit log page (listAuditLogs), filtered by kind of action.
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

/** How many rows one page of the audit log shows. */
export const AUDIT_ROWS_PER_PAGE = 40;

/**
 * One page of the audit log, newest first, with who did each action (name and role).
 * The filter keeps only one kind of action (e.g. "USER_SUSPENDED"); null shows every kind.
 * Returns the rows, how many match in total, and how many pages that makes.
 */
export async function listAuditLogs(filter: { action: string | null; page: number }) {
  const where = filter.action ? { action: filter.action } : {};
  const [rows, total] = await Promise.all([
    db.auditLog.findMany({
      where,
      include: { actor: { select: { name: true, role: true } } },
      orderBy: { createdAt: "desc" },
      skip: (filter.page - 1) * AUDIT_ROWS_PER_PAGE,
      take: AUDIT_ROWS_PER_PAGE,
    }),
    db.auditLog.count({ where }),
  ]);
  return { rows, total, pageCount: Math.max(1, Math.ceil(total / AUDIT_ROWS_PER_PAGE)) };
}

/** Every kind of action found in the log, with how many rows each has (most first). For the filter buttons. */
export async function countAuditActions(): Promise<{ action: string; count: number }[]> {
  const groups = await db.auditLog.groupBy({ by: ["action"], _count: { _all: true } });
  return groups
    .map((group) => ({ action: group.action, count: group._count._all }))
    .sort((a, b) => b.count - a.count || a.action.localeCompare(b.action));
}
