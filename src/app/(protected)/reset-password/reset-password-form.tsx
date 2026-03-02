"use client";

import { useState, useEffect, useActionState } from "react";
import { changePassword, type SettingsState } from "@/app/(protected)/settings/actions";
import { logout } from "@/app/(auth)/actions";
import { PasswordRequirements } from "@/components/password-requirements";

const initialState: SettingsState = {};

export function ResetPasswordForm({ totpEnabled }: { totpEnabled: boolean }) {
  const [showCurrent, setShowCurrent] = useState(false);
  const [showNew, setShowNew] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [newPassword, setNewPassword] = useState("");
  const [state, action, pending] = useActionState(changePassword, initialState);

  // On success, hard-navigate to dashboard (so proxy sees the cleared cookie)
  useEffect(() => {
    if (state.success) {
      window.location.href = "/dashboard";
    }
  }, [state.success]);

  return (
    <form action={action} className="space-y-4">
      {state.error && (
        <div className="animate-slide-in-left bg-danger-dim/30 border border-danger/20 rounded px-3 py-2 text-sm text-danger">
          {state.error}
        </div>
      )}

      {/* Current password */}
      <div className="space-y-1.5">
        <label
          htmlFor="currentPassword"
          className="block text-xs font-medium text-text-secondary uppercase tracking-wider"
        >
          Current Password
        </label>
        <div className="relative">
          <input
            id="currentPassword"
            name="currentPassword"
            type={showCurrent ? "text" : "password"}
            required
            className="input-glow w-full bg-bg-elevated border border-border-default rounded px-3 py-2.5 text-sm text-text-primary placeholder:text-text-muted focus:outline-none transition-shadow duration-200 pr-10"
            placeholder="Enter current password"
          />
          <button
            type="button"
            onClick={() => setShowCurrent(!showCurrent)}
            className="absolute right-3 top-1/2 -translate-y-1/2 text-text-muted hover:text-text-secondary transition-colors cursor-pointer"
          >
            {showCurrent ? (
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" d="M3.98 8.223A10.477 10.477 0 001.934 12C3.226 16.338 7.244 19.5 12 19.5c.993 0 1.953-.138 2.863-.395M6.228 6.228A10.45 10.45 0 0112 4.5c4.756 0 8.773 3.162 10.065 7.498a10.523 10.523 0 01-4.293 5.774M6.228 6.228L3 3m3.228 3.228l3.65 3.65m7.894 7.894L21 21m-3.228-3.228l-3.65-3.65m0 0a3 3 0 10-4.243-4.243m4.242 4.242L9.88 9.88" />
              </svg>
            ) : (
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" d="M2.036 12.322a1.012 1.012 0 010-.639C3.423 7.51 7.36 4.5 12 4.5c4.638 0 8.573 3.007 9.963 7.178.07.207.07.431 0 .639C20.577 16.49 16.64 19.5 12 19.5c-4.638 0-8.573-3.007-9.963-7.178z" />
                <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
              </svg>
            )}
          </button>
        </div>
        {state.fieldErrors?.currentPassword && (
          <p className="text-xs text-danger">{state.fieldErrors.currentPassword[0]}</p>
        )}
      </div>

      {/* New password */}
      <div className="space-y-1.5">
        <label
          htmlFor="newPassword"
          className="block text-xs font-medium text-text-secondary uppercase tracking-wider"
        >
          New Password
        </label>
        <div className="relative">
          <input
            id="newPassword"
            name="newPassword"
            type={showNew ? "text" : "password"}
            required
            minLength={12}
            maxLength={128}
            className="input-glow w-full bg-bg-elevated border border-border-default rounded px-3 py-2.5 text-sm text-text-primary placeholder:text-text-muted focus:outline-none transition-shadow duration-200 pr-10"
            placeholder="At least 12 characters"
            onChange={(e) => setNewPassword(e.target.value)}
          />
          <button
            type="button"
            onClick={() => setShowNew(!showNew)}
            className="absolute right-3 top-1/2 -translate-y-1/2 text-text-muted hover:text-text-secondary transition-colors cursor-pointer"
          >
            {showNew ? (
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" d="M3.98 8.223A10.477 10.477 0 001.934 12C3.226 16.338 7.244 19.5 12 19.5c.993 0 1.953-.138 2.863-.395M6.228 6.228A10.45 10.45 0 0112 4.5c4.756 0 8.773 3.162 10.065 7.498a10.523 10.523 0 01-4.293 5.774M6.228 6.228L3 3m3.228 3.228l3.65 3.65m7.894 7.894L21 21m-3.228-3.228l-3.65-3.65m0 0a3 3 0 10-4.243-4.243m4.242 4.242L9.88 9.88" />
              </svg>
            ) : (
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" d="M2.036 12.322a1.012 1.012 0 010-.639C3.423 7.51 7.36 4.5 12 4.5c4.638 0 8.573 3.007 9.963 7.178.07.207.07.431 0 .639C20.577 16.49 16.64 19.5 12 19.5c-4.638 0-8.573-3.007-9.963-7.178z" />
                <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
              </svg>
            )}
          </button>
        </div>
        {state.fieldErrors?.newPassword && (
          <p className="text-xs text-danger">{state.fieldErrors.newPassword[0]}</p>
        )}
        {newPassword.length > 0 && (
          <div className="animate-fade-in pt-1">
            <PasswordRequirements password={newPassword} />
          </div>
        )}
      </div>

      {/* Confirm new password */}
      <div className="space-y-1.5">
        <label
          htmlFor="confirmNewPassword"
          className="block text-xs font-medium text-text-secondary uppercase tracking-wider"
        >
          Confirm New Password
        </label>
        <div className="relative">
          <input
            id="confirmNewPassword"
            name="confirmNewPassword"
            type={showConfirm ? "text" : "password"}
            required
            className="input-glow w-full bg-bg-elevated border border-border-default rounded px-3 py-2.5 text-sm text-text-primary placeholder:text-text-muted focus:outline-none transition-shadow duration-200 pr-10"
            placeholder="Confirm new password"
          />
          <button
            type="button"
            onClick={() => setShowConfirm(!showConfirm)}
            className="absolute right-3 top-1/2 -translate-y-1/2 text-text-muted hover:text-text-secondary transition-colors cursor-pointer"
          >
            {showConfirm ? (
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" d="M3.98 8.223A10.477 10.477 0 001.934 12C3.226 16.338 7.244 19.5 12 19.5c.993 0 1.953-.138 2.863-.395M6.228 6.228A10.45 10.45 0 0112 4.5c4.756 0 8.773 3.162 10.065 7.498a10.523 10.523 0 01-4.293 5.774M6.228 6.228L3 3m3.228 3.228l3.65 3.65m7.894 7.894L21 21m-3.228-3.228l-3.65-3.65m0 0a3 3 0 10-4.243-4.243m4.242 4.242L9.88 9.88" />
              </svg>
            ) : (
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" d="M2.036 12.322a1.012 1.012 0 010-.639C3.423 7.51 7.36 4.5 12 4.5c4.638 0 8.573 3.007 9.963 7.178.07.207.07.431 0 .639C20.577 16.49 16.64 19.5 12 19.5c-4.638 0-8.573-3.007-9.963-7.178z" />
                <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
              </svg>
            )}
          </button>
        </div>
        {state.fieldErrors?.confirmNewPassword && (
          <p className="text-xs text-danger">{state.fieldErrors.confirmNewPassword[0]}</p>
        )}
      </div>

      {/* TOTP code (only if 2FA is enabled) */}
      {totpEnabled && (
        <div className="space-y-1.5">
          <label
            htmlFor="totpCode"
            className="block text-xs font-medium text-text-secondary uppercase tracking-wider"
          >
            2FA Code
          </label>
          <input
            id="totpCode"
            name="totpCode"
            type="text"
            inputMode="numeric"
            pattern="\d{6}"
            maxLength={6}
            required
            autoComplete="one-time-code"
            className="input-glow w-full bg-bg-elevated border border-border-default rounded px-3 py-2.5 text-sm text-text-primary placeholder:text-text-muted focus:outline-none transition-shadow duration-200 font-mono tracking-widest"
            placeholder="000000"
          />
          <p className="text-[11px] text-text-muted">
            Enter the code from your authenticator app
          </p>
        </div>
      )}

      <div className="flex gap-2 justify-between items-center pt-2">
        <button
          type="button"
          onClick={async () => {
            await logout();
            window.location.href = "/login";
          }}
          className="text-sm text-text-muted hover:text-danger transition-colors cursor-pointer"
        >
          Sign Out
        </button>
        <button
          type="submit"
          disabled={pending}
          className="btn-shimmer bg-accent hover:bg-accent/90 active:scale-[0.97] text-white font-semibold text-sm px-6 py-2 rounded transition-all duration-100 disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer"
        >
          {pending ? "Changing..." : "Change Password"}
        </button>
      </div>
    </form>
  );
}
