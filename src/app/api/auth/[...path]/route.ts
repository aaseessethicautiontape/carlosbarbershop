import { neonAuth } from "@/lib/auth/neon";

export const dynamic = "force-dynamic";

// Proxies Neon Auth requests (sign-in, sign-out, session) through this app's origin so cookies are first-party.
export const GET = (req: Request, ctx: { params: Promise<{ path: string[] }> }) => neonAuth().handler().GET(req, ctx);
export const POST = (req: Request, ctx: { params: Promise<{ path: string[] }> }) => neonAuth().handler().POST(req, ctx);
