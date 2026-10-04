// Vitest settings: where the unit tests live and how "@/..." imports are found.
import { defineConfig } from "vitest/config";

export default defineConfig({
  resolve: {
    // Lets tests use the same "@/lib/..." imports as the app (read from tsconfig.json).
    tsconfigPaths: true,
  },
  test: {
    include: ["tests/unit/**/*.test.ts"],
    environment: "node",
  },
});
