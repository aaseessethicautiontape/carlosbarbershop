import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

/**
 * Gate for /admin/**. 1) refreshes the Supabase session cookie, 2) sends signed-out visitors to the
 * login page, 3) sets a strict per-request nonce CSP (admin pages are dynamic anyway).
 * This is the FIRST line of defence only: layouts and every server action re-check the role.
 */
export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const isDev = process.env.NODE_ENV !== "production";
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
  const nonce = btoa(crypto.randomUUID());
  const csp = [
    "default-src 'self'",
    `script-src 'self' 'nonce-${nonce}' 'strict-dynamic'${isDev ? " 'unsafe-eval'" : ""}`,
    "style-src 'self' 'unsafe-inline'",
    "img-src 'self' data: blob: https://*.supabase.co",
    "font-src 'self' data:",
    `connect-src 'self' ${supabaseUrl} ${supabaseUrl.replace(/^http/, "ws")} https://*.supabase.co wss://*.supabase.co`,
    "frame-src 'self'",
    "object-src 'none'", "base-uri 'self'", "form-action 'self'", "frame-ancestors 'none'",
    isDev ? "" : "upgrade-insecure-requests",
  ].filter(Boolean).join("; ");

  const requestHeaders = new Headers(request.headers);
  requestHeaders.set("x-nonce", nonce);
  requestHeaders.set("Content-Security-Policy", csp);
  let response = NextResponse.next({ request: { headers: requestHeaders } });

  const supabase = createServerClient(supabaseUrl, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!, {
    cookies: {
      getAll: () => request.cookies.getAll(),
      setAll: (list) => {
        list.forEach(({ name, value }) => request.cookies.set(name, value));
        response = NextResponse.next({ request: { headers: requestHeaders } });
        list.forEach(({ name, value, options }) => response.cookies.set(name, value, options));
      },
    },
  });
  const { data: { user } } = await supabase.auth.getUser();

  const open = pathname === "/admin/login" || pathname.startsWith("/admin/auth/");
  if (!user && !open) {
    const url = request.nextUrl.clone();
    url.pathname = "/admin/login";
    url.search = "";
    const redirect = NextResponse.redirect(url);
    redirect.headers.set("Content-Security-Policy", csp);
    return redirect;
  }
  if (user && pathname === "/admin/login") {
    const url = request.nextUrl.clone();
    url.pathname = "/admin";
    return NextResponse.redirect(url);
  }
  response.headers.set("Content-Security-Policy", csp);
  response.headers.set("Cache-Control", "no-store");
  return response;
}

export const config = { matcher: ["/admin/:path*"] };
