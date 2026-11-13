import { NextResponse, type NextRequest } from "next/server";
import { userClient } from "@/lib/supabase/server";

export async function GET(request: NextRequest) {
  const code = request.nextUrl.searchParams.get("code");
  const url = request.nextUrl.clone();
  url.search = "";
  if (code) {
    const db = await userClient();
    const { error } = await db.auth.exchangeCodeForSession(code);
    url.pathname = error ? "/admin/login" : "/admin";
  } else url.pathname = "/admin/login";
  return NextResponse.redirect(url);
}
