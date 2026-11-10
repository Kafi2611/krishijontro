// Unit tests for the Bangla helpers in src/lib/i18n.ts (digits, times, names) and for the
// formatter wrapper in src/lib/format.ts that uses them.
import { describe, expect, it } from "vitest";
import { withBanglaTimes, type Formatter } from "@/lib/format";
import {
  fixBanglaTimes,
  getBanglaDayPart,
  localizeDigits,
  pickByLocale,
  toBanglaDigits,
  toEnglishDigits,
} from "@/lib/i18n";

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

describe("Bangla times", () => {
  it("knows the part of the day for an hour", () => {
    expect(getBanglaDayPart(5)).toBe("ভোর");
    expect(getBanglaDayPart(8)).toBe("সকাল");
    expect(getBanglaDayPart(12)).toBe("দুপুর");
    expect(getBanglaDayPart(16)).toBe("বিকাল");
    expect(getBanglaDayPart(19)).toBe("সন্ধ্যা");
    expect(getBanglaDayPart(22)).toBe("রাত");
    expect(getBanglaDayPart(0)).toBe("রাত");
  });

  it("replaces the English AM and PM with the Bangla part of the day", () => {
    expect(fixBanglaTimes("৮:০০ AM")).toBe("সকাল ৮:০০");
    expect(fixBanglaTimes("৪:৩০ PM")).toBe("বিকাল ৪:৩০");
    expect(fixBanglaTimes("২০ অক্টো, ২০২৬, ৮:০০ AM")).toBe("২০ অক্টো, ২০২৬, সকাল ৮:০০");
  });

  it("handles 12 o'clock: 12 PM is noon, 12 AM is night", () => {
    expect(fixBanglaTimes("১২:০০ PM")).toBe("দুপুর ১২:০০");
    expect(fixBanglaTimes("১২:১৫ AM")).toBe("রাত ১২:১৫");
  });

  it("fixes both ends of a time range, and leaves text without a time alone", () => {
    expect(fixBanglaTimes("৮:০০ AM – ১০:০০ AM")).toBe("সকাল ৮:০০ – সকাল ১০:০০");
    expect(fixBanglaTimes("২০ অক্টো, ২০২৬")).toBe("২০ অক্টো, ২০২৬");
  });

  it("works on what JavaScript really writes for a Bangla time", () => {
    const fiveInTheAfternoon = new Date("2026-10-20T11:00:00Z"); // 5:00 PM in Dhaka
    const text = new Intl.DateTimeFormat("bn", { timeZone: "Asia/Dhaka", timeStyle: "short" }).format(fiveInTheAfternoon);
    expect(fixBanglaTimes(text)).toBe("বিকাল ৫:০০");
  });
});

describe("the formatter for Bangla pages", () => {
  /** A stand-in for next-intl's formatter that answers like JavaScript does in Bangla. */
  const fakeFormat = {
    dateTime: () => "২০ অক্টো, ২০২৬, ৮:০০ AM",
    dateTimeRange: () => "৮:০০ AM – ৪:৩০ PM",
    number: () => "১,৫১৭",
  } as unknown as Formatter;

  it("fixes the times in Bangla", () => {
    const format = withBanglaTimes(fakeFormat, "bn");
    expect(format.dateTime(new Date())).toBe("২০ অক্টো, ২০২৬, সকাল ৮:০০");
    expect(format.dateTimeRange(new Date(), new Date())).toBe("সকাল ৮:০০ – বিকাল ৪:৩০");
    expect(format.number(1517)).toBe("১,৫১৭"); // numbers are not touched
  });

  it("changes nothing in English", () => {
    expect(withBanglaTimes(fakeFormat, "en")).toBe(fakeFormat);
  });
});

describe("pickByLocale", () => {
  it("picks the Bangla name on Bangla pages, if there is one", () => {
    expect(pickByLocale("Rajshahi", "রাজশাহী", "bn")).toBe("রাজশাহী");
    expect(pickByLocale("Rajshahi", "রাজশাহী", "en")).toBe("Rajshahi");
    expect(pickByLocale("Rajshahi", null, "bn")).toBe("Rajshahi");
  });
});
