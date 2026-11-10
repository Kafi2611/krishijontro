// A helper the server actions share: after a change, every page is drawn again with the new data.
// (This file has no "use server" line: it is not an action itself, only used by the action files.)
import { revalidatePath } from "next/cache";

/**
 * When the action worked, tells Next.js to draw every page again (so lists, counts and statuses
 * show the change), then returns the same result. A failed action changed nothing, so nothing
 * needs to be drawn again.
 */
export function refreshPagesIfDone<T extends { ok: boolean }>(result: T): T {
  if (result.ok) {
    revalidatePath("/", "layout");
  }
  return result;
}
