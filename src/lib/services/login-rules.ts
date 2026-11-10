/**
 * Login rules — when too many wrong logins lock a mobile number or a connection.
 *
 * Without a limit, someone could try thousands of passwords for one mobile number. So:
 *   - 5 wrong logins for the same mobile number within 15 minutes lock that number for 15 minutes
 *   - 20 wrong logins from the same connection (IP address) within 15 minutes lock that
 *     connection for 15 minutes (this stops one person trying many different numbers)
 * While locked, even the right password is refused. A wrong login for a mobile number that has
 * no account counts too, so the answer never tells anybody which numbers have an account.
 *
 * Everything here is a pure function (no database), so it is easy to test.
 * The database part (saving and reading the wrong tries) is in login-guard.ts.
 */

const MINUTE_MS = 60 * 1000;

/** The limits (the numbers are explained at the top of this file). */
export const LOGIN_LIMITS = {
  perPhone: 5,
  perConnection: 20,
  windowMinutes: 15, // the wrong tries must happen within this many minutes
  lockMinutes: 15, // how long the lock lasts after the last of those tries
};

/**
 * When the lock caused by these wrong tries ends, or null if they do not cause a lock.
 * A lock starts when `limit` wrong tries happened within `windowMinutes`, and it lasts
 * `lockMinutes` after the last of them.
 * Example (limit 5, 15 minutes): wrong tries at 10:00, 10:01, 10:02, 10:03 and 10:04
 *   -> locked until 10:19. Only 4 wrong tries -> null.
 */
export function getLockEnd(
  failedAt: Date[],
  limit: number,
  windowMinutes: number = LOGIN_LIMITS.windowMinutes,
  lockMinutes: number = LOGIN_LIMITS.lockMinutes,
): Date | null {
  const times = failedAt.map((date) => date.getTime()).sort((a, b) => a - b);
  let lockEnd: number | null = null;
  // Look at every group of `limit` tries in a row (the oldest is `limit - 1` places before the newest).
  for (let newest = limit - 1; newest < times.length; newest++) {
    const oldest = newest - limit + 1;
    const withinWindow = times[newest] - times[oldest] <= windowMinutes * MINUTE_MS;
    if (withinWindow) {
      const end = times[newest] + lockMinutes * MINUTE_MS;
      lockEnd = lockEnd === null ? end : Math.max(lockEnd, end);
    }
  }
  return lockEnd === null ? null : new Date(lockEnd);
}

/** True if these wrong tries lock the login right now. */
export function isLocked(failedAt: Date[], limit: number, now: Date = new Date()): boolean {
  const lockEnd = getLockEnd(failedAt, limit);
  return lockEnd !== null && lockEnd > now;
}

/** How far back we must read wrong tries to know if a lock is still on: window + lock (30 minutes). */
export function getLookBackStart(now: Date = new Date()): Date {
  return new Date(now.getTime() - (LOGIN_LIMITS.windowMinutes + LOGIN_LIMITS.lockMinutes) * MINUTE_MS);
}

/**
 * The address (IP) of the connection a request came from, or null if it is not known.
 * Vercel (and Next.js on our own computer) write it in the "x-forwarded-for" header; when a
 * request passed through several servers the header holds a list, and the first one is the
 * visitor's. Vercel replaces this header itself, so a visitor cannot fake it there.
 * Example: "103.4.5.6, 10.0.0.1" -> "103.4.5.6"
 */
export function readClientIp(headers: Headers): string | null {
  const forwardedFor = headers.get("x-forwarded-for");
  const first = forwardedFor?.split(",")[0]?.trim() || headers.get("x-real-ip")?.trim();
  if (!first) {
    return null;
  }
  return first.slice(0, 64); // an address is never longer; this keeps odd values short
}
