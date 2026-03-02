"use client";

import { useActionState, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { setupTotp, enableTotp, type AuthState } from "@/app/(auth)/actions";
import { RecoveryCodesDisplay } from "./recovery-codes-display";

const initialState: AuthState = {};

export function Setup2faForm({ required }: { required: boolean }) {
  const router = useRouter();
  const [state, action, pending] = useActionState(enableTotp, initialState);
  const [totpData, setTotpData] = useState<{
    secret: string;
    qrCode: string;
  } | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setupTotp()
      .then(setTotpData)
      .finally(() => setLoading(false));
  }, []);

  if (loading) {
    return (
      <div className="max-w-2xl mx-auto">
        <div className="flex items-center justify-center py-20">
          <div className="flex items-center gap-3 text-text-muted">
            <svg
              className="animate-spin h-5 w-5"
              viewBox="0 0 24 24"
              fill="none"
            >
              <circle
                cx="12"
                cy="12"
                r="10"
                stroke="currentColor"
                strokeWidth="3"
                className="opacity-25"
              />
              <path
                d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"
                fill="currentColor"
                className="opacity-75"
              />
            </svg>
            <span className="text-sm">Generating secret...</span>
          </div>
        </div>
      </div>
    );
  }

  if (!totpData) {
    return (
      <div className="max-w-2xl mx-auto">
        <div className="text-center py-20">
          <p className="text-danger text-sm">
            Failed to generate 2FA secret. Please try again.
          </p>
          {!required && (
            <Link
              href="/settings"
              className="text-xs text-accent hover:text-accent/80 mt-4 inline-block"
            >
              Back to Settings
            </Link>
          )}
        </div>
      </div>
    );
  }

  // Show recovery codes after successful 2FA enablement
  if (state.recoveryCodes) {
    return (
      <div className="max-w-2xl mx-auto space-y-8 animate-fade-in-up">
        {/* Header */}
        <div>
          <div className="flex items-center gap-2 mb-2">
            <div className="h-px w-8 bg-accent/50" />
            <span className="text-[10px] font-medium text-accent tracking-[0.2em] uppercase">
              Security
            </span>
          </div>
          <h1 className="text-2xl font-semibold text-text-primary tracking-tight">
            2FA Enabled Successfully
          </h1>
          <p className="text-sm text-text-secondary mt-1">
            Save your recovery codes before continuing
          </p>
        </div>

        <RecoveryCodesDisplay
          codes={state.recoveryCodes}
          onConfirm={() => router.push(required ? "/dashboard" : "/settings")}
        />
      </div>
    );
  }

  return (
    <div className="max-w-2xl mx-auto space-y-8 animate-fade-in-up">
      {/* Mandatory banner */}
      {required && (
        <div className="flex items-center gap-3 bg-accent/10 border border-accent/20 rounded-lg px-4 py-3">
          <svg
            className="w-5 h-5 text-accent shrink-0"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
          </svg>
          <p className="text-sm text-text-primary">
            Your administrator requires two-factor authentication. Set up 2FA to continue using the platform.
          </p>
        </div>
      )}

      {/* Header */}
      <div>
        {!required && (
          <Link
            href="/settings"
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
            Settings
          </Link>
        )}
        <div className="flex items-center gap-2 mb-2">
          <div className="h-px w-8 bg-accent/50" />
          <span className="text-[10px] font-medium text-accent tracking-[0.2em] uppercase">
            Security
          </span>
        </div>
        <h1 className="text-2xl font-semibold text-text-primary tracking-tight">
          Enable Two-Factor Authentication
        </h1>
        <p className="text-sm text-text-secondary mt-1">
          Protect your account with an authenticator app
        </p>
      </div>

      {/* Step 1: QR Code */}
      <div className="relative bg-bg-surface/80 border border-border-default rounded-lg p-6">
        <div className="absolute top-0 left-6 right-6 h-px bg-gradient-to-r from-transparent via-border-default to-transparent" />
        <div className="flex items-center gap-2 mb-5">
          <span className="flex items-center justify-center w-5 h-5 rounded-full bg-accent/10 border border-accent/20 text-[10px] font-semibold text-accent">
            1
          </span>
          <h2 className="text-xs font-medium text-text-secondary uppercase tracking-wider">
            Scan QR Code
          </h2>
        </div>

        <p className="text-xs text-text-muted mb-4">
          Open your authenticator app (Google Authenticator, Authy, etc.) and
          scan this code
        </p>

        <div className="flex justify-center py-3">
          <div className="bg-bg-elevated border border-border-default rounded-lg p-3">
            <img
              src={totpData.qrCode}
              alt="TOTP QR Code"
              width={180}
              height={180}
              className="rounded"
            />
          </div>
        </div>

        <div className="mt-4">
          <p className="text-[10px] text-text-muted mb-1.5">
            Or enter this key manually:
          </p>
          <code className="block bg-bg-elevated border border-border-default rounded px-3 py-2 text-xs font-mono text-accent break-all select-all">
            {totpData.secret}
          </code>
        </div>
      </div>

      {/* Step 2: Verify */}
      <div className="relative bg-bg-surface/80 border border-border-default rounded-lg p-6">
        <div className="absolute top-0 left-6 right-6 h-px bg-gradient-to-r from-transparent via-border-default to-transparent" />
        <div className="flex items-center gap-2 mb-5">
          <span className="flex items-center justify-center w-5 h-5 rounded-full bg-accent/10 border border-accent/20 text-[10px] font-semibold text-accent">
            2
          </span>
          <h2 className="text-xs font-medium text-text-secondary uppercase tracking-wider">
            Verify Setup
          </h2>
        </div>

        <form action={action} className="space-y-4">
          <input type="hidden" name="secret" value={totpData.secret} />

          {state.error && (
            <div className="animate-shake flex items-center gap-2.5 bg-danger-dim/20 border border-danger/15 rounded-lg px-4 py-3 text-sm text-danger">
              <svg
                className="w-4 h-4 shrink-0"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <circle cx="12" cy="12" r="10" />
                <line x1="15" y1="9" x2="9" y2="15" />
                <line x1="9" y1="9" x2="15" y2="15" />
              </svg>
              {state.error}
            </div>
          )}

          <div>
            <label className="block text-[10px] font-mono font-medium text-text-secondary uppercase tracking-[0.15em] mb-1.5">
              Authenticator Code
            </label>
            <input
              name="code"
              type="text"
              inputMode="numeric"
              autoComplete="one-time-code"
              maxLength={6}
              required
              className="input-glow w-full bg-bg-elevated border border-border-default rounded-lg px-3 py-3 text-center text-lg font-mono tracking-[0.5em] text-text-primary placeholder:text-text-muted focus:outline-none transition-shadow duration-200"
              placeholder="000000"
            />
            {state.fieldErrors?.code && (
              <p className="text-xs text-danger mt-1 text-center">
                {state.fieldErrors.code[0]}
              </p>
            )}
          </div>

          <div>
            <label className="block text-[10px] font-mono font-medium text-text-secondary uppercase tracking-[0.15em] mb-1.5">
              Confirm Password
            </label>
            <input
              name="password"
              type="password"
              required
              className="input-glow w-full bg-bg-elevated border border-border-default rounded-lg px-3 py-2.5 text-sm text-text-primary placeholder:text-text-muted focus:outline-none transition-shadow duration-200"
              placeholder="Enter your password"
            />
            {state.fieldErrors?.password && (
              <p className="text-xs text-danger mt-1">
                {state.fieldErrors.password[0]}
              </p>
            )}
          </div>

          <div className="pt-1">
            <button
              type="submit"
              disabled={pending}
              className="btn-tactical w-full text-white font-semibold text-sm py-3 rounded-[10px] disabled:opacity-50 disabled:cursor-not-allowed disabled:active:scale-100 cursor-pointer"
            >
              {pending ? (
                <span className="relative z-10 flex items-center justify-center gap-2">
                  <svg
                    className="animate-spin h-4 w-4"
                    viewBox="0 0 24 24"
                    fill="none"
                  >
                    <circle
                      cx="12"
                      cy="12"
                      r="10"
                      stroke="currentColor"
                      strokeWidth="3"
                      className="opacity-25"
                    />
                    <path
                      d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"
                      fill="currentColor"
                      className="opacity-75"
                    />
                  </svg>
                  Verifying...
                </span>
              ) : (
                <span className="relative z-10 flex items-center justify-center gap-2">
                  Enable 2FA
                  <svg
                    className="w-4 h-4"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  >
                    <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
                    <path d="M9 12l2 2 4-4" />
                  </svg>
                </span>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
