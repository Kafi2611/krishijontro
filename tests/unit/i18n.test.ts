// Unit tests for the Bangla digit helpers in src/lib/i18n.ts.
import { describe, expect, it } from "vitest";
import { localizeDigits, pickByLocale, toBanglaDigits, toEnglishDigits } from "@/lib/i18n";

describe("Bangla digits", () => {
  it("turns English digits into Bangla digits", () => {
    expect(toBanglaDigits("01700000001")).toBe("০১৭০০০০০০০১");
    expect(toBanglaDigits(2026)).toBe("২০২৬");
  });

  it("turns Bangla digits back into English digits", () => {
    expect(toEnglishDigits("০১৭০০০০০০০১")).toBe("01700000001");
    expect(toEnglishDigits("KJ-২০২৬")).toBe("KJ-2026");
  });

  it("only changes digits when the page is in Bangla", () => {
    expect(localizeDigits("KJ-2026-000123", "bn")).toBe("KJ-২০২৬-০০০১২৩");
    expect(localizeDigits("KJ-2026-000123", "en")).toBe("KJ-2026-000123");
  });
});

describe("pickByLocale", () => {
  it("picks the Bangla name on Bangla pages, if there is one", () => {
    expect(pickByLocale("Rajshahi", "রাজশাহী", "bn")).toBe("রাজশাহী");
    expect(pickByLocale("Rajshahi", "রাজশাহী", "en")).toBe("Rajshahi");
    expect(pickByLocale("Rajshahi", null, "bn")).toBe("Rajshahi");
  });
});
