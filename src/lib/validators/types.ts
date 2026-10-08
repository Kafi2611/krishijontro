// Shared types for forms: error message keys and what a server action sends back.
import type messages from "../../../messages/en.json";

/** Any key of the "Validation" section in messages/en.json, e.g. "phoneInvalid". */
export type ValidationKey = keyof (typeof messages)["Validation"];

/**
 * What a server action (or service) sends back to a form:
 * { ok: true } when it worked, or { ok: false, error } with the key of an error message.
 * The form then shows the translated message, e.g. tError(result.error).
 */
export type ActionResult = { ok: true } | { ok: false; error: ValidationKey };
