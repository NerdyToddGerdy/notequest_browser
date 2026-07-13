/// <reference types="vitest/config" />
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

// GitHub Pages project-page hosting needs the repo name as the base path;
// local dev and `vite preview` stay at "/".
const base = process.env.GITHUB_ACTIONS ? "/notequest_browser/" : "/";

export default defineConfig({
  base,
  plugins: [react()],
  test: {
    globals: true,
    // Engine tests are pure logic and run fine in Node; component tests opt
    // into jsdom per-file with a `// @vitest-environment jsdom` docblock.
    environment: "node",
    setupFiles: ["./src/test/setup.ts"],
  },
});
