import { redirect } from "next/navigation";
import { cookies } from "next/headers";
import { getSession } from "@/lib/auth/session";
import { getSetting } from "@/lib/platform-settings";
import { UserMenu } from "./components/user-menu";
import { NavLinks } from "./components/nav-links";
import { SearchTrigger } from "./components/search-trigger";
import { NotificationBell } from "./components/notification-bell";
import { OnboardingChecklist } from "./components/onboarding-checklist";

export default async function ProtectedLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await getSession();
  if (!session) redirect("/login");

  // Check if 2FA setup is being forced (cookie set during login/register)
  const cookieStore = await cookies();
  const force2fa = cookieStore.get("force_2fa_setup")?.value === "1";
  const locked = session.passwordResetRequired || force2fa;

  return (
    <div className="min-h-screen bg-bg-primary">
      {/* Top nav */}
      <nav className="relative z-50 border-b border-border-default bg-bg-secondary/80 backdrop-blur-sm">
        <div className="max-w-7xl mx-auto px-6 h-14 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-2 h-2 rounded-full bg-accent animate-pulse-glow" />
            <span className="text-sm font-semibold text-text-primary tracking-wide">
              RedTeam
            </span>
            <div className="h-4 w-px bg-border-default mx-1" />
            <span className="text-xs text-text-muted">
              Operator Console
            </span>
          </div>

          {!locked && (
            <NavLinks isAdmin={session.isAdmin} />
          )}

          <div className="flex items-center gap-3">
            {!locked && <SearchTrigger />}
            {!locked && <NotificationBell />}
            <UserMenu
              username={session.username}
              displayName={session.displayName}
              avatarUrl={
                session.avatarPath
                  ? `/api/avatar/${session.userId}`
                  : null
              }
              totpEnabled={session.totpEnabled}
              isAdmin={session.isAdmin}
              locked={locked}
            />
          </div>
        </div>
      </nav>

      {/* Content */}
      <main className="max-w-7xl mx-auto px-6 py-8">{children}</main>

      {/* Onboarding checklist popup */}
      {!locked && !session.onboardingDismissedAt &&
        (!session.totpEnabled || !session.displayName || !session.avatarPath) && (
          <OnboardingChecklist
            totpEnabled={session.totpEnabled}
            hasDisplayName={!!session.displayName}
            hasAvatar={!!session.avatarPath}
          />
        )}
    </div>
  );
}
