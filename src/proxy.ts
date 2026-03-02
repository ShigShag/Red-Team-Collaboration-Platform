import { NextRequest, NextResponse } from "next/server";

const PUBLIC_ROUTES = ["/login", "/register"];
// Signed token: {64 hex}.{64 hex HMAC}
const SIGNED_TOKEN_RE = /^[0-9a-f]{64}\.[0-9a-f]{64}$/;
// Legacy unsigned token (transition period): bare 64-char hex
const LEGACY_TOKEN_RE = /^[0-9a-f]{64}$/;

function isValidTokenFormat(token: string): boolean {
  return SIGNED_TOKEN_RE.test(token) || LEGACY_TOKEN_RE.test(token);
}

export function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const ip = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "-";
  console.log(`${ip} ${request.method} ${pathname}`);
  const sessionToken = request.cookies.get("session_token")?.value;

  const isPublicRoute = PUBLIC_ROUTES.some(
    (route) => pathname === route || pathname.startsWith(route + "/")
  );

  // Authenticated users on public routes: let the page handle the redirect
  // (cookie may be stale if the session was revoked server-side)
  if (isPublicRoute) {
    return NextResponse.next();
  }

  // Redirect unauthenticated users or structurally invalid tokens to login
  if (!sessionToken || !isValidTokenFormat(sessionToken)) {
    const loginUrl = new URL("/login", request.url);
    if (pathname !== "/") {
      loginUrl.searchParams.set("from", pathname);
    }
    return NextResponse.redirect(loginUrl);
  }

  // Force-password-reset: redirect to dedicated page (cookie set at login, cleared on password change)
  const forceReset = request.cookies.get("force_password_reset")?.value;
  if (forceReset === "1" && !pathname.startsWith("/reset-password")) {
    return NextResponse.redirect(new URL("/reset-password", request.url));
  }

  // Force-2fa-setup: redirect to 2FA setup page (cookie set at login/register, cleared on TOTP enablement)
  const force2fa = request.cookies.get("force_2fa_setup")?.value;
  if (force2fa === "1" && !pathname.startsWith("/setup-2fa")) {
    return NextResponse.redirect(new URL("/setup-2fa", request.url));
  }

  return NextResponse.next();
}

export const config = {
  matcher: [
    /*
     * Match all routes except:
     * - api routes
     * - _next (static files)
     * - favicon, images, etc.
     */
    "/((?!api|_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
  ],
};
