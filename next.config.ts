import type { NextConfig } from "next";

const isDev = process.env.NODE_ENV !== "production";
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "";
const supabaseWs = supabaseUrl.replace(/^http/, "ws");

/**
 * Static CSP for the PUBLIC site. Nonce-based CSP would force every page dynamic
 * and defeat ISR, so public pages allow inline scripts (Next's bootstrap) and
 * pin everything else to known origins. /admin gets a strict per-request
 * nonce CSP from middleware.ts instead (see PLAN.md, decision 7).
 */
const publicCsp = [
  "default-src 'self'",
  `script-src 'self' 'unsafe-inline' https://challenges.cloudflare.com${isDev ? " 'unsafe-eval'" : ""}`,
  "style-src 'self' 'unsafe-inline'",
  "img-src 'self' data: blob: https://*.supabase.co https://maps.gstatic.com https://maps.googleapis.com",
  "font-src 'self' data:",
  `connect-src 'self' ${supabaseUrl} ${supabaseWs} https://*.supabase.co wss://*.supabase.co https://challenges.cloudflare.com`,
  "frame-src https://challenges.cloudflare.com https://www.google.com",
  "object-src 'none'",
  "base-uri 'self'",
  "form-action 'self'",
  "frame-ancestors 'none'",
  isDev ? "" : "upgrade-insecure-requests",
]
  .filter(Boolean)
  .join("; ");

const baseHeaders = [
  { key: "Strict-Transport-Security", value: "max-age=63072000; includeSubDomains; preload" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  { key: "X-Frame-Options", value: "DENY" },
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=(), payment=()" },
];

const nextConfig: NextConfig = {
  poweredByHeader: false,
  reactStrictMode: true,
  images: {
    formats: ["image/avif", "image/webp"],
    deviceSizes: [360, 414, 512, 640, 828, 1080, 1280, 1536],
    imageSizes: [32, 64, 96, 128, 256, 384],
  },
  async headers() {
    return [
      { source: "/:path*", headers: baseHeaders },
      // Everything except /admin gets the static CSP. /admin's nonce CSP is set in middleware.
      { source: "/((?!admin).*)", headers: [{ key: "Content-Security-Policy", value: publicCsp }] },
    ];
  },
};

export default nextConfig;
