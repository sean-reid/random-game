import { defineConfig } from "vitest/config";

export default defineConfig({
  base: "/random-game/",
  build: { target: "es2022" },
  test: { include: ["tests/unit/**/*.test.ts"] },
});
