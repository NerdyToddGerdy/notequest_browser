import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { configDefaults } from "vitest/config";

// GitHub Pages project-page hosting needs the repo name as the base path;
// local dev and `vite preview` stay at "/".
const base = process.env.GITHUB_ACTIONS ? "/notequest_browser/" : "/";

// readFileSync + JSON.parse rather than a JSON import, since import attribute syntax
// ("with { type: 'json' }") support varies across the Node versions this config might run
// under (see CLAUDE.md's Node 20.17 note) -- this works everywhere.
const pkg = JSON.parse(readFileSync(fileURLToPath(new URL("./package.json", import.meta.url)), "utf-8")) as {
  version: string;
};

export default defineConfig({
  base,
  plugins: [react()],
  define: {
    __APP_VERSION__: JSON.stringify(pkg.version),
  },
  css: {
    modules: {
      // Vite's default scoped-name format is an opaque hash (e.g. `_die_1ewh6_1`) -- fine
      // functionally (CSS Modules classes are never meant to be typed by hand), but unfriendly to
      // read in devtools, with no way to trace a class back to its source component. `[name]` is
      // the CSS file's own basename (unique per component in this codebase -- every
      // `*.module.css` file is named after the component it styles, see CLAUDE.md), so
      // `[name]__[local]` (e.g. `Die__die`) stays collision-free while being traceable at a
      // glance. Applied to both dev and the production build (issue #57) -- this is a small hobby
      // project, not a bundle-size-critical one, so there's little reason to keep the terser
      // hashed format only in production.
      generateScopedName: "[name]__[local]",
    },
  },
  test: {
    globals: true,
    // Engine tests are pure logic and run fine in Node; component tests opt
    // into jsdom per-file with a `// @vitest-environment jsdom` docblock.
    environment: "node",
    setupFiles: ["./src/test/setup.ts"],
    // e2e/ holds Playwright specs (npm run test:e2e), not Vitest ones -- they use @playwright/test's
    // own test()/expect() (a browser `page` fixture, no jsdom involved), which vitest's default
    // test-file glob would otherwise try to run directly and fail on.
    exclude: [...configDefaults.exclude, "e2e/**"],
  },
});
