// Small helpers for long lists whose filters live in the page address, e.g.
// /admin/users?role=FARMER&q=karim&page=2. Keeping filters in the address means the Back
// button works and a filtered list can be reloaded or shared.

/** One value from the address: ?a=1&a=2 gives a list, and we use the first one. */
function firstValue(raw: string | string[] | undefined): string | undefined {
  return Array.isArray(raw) ? raw[0] : raw;
}

/**
 * The page number from ?page=..., at least 1. Anything that is not a whole number gives 1.
 * Example: readPageNumber("3") -> 3, readPageNumber("abc") -> 1, readPageNumber(undefined) -> 1
 */
export function readPageNumber(raw: string | string[] | undefined): number {
  const page = Number(firstValue(raw));
  return Number.isInteger(page) && page >= 1 ? page : 1;
}

/**
 * Search words from ?q=..., trimmed and at most 50 letters (a longer search is cut).
 * Example: readSearchText("  karim ") -> "karim"
 */
export function readSearchText(raw: string | string[] | undefined): string {
  return (firstValue(raw) ?? "").trim().slice(0, 50);
}

/**
 * The value from the address only if it is one of the allowed choices, otherwise null.
 * Example: readChoice("FARMER", ["FARMER", "ADMIN"]) -> "FARMER", readChoice("x", [...]) -> null
 */
export function readChoice<T extends string>(raw: string | string[] | undefined, choices: readonly T[]): T | null {
  const value = firstValue(raw);
  return choices.find((choice) => choice === value) ?? null;
}

/**
 * Builds a list address from a path and its filters, leaving out empty filters and page 1.
 * Example: listHref("/admin/users", { role: "FARMER", q: "", page: 2 }) -> "/admin/users?role=FARMER&page=2"
 */
export function listHref(path: string, filters: Record<string, string | number | null | undefined>): string {
  const params = new URLSearchParams();
  for (const [name, value] of Object.entries(filters)) {
    if (value === null || value === undefined || value === "" || (name === "page" && value === 1)) {
      continue;
    }
    params.set(name, String(value));
  }
  const query = params.toString();
  return query === "" ? path : `${path}?${query}`;
}
