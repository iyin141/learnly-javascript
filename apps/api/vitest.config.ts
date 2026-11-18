import { defineConfig } from "vitest/config";

// Test files share one PostgreSQL database; run them one after another so cleanup in one file cannot delete another file's rows.
export default defineConfig({ test: { fileParallelism: false } });
