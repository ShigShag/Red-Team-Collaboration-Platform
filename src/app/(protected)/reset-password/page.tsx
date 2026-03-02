import { redirect } from "next/navigation";
import { eq } from "drizzle-orm";
import { db } from "@/db";
import { users } from "@/db/schema";
import { getSession } from "@/lib/auth/session";
import { ResetPasswordForm } from "./reset-password-form";

export default async function ResetPasswordPage() {
  const session = await getSession();
  if (!session) redirect("/login");

  const [user] = await db
    .select({ totpEnabled: users.totpEnabled })
    .from(users)
    .where(eq(users.id, session.userId))
    .limit(1);

  if (!user) redirect("/login");

  return (
    <div className="-mt-8 flex flex-col items-center justify-center min-h-[calc(100vh-7rem)]">
      <div className="w-full max-w-md space-y-6">
        {/* Warning banner */}
        <div className="relative bg-warning/5 border border-warning/30 rounded-lg p-4">
          <div className="flex items-start gap-3">
            <svg
              className="w-5 h-5 text-warning flex-shrink-0 mt-0.5"
              fill="none"
              viewBox="0 0 24 24"
              strokeWidth={1.5}
              stroke="currentColor"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126ZM12 15.75h.007v.008H12v-.008Z"
              />
            </svg>
            <div>
              <p className="text-sm font-medium text-warning">
                Password Reset Required
              </p>
              <p className="text-xs text-text-muted mt-1">
                An administrator has required you to change your password.
                Please set a new password below before continuing.
              </p>
            </div>
          </div>
        </div>

        {/* Password form card */}
        <div className="relative bg-bg-surface/80 border border-border-default rounded-lg p-6">
          <div className="absolute top-0 left-6 right-6 h-px bg-gradient-to-r from-transparent via-border-default to-transparent" />
          <h2 className="text-xs font-medium text-text-secondary uppercase tracking-wider mb-6">
            Set New Password
          </h2>
          <ResetPasswordForm totpEnabled={user.totpEnabled} />
        </div>
      </div>
    </div>
  );
}
