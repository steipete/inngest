import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const lockfile = readFileSync(new URL("../../pnpm-lock.yaml", import.meta.url), "utf8");

describe("dependency security floors", () => {
  for (const [name, minimum] of [
    ["tinypool", [2, 1, 2]],
    ["source-map-js", [1, 2, 2]],
  ] as const) {
    it(`locks every ${name} instance to a patched release`, () => {
      const versions = [...lockfile.matchAll(new RegExp(`^  ${name}@([^:]+):`, "gm"))].map(
        (match) => match[1],
      );
      expect(versions.length).toBeGreaterThan(0);
      for (const version of versions) {
        expect(version).toMatch(/^\d+\.\d+\.\d+$/);
        const parts = version.split(".").map(Number);
        const difference = parts.map((part, index) => part - minimum[index]);
        expect(difference.find((part) => part !== 0) ?? 0, version).toBeGreaterThanOrEqual(0);
      }
    });
  }
});
