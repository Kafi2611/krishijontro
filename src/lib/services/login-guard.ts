/**
 * Login guard — saves wrong logins and says whether a mobile number (or a connection) is locked.
 * The rules and the numbers are in login-rules.ts; this file only reads and writes the
 * LoginAttempt table. auth.ts calls it from the login check (authorize).
 */
import { db } from "@/lib/db";
import { getLookBackStart, isLocked, LOGIN_LIMITS } from "@/lib/services/login-rules";

/** Wrong tries are kept for one day, then deleted (they are only needed for a few minutes). */
const KEEP_MS = 24 * 60 * 60 * 1000;

/**
 * True if this mobile number may try to log in now: neither the number nor the connection
 * (`ip`, may be null) is locked by too many wrong tries (see login-rules.ts).
 */
export async function isLoginAllowed(phone: string, ip: string | null): Promise<boolean> {
  const since = getLookBackStart();
  const [phoneTries, connectionTries] = await Promise.all([
    db.loginAttempt.findMany({ where: { phone, createdAt: { gte: since } }, select: { createdAt: true } }),
    ip ? db.loginAttempt.findMany({ where: { ip, createdAt: { gte: since } }, select: { createdAt: true } }) : [],
  ]);
  const phoneLocked = isLocked(phoneTries.map((row) => row.createdAt), LOGIN_LIMITS.perPhone);
  const connectionLocked = isLocked(connectionTries.map((row) => row.createdAt), LOGIN_LIMITS.perConnection);
  return !phoneLocked && !connectionLocked;
}

/** Saves one wrong login, and deletes wrong tries older than a day so the table stays small. */
export async function recordFailedLogin(phone: string, ip: string | null): Promise<void> {
  await db.loginAttempt.create({ data: { phone, ip } });
  await db.loginAttempt.deleteMany({ where: { createdAt: { lt: new Date(Date.now() - KEEP_MS) } } });
}

/**
 * After a good login, the number's wrong tries are forgotten. (The connection's are kept: one
 * good login must not let a connection go on guessing the passwords of other numbers.)
 */
export async function clearFailedLogins(phone: string): Promise<void> {
  await db.loginAttempt.deleteMany({ where: { phone } });
}
