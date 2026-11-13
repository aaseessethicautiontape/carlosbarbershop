import "server-only";
import { redirect } from "next/navigation";
import { userClient } from "@/lib/supabase/server";
import type { AppRole, Row } from "@/lib/supabase/types";

export interface StaffSession { userId: string; email: string | undefined; profile: Row<"profiles"> }

/** Validated against the Auth server (getUser), never trusting the cookie alone. */
export async function getStaff(): Promise<StaffSession | null> {
  const db = await userClient();
  const { data: { user } } = await db.auth.getUser();
  if (!user) return null;
  const { data: profile } = await db.from("profiles").select("*").eq("id", user.id).maybeSingle();
  if (!profile) return null;
  return { userId: user.id, email: user.email, profile };
}

/** For admin PAGES: send visitors without a staff profile to the login screen. */
export async function requireStaff(roles: AppRole[] = ["owner", "barber"]): Promise<StaffSession> {
  const s = await getStaff();
  if (!s) redirect("/admin/login");
  if (!roles.includes(s.profile.role)) redirect("/admin?denied=1");
  return s;
}

export type Authz = { ok: true; staff: StaffSession } | { ok: false; error: string };

/** For admin SERVER ACTIONS: every action calls this first (middleware is not enough). */
export async function authorize(roles: AppRole[] = ["owner", "barber"]): Promise<Authz> {
  const s = await getStaff();
  if (!s) return { ok: false, error: "Please sign in again." };
  if (!roles.includes(s.profile.role)) return { ok: false, error: "Only the owner can do that." };
  return { ok: true, staff: s };
}
