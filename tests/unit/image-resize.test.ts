// Unit tests for src/lib/image-resize.ts: the new size of a photo before it is uploaded.
// (The drawing on a <canvas> itself only runs in a browser; the end-to-end test
// tests/e2e/photo-upload.spec.ts uploads a real big photo.)
import { describe, expect, it } from "vitest";
import { getResizedSize, JPEG_QUALITIES, MAX_PHOTO_SIDE } from "@/lib/image-resize";

describe("getResizedSize", () => {
  it("makes the longest side of a big phone photo 1600 pixels, keeping its shape", () => {
    expect(MAX_PHOTO_SIDE).toBe(1600);
    expect(getResizedSize(4000, 3000)).toEqual({ width: 1600, height: 1200 }); // landscape
    expect(getResizedSize(3000, 4000)).toEqual({ width: 1200, height: 1600 }); // portrait
    expect(getResizedSize(4032, 1908)).toEqual({ width: 1600, height: 757 }); // a wide photo, rounded
  });

  it("never makes a small photo bigger", () => {
    expect(getResizedSize(800, 600)).toEqual({ width: 800, height: 600 });
    expect(getResizedSize(1600, 1600)).toEqual({ width: 1600, height: 1600 });
  });

  it("can use another limit", () => {
    expect(getResizedSize(2000, 1000, 1000)).toEqual({ width: 1000, height: 500 });
  });
});

describe("JPEG_QUALITIES", () => {
  it("tries the best quality first, then lower ones", () => {
    const sorted = [...JPEG_QUALITIES].sort((a, b) => b - a);
    expect(JPEG_QUALITIES).toEqual(sorted);
    expect(JPEG_QUALITIES.every((quality) => quality > 0 && quality <= 1)).toBe(true);
  });
});
