import { FlatCompat } from "@eslint/eslintrc";
import { dirname } from "node:path";
import { fileURLToPath } from "node:url";

const compat = new FlatCompat({ baseDirectory: dirname(fileURLToPath(import.meta.url)) });

export default [
  { ignores: [".next/**", "node_modules/**", "supabase/**", "next-env.d.ts"] },
  ...compat.extends("next/core-web-vitals", "next/typescript"),
  {
    // The service-role client must never be reachable from client code.
    files: ["src/components/**", "src/app/**/*.client.tsx"],
    rules: {
      "no-restricted-imports": ["error", { patterns: ["@/lib/supabase/admin", "**/supabase/admin"] }],
    },
  },
];
