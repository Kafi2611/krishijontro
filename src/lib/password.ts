// Password helpers. We never save real passwords, only a bcrypt "hash"
// (a scrambled version that cannot be turned back into the password).
import bcrypt from "bcryptjs";

// How hard bcrypt works. 10 is a common safe value (about 0.1 second per hash).
const SALT_ROUNDS = 10;

/** Turns a plain password into a hash to save in the database. */
export async function hashPassword(plainPassword: string): Promise<string> {
  return bcrypt.hash(plainPassword, SALT_ROUNDS);
}

/** Checks a typed password against the saved hash. Returns true if they match. */
export async function verifyPassword(plainPassword: string, passwordHash: string): Promise<boolean> {
  return bcrypt.compare(plainPassword, passwordHash);
}
