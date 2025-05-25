import js from "@eslint/js";
import tseslint from "typescript-eslint";
import pluginJsonc from "eslint-plugin-jsonc";
import pluginMarkdown from "eslint-plugin-markdown";
import pluginJest from "eslint-plugin-jest";

export default tseslint.config(
  js.configs.recommended,
  ...tseslint.configs.recommended,
  ...pluginJsonc.configs["flat/recommended-with-jsonc"],
  ...pluginMarkdown.configs.recommended,
  {
    // Specific configuration for Jest/test files
    files: ["**/*.test.ts", "**/*.spec.ts"],
    ...pluginJest.configs['flat/recommended'],
    rules: {
      ...pluginJest.configs['flat/recommended'].rules,
      // You can add or override Jest-specific rules here
    },
  },
  {
    // General configuration for TypeScript files (excluding tests)
    // Ensure this glob includes the root-level TS files.
    files: ["**/*.ts", "**/*.tsx"], // Adjusted to include root TS files
    rules: {
      // Add any project-specific rules here
      // Example: "@typescript-eslint/no-explicit-any": "warn"
    },
  },
  {
    ignores: [
      "dist/",
      "node_modules/",
      ".cache/",
      "docs/",
      "coverage/",
      "eslint.config.js", // Ignoring the config file itself
      "lib/", // Assuming 'lib' contains compiled JS, not source TS
      "*.js", // Ignoring other JS files if they are not part of the source
      "*.mjs",
      "*.cjs",
    ],
  }
);
