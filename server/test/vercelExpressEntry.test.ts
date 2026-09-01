import { existsSync, readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");

function read(rel: string) {
  return readFileSync(resolve(root, rel), "utf8");
}

describe("Vercel Express entry for graced-flow-server", () => {
  it("keeps a single default-exported app on a Vercel detection path", () => {
    expect(read("app.ts")).toMatch(/export default app/);
    expect(read("src/app.ts")).not.toMatch(/export default/);
    expect(existsSync(resolve(root, "src/index.ts"))).toBe(false);
    expect(read("src/listen.ts")).toMatch(/app\.listen/);
    expect(read("vercel.json")).toMatch(/"framework": "express"/);
  });
});
