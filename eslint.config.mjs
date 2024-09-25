import globals from "globals";
import pluginJs from "@eslint/js";
import tseslint from "typescript-eslint";

export default [
  { files: ["**/*.{js,mjs,cjs,ts}"] },
  { languageOptions: { globals: globals.browser } },
  pluginJs.configs.recommended,
  ...tseslint.configs.recommended,
  {
    "prefer-const": "warn",
    "import/no-mutable-exports": "error",
    "import/no-unused-modules": "error",
    "simple-import-sort/imports": "error",
    "simple-import-sort/exports": "error",
    "import/no-extraneous-dependencies": "error",
    "@typescript-eslint/no-unused-vars": "warn",
    "@typescript-eslint/no-explicit-any": "warn",
    "@typescript-eslint/no-unsafe-call": "warn",
    "@typescript-eslint/no-unsafe-return": "warn",
    "@typescript-eslint/no-unsafe-argument": "off",
    "@typescript-eslint/no-unsafe-assignment": "off",
    "@typescript-eslint/no-non-null-assertion": "off",
    "@typescript-eslint/no-unsafe-member-access": "off",
    "import/consistent-type-specifier-style": ["error", "prefer-top-level"],
  },
];
