import { getSession } from "@/lib/auth/session";
import { redirect } from "next/navigation";
import { NextResponse } from "next/server";

/**
 * For use in Server Components and Server Actions.
 * Returns the session if the user is admin, otherwise redirects.
 */
export async function requireAdmin() {
  const session = await getSession();
  if (!session) redirect("/login");
  if (!session.isAdmin) redirect("/dashboard");
  return session;
}

/**
 * For use in API routes (Route Handlers).
 * Returns the session if admin, or a 401/403 JSON response.
 */
export async function requireAdminApi() {
  const session = await getSession();
  if (!session) {
    return {
      session: null as null,
      error: NextResponse.json({ error: "Unauthorized" }, { status: 401 }),
    };
  }
  if (!session.isAdmin) {
    return {
      session: null as null,
      error: NextResponse.json({ error: "Forbidden" }, { status: 403 }),
    };
  }
  return { session, error: null as null };
}
