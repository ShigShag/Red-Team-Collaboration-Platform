import { redirect } from "next/navigation";
import Link from "next/link";
import { eq } from "drizzle-orm";
import { db } from "@/db";
import { users } from "@/db/schema";
import { getSession } from "@/lib/auth/session";
import { ProfileForm } from "./profile-form";
import { ChangePassword } from "./change-password";
import { RecoveryCodes } from "./recovery-codes";
import { DangerZone } from "./danger-zone";
import { getRecoveryCodeCount } from "@/lib/auth/recovery-codes";

export default async function SettingsPage() {
  const session = await getSession();
  if (!session) redirect("/login");

  const [user] = await db
    .select({
      id: users.id,
      username: users.username,
      displayName: users.displayName,
      avatarPath: users.avatarPath,
      totpEnabled: users.totpEnabled,
      createdAt: users.createdAt,
    })
    .from(users)
    .where(eq(users.id, session.userId))
    .limit(1);

  if (!user) redirect("/login");

  const recoveryCodeCount = user.totpEnabled
    ? await getRecoveryCodeCount(session.userId)
    : 0;

  return (
    <div className="max-w-2xl mx-auto space-y-8 animate-fade-in-up">
      {/* Header */}
      <div>
        <Link
          href="/dashboard"
          className="inline-flex items-center gap-2 text-sm text-text-muted hover:text-text-secondary transition-colors duration-100 mb-4"
        >
          <svg
            className="w-4 h-4"
            fill="none"
            viewBox="0 0 24 24"
            strokeWidth={1.5}
            stroke="currentColor"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              d="M10.5 19.5L3 12m0 0l7.5-7.5M3 12h18"
            />
          </svg>
          Back
        </Link>
        <div className="flex items-center gap-2 mb-2">
          <div className="h-px w-8 bg-accent/50" />
          <span className="text-[10px] font-medium text-accent tracking-[0.2em] uppercase">
            Account
          </span>
        </div>
        <h1 className="text-2xl font-semibold text-text-primary tracking-tight">
          Settings
        </h1>
      </div>

      {/* Profile */}
      <div className="relative bg-bg-surface/80 border border-border-default rounded-lg p-6">
        <div className="absolute top-0 left-6 right-6 h-px bg-gradient-to-r from-transparent via-border-default to-transparent" />
        <h2 className="text-xs font-medium text-text-secondary uppercase tracking-wider mb-6">
          Profile
        </h2>
        <ProfileForm
          username={user.username}
          displayName={user.displayName}
          avatarUrl={
            user.avatarPath ? `/api/avatar/${user.id}` : null
          }
        />
      </div>

      {/* Security */}
      <div className="relative bg-bg-surface/80 border border-border-default rounded-lg p-6">
        <div className="absolute top-0 left-6 right-6 h-px bg-gradient-to-r from-transparent via-border-default to-transparent" />
        <h2 className="text-xs font-medium text-text-secondary uppercase tracking-wider mb-6">
          Security
        </h2>
        <div className="space-y-4">
          <ChangePassword totpEnabled={user.totpEnabled} />

          <div className="pt-4 border-t border-border-default space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-text-primary">
                  Two-Factor Authentication
                </p>
                <p className="text-xs text-text-muted mt-0.5">
                  {user.totpEnabled
                    ? "Your account is protected with 2FA"
                    : "Add an extra layer of security"}
                </p>
              </div>
              {user.totpEnabled ? (
                <span className="flex items-center gap-1.5 text-xs font-medium text-accent">
                  <div className="w-1.5 h-1.5 rounded-full bg-accent" />
                  Enabled
                </span>
              ) : (
                <Link
                  href="/setup-2fa"
                  className="text-xs font-medium text-accent hover:text-accent/80 transition-colors"
                >
                  Enable
                </Link>
              )}
            </div>
            {user.totpEnabled && (
              <RecoveryCodes initialCount={recoveryCodeCount} />
            )}
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-text-primary">Account Created</p>
                <p className="text-xs text-text-muted mt-0.5">
                  {user.createdAt.toLocaleDateString("en-US", {
                    year: "numeric",
                    month: "long",
                    day: "numeric",
                  })}
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Danger zone */}
      <div className="relative bg-bg-surface/80 border border-danger/20 rounded-lg p-6">
        <div className="absolute top-0 left-6 right-6 h-px bg-gradient-to-r from-transparent via-danger/20 to-transparent" />
        <h2 className="text-xs font-medium text-danger uppercase tracking-wider mb-6">
          Danger Zone
        </h2>
        <DangerZone />
      </div>
    </div>
  );
}
