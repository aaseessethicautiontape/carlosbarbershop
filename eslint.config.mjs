import { FlatCompat } from "@eslint/eslintrc";
import { dirname } from "node:path";
import { fileURLToPath } from "node:url";

const compat = new FlatCompat({ baseDirectory: dirname(fileURLToPath(import.meta.url)) });

export default [
  { ignores: [".next/**", "node_modules/**", "supabase/**", "next-env.d.ts"] },
  ...compat.extends("next/core-web-vitals", "next/typescript"),
  {
    // Server-only modules (database client, env, auth, live-query sealing) must never be reachable from client components.
    files: ["src/components/**", "src/app/**/*.client.tsx"],
    rules: {
      "no-restricted-imports": ["error", { patterns: ["@/lib/db", "@/lib/env.server", "@/lib/auth/neon", "@/lib/live"] }],
    },
  },
];
