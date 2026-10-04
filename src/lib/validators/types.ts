// Type helper for showing translated error messages under form fields.
import type messages from "../../../messages/en.json";

/** Any key of the "Validation" section in messages/en.json, e.g. "phoneInvalid". */
export type ValidationKey = keyof (typeof messages)["Validation"];
