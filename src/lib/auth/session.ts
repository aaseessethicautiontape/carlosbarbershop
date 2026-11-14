import "server-only";
import { redirect } from "next/navigation";
import { neonAuth } from "@/lib/auth/neon";
import { one } from "@/lib/db";
import type { AppRole, Row } from "@/lib/dbtypes/types";

export interface StaffSession { userId: string; email: string | undefined; profile: Row<"profiles"> }

/** Session comes from the Neon Auth cookie; staff status comes from the profiles table (no profile = no access). */
export async function getStaff(): Promise<StaffSession | null> {
  let userId: string | undefined;
  let email: string | undefined;
  try {
    const { data } = await neonAuth().getSession();
    userId = data?.user?.id;
    email = data?.user?.email;
  } catch {
    return null;
  }
  if (!userId || !/^[0-9a-f-]{36}$/i.test(userId)) return null;
  const profile = await one<Row<"profiles">>("select * from profiles where id = $1::uuid", [userId]);
  return profile ? { userId, email, profile } : null;
}

/** For admin PAGES: send visitors without a staff profile to the login screen. */
export async function requireStaff(roles: AppRole[] = ["owner", "barber"]): Promise<StaffSession> {
  const s = await getStaff();
  if (!s) redirect("/admin/login");
  if (!roles.includes(s.profile.role)) redirect("/admin?denied=1");
  return s;
}

export type Authz = { ok: true; staff: StaffSession } | { ok: false; error: string };

/** For admin SERVER ACTIONS: every action calls this first (this is the real gate: the DB client bypasses RLS). */
export async function authorize(roles: AppRole[] = ["owner", "barber"]): Promise<Authz> {
  const s = await getStaff();
  if (!s) return { ok: false, error: "Please sign in again." };
  if (!roles.includes(s.profile.role)) return { ok: false, error: "Only the owner can do that." };
  return { ok: true, staff: s };
}
