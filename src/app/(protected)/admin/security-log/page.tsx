import Link from "next/link";
import { getSecurityLog } from "../actions";

const EVENT_LABELS: Record<string, { label: string; color: string }> = {
  user_registered: { label: "Registered", color: "text-green-500" },
  login_success: { label: "Login", color: "text-green-500" },
  login_failed: { label: "Login Failed", color: "text-danger" },
  totp_login_success: { label: "2FA Login", color: "text-green-500" },
  totp_invalid_code: { label: "Invalid 2FA", color: "text-danger" },
  totp_decryption_failed: { label: "2FA Decrypt Fail", color: "text-danger" },
  file_decryption_failed: { label: "File Decrypt Fail", color: "text-danger" },
  totp_enabled: { label: "2FA Enabled", color: "text-accent" },
  totp_enable_password_failed: { label: "2FA Enable Fail", color: "text-danger" },
  password_changed: { label: "Password Changed", color: "text-accent" },
  password_change_failed: { label: "Password Change Fail", color: "text-danger" },
  password_change_totp_failed: { label: "Password Change 2FA Fail", color: "text-danger" },
  password_change_decrypt_failed: { label: "Password Decrypt Fail", color: "text-danger" },
  account_deleted: { label: "Account Deleted", color: "text-danger" },
  account_delete_failed: { label: "Delete Failed", color: "text-danger" },
  recovery_code_login: { label: "Recovery Login", color: "text-warning" },
  recovery_codes_generated: { label: "Recovery Generated", color: "text-accent" },
  recovery_codes_regenerated: { label: "Recovery Regenerated", color: "text-accent" },
  recovery_code_login_failed: { label: "Recovery Failed", color: "text-danger" },
  admin_user_disabled: { label: "User Disabled", color: "text-warning" },
  admin_user_enabled: { label: "User Enabled", color: "text-green-500" },
  admin_user_deleted: { label: "User Deleted", color: "text-danger" },
  admin_force_password_reset: { label: "Force Reset", color: "text-warning" },
  admin_grant_admin: { label: "Admin Granted", color: "text-accent" },
  admin_revoke_admin: { label: "Admin Revoked", color: "text-warning" },
  admin_settings_changed: { label: "Settings Changed", color: "text-accent" },
};

export default async function AdminSecurityLogPage({
  searchParams,
}: {
  searchParams: Promise<{ page?: string }>;
}) {
  const params = await searchParams;
  const page = Math.max(1, parseInt(params.page || "1", 10));
  const { events, total, pageSize } = await getSecurityLog(page);
  const totalPages = Math.ceil(total / pageSize);

  return (
    <div className="max-w-5xl mx-auto space-y-8 animate-fade-in-up">
      {/* Header */}
      <div>
        <Link
          href="/admin"
          className="inline-flex items-center gap-2 text-sm text-text-muted hover:text-text-secondary transition-colors duration-100 mb-4"
        >
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" d="M10.5 19.5L3 12m0 0l7.5-7.5M3 12h18" />
          </svg>
          Admin
        </Link>
        <div className="flex items-center gap-2 mb-2">
          <div className="h-px w-8 bg-accent/50" />
          <span className="text-[10px] font-medium text-accent tracking-[0.2em] uppercase">
            Audit Trail
          </span>
        </div>
        <h1 className="text-2xl font-semibold text-text-primary tracking-tight">
          Security Log
        </h1>
        <p className="text-sm text-text-muted mt-1">
          {total} event{total !== 1 ? "s" : ""} recorded
        </p>
      </div>

      {/* Events Table */}
      <div className="relative bg-bg-surface/80 border border-border-default rounded-lg overflow-hidden">
        <div className="absolute top-0 left-6 right-6 h-px bg-gradient-to-r from-transparent via-border-default to-transparent" />

        {/* Table Header */}
        <div className="grid grid-cols-[120px_1fr_140px_120px_1fr] gap-3 px-6 py-3 border-b border-border-default">
          <span className="text-[10px] font-medium text-text-muted uppercase tracking-wider">
            Time
          </span>
          <span className="text-[10px] font-medium text-text-muted uppercase tracking-wider">
            Event
          </span>
          <span className="text-[10px] font-medium text-text-muted uppercase tracking-wider">
            User
          </span>
          <span className="text-[10px] font-medium text-text-muted uppercase tracking-wider">
            IP Address
          </span>
          <span className="text-[10px] font-medium text-text-muted uppercase tracking-wider">
            Details
          </span>
        </div>

        {/* Event Rows */}
        {events.map((event) => {
          const info = EVENT_LABELS[event.eventType] || {
            label: event.eventType,
            color: "text-text-muted",
          };
          const meta = event.metadata as Record<string, unknown> | null;

          return (
            <div
              key={event.id}
              className="grid grid-cols-[120px_1fr_140px_120px_1fr] gap-3 px-6 py-2.5 border-b border-border-default last:border-b-0 hover:bg-bg-elevated/50 transition-colors"
            >
              <span className="text-[11px] font-mono text-text-muted">
                {new Date(event.createdAt).toLocaleString("en-US", {
                  month: "short",
                  day: "numeric",
                  hour: "2-digit",
                  minute: "2-digit",
                  second: "2-digit",
                })}
              </span>
              <span className={`text-xs font-medium ${info.color}`}>
                {info.label}
              </span>
              <span className="text-xs text-text-secondary truncate">
                {event.username ? `@${event.username}` : "—"}
              </span>
              <span className="text-[11px] font-mono text-text-muted">
                {event.ipAddress || "—"}
              </span>
              <span className="text-[10px] text-text-muted truncate">
                {meta && Object.keys(meta).length > 0
                  ? Object.entries(meta)
                      .map(([k, v]) => `${k}: ${v}`)
                      .join(", ")
                  : "—"}
              </span>
            </div>
          );
        })}

        {events.length === 0 && (
          <div className="px-6 py-8 text-center text-sm text-text-muted">
            No security events recorded
          </div>
        )}
      </div>

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-center gap-2">
          {page > 1 && (
            <Link
              href={`/admin/security-log?page=${page - 1}`}
              className="px-3 py-1.5 text-xs text-text-muted hover:text-text-secondary bg-bg-surface border border-border-default rounded-lg transition-colors"
            >
              Previous
            </Link>
          )}
          <span className="text-xs text-text-muted">
            Page {page} of {totalPages}
          </span>
          {page < totalPages && (
            <Link
              href={`/admin/security-log?page=${page + 1}`}
              className="px-3 py-1.5 text-xs text-text-muted hover:text-text-secondary bg-bg-surface border border-border-default rounded-lg transition-colors"
            >
              Next
            </Link>
          )}
        </div>
      )}
    </div>
  );
}
