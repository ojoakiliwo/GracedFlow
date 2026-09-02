import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    // Tests share one Postgres database and reset the schema in beforeAll, so
    // they must not run in parallel across files.
    fileParallelism: false,
    include: ["test/**/*.test.ts", "../client/test/**/*.test.ts"],
  },
});
