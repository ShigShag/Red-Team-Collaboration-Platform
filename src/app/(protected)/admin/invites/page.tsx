import Link from "next/link";
import { getInviteCodes } from "../actions";
import { InviteForm } from "./invite-form";

export default async function AdminInvitesPage() {
  const codes = await getInviteCodes();

  const activeCodes = codes.filter(
    (c) => !c.usedBy && new Date(c.expiresAt) > new Date()
  );
  const usedCodes = codes.filter((c) => c.usedBy);
  const expiredCodes = codes.filter(
    (c) => !c.usedBy && new Date(c.expiresAt) <= new Date()
  );

  return (
    <div className="max-w-3xl mx-auto space-y-8 animate-fade-in-up">
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
            Provisioning
          </span>
        </div>
        <h1 className="text-2xl font-semibold text-text-primary tracking-tight">
          Invite Codes
        </h1>
      </div>

      {/* Generate Code */}
      <div className="relative bg-bg-surface/80 border border-border-default rounded-lg p-6">
        <div className="absolute top-0 left-6 right-6 h-px bg-gradient-to-r from-transparent via-border-default to-transparent" />
        <h2 className="text-xs font-medium text-text-secondary uppercase tracking-wider mb-4">
          Generate New Code
        </h2>
        <InviteForm />
      </div>

      {/* Active Codes */}
      <div className="relative bg-bg-surface/80 border border-border-default rounded-lg p-6">
        <div className="absolute top-0 left-6 right-6 h-px bg-gradient-to-r from-transparent via-border-default to-transparent" />
        <h2 className="text-xs font-medium text-text-secondary uppercase tracking-wider mb-4">
          Active Codes ({activeCodes.length})
        </h2>
        {activeCodes.length === 0 ? (
          <p className="text-sm text-text-muted">No active invite codes</p>
        ) : (
          <div className="space-y-3">
            {activeCodes.map((code) => (
              <div
                key={code.id}
                className="flex items-center justify-between gap-4 p-3 rounded-lg border border-border-default"
              >
                <div className="min-w-0">
                  <code className="text-xs font-mono text-accent break-all">
                    {code.code}
                  </code>
                  <div className="flex items-center gap-3 mt-1">
                    <span className="text-[10px] text-text-muted">
                      by @{code.creatorUsername}
                    </span>
                    <span className="text-[10px] text-text-muted">
                      expires{" "}
                      {new Date(code.expiresAt).toLocaleDateString("en-US", {
                        month: "short",
                        day: "numeric",
                        hour: "2-digit",
                        minute: "2-digit",
                      })}
                    </span>
                  </div>
                </div>
                <InviteForm revokeCodeId={code.id} />
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Used Codes */}
      {usedCodes.length > 0 && (
        <div className="relative bg-bg-surface/80 border border-border-default rounded-lg p-6">
          <div className="absolute top-0 left-6 right-6 h-px bg-gradient-to-r from-transparent via-border-default to-transparent" />
          <h2 className="text-xs font-medium text-text-secondary uppercase tracking-wider mb-4">
            Used Codes ({usedCodes.length})
          </h2>
          <div className="space-y-3">
            {usedCodes.map((code) => (
              <div
                key={code.id}
                className="flex items-center justify-between gap-4 p-3 rounded-lg border border-border-default opacity-60"
              >
                <div className="min-w-0">
                  <code className="text-xs font-mono text-text-muted break-all">
                    {code.code}
                  </code>
                  <div className="flex items-center gap-3 mt-1">
                    <span className="text-[10px] text-text-muted">
                      by @{code.creatorUsername}
                    </span>
                    <span className="text-[10px] text-green-500">
                      used{" "}
                      {code.usedAt
                        ? new Date(code.usedAt).toLocaleDateString("en-US", {
                            month: "short",
                            day: "numeric",
                          })
                        : ""}
                    </span>
                  </div>
                </div>
                <span className="px-2 py-1 text-[9px] font-medium uppercase tracking-wider bg-green-500/10 text-green-500 border border-green-500/20 rounded">
                  Used
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Expired Codes */}
      {expiredCodes.length > 0 && (
        <div className="relative bg-bg-surface/80 border border-border-default rounded-lg p-6">
          <div className="absolute top-0 left-6 right-6 h-px bg-gradient-to-r from-transparent via-border-default to-transparent" />
          <h2 className="text-xs font-medium text-text-secondary uppercase tracking-wider mb-4">
            Expired Codes ({expiredCodes.length})
          </h2>
          <div className="space-y-3">
            {expiredCodes.map((code) => (
              <div
                key={code.id}
                className="flex items-center justify-between gap-4 p-3 rounded-lg border border-border-default opacity-40"
              >
                <div className="min-w-0">
                  <code className="text-xs font-mono text-text-muted break-all">
                    {code.code}
                  </code>
                  <div className="flex items-center gap-3 mt-1">
                    <span className="text-[10px] text-text-muted">
                      by @{code.creatorUsername}
                    </span>
                    <span className="text-[10px] text-danger">
                      expired{" "}
                      {new Date(code.expiresAt).toLocaleDateString("en-US", {
                        month: "short",
                        day: "numeric",
                      })}
                    </span>
                  </div>
                </div>
                <span className="px-2 py-1 text-[9px] font-medium uppercase tracking-wider bg-danger/10 text-danger border border-danger/20 rounded">
                  Expired
                </span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
