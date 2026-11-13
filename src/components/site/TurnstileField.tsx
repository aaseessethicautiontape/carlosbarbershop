"use client";
import Script from "next/script";

/**
 * Cloudflare Turnstile. Mock mode renders nothing (the server skips the check). Live mode loads the
 * widget script only where it's used (booking + line forms), and the widget injects the hidden
 * `cf-turnstile-response` input into the surrounding <form>.
 */
export function TurnstileField() {
  const mock = process.env.NEXT_PUBLIC_APP_MODE !== "live";
  const siteKey = process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY;
  if (mock || !siteKey) return null;
  return (
    <>
      <Script src="https://challenges.cloudflare.com/turnstile/v0/api.js" strategy="lazyOnload" />
      <div className="cf-turnstile" data-sitekey={siteKey} data-theme="light" style={{ minHeight: 65 }} />
    </>
  );
}
