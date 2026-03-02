"use client";

import { useActionState, useEffect, useState } from "react";
import Link from "next/link";
import { Captchacat } from "@captchacat/nextjs";
import { login, verifyTotpLogin, verifyRecoveryCodeLogin, type AuthState } from "../actions";

const initialState: AuthState = {};

export function LoginForm({ captchaSiteKey, captchaEnabled, registrationEnabled }: { captchaSiteKey: string; captchaEnabled: boolean; registrationEnabled: boolean }) {
  const [loginState, loginAction, loginPending] = useActionState(
    login,
    initialState
  );
  const [totpState, totpAction, totpPending] = useActionState(
    verifyTotpLogin,
    initialState
  );
  const [recoveryState, recoveryAction, recoveryPending] = useActionState(
    verifyRecoveryCodeLogin,
    initialState
  );
  const [show2fa, setShow2fa] = useState(false);
  const [useRecoveryCode, setUseRecoveryCode] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [isVerified, setIsVerified] = useState(!captchaEnabled);

  useEffect(() => {
    if (loginState.needs2fa) {
      setShow2fa(true);
    }
  }, [loginState.needs2fa]);

  return (
    <div>
      {/* Header */}
      <div className="mb-7 stagger-1">
        <div className="flex items-center gap-3 mb-3">
          <div className="h-px w-10 bg-gradient-to-r from-accent to-transparent" />
          <span className="text-[10px] font-mono font-medium text-accent tracking-[0.25em] uppercase">
            {show2fa ? "// Verification" : "// Authentication"}
          </span>
        </div>
        <h1 className="text-3xl font-bold text-text-primary tracking-tight">
          {show2fa ? "Verify Identity" : "Sign In"}
        </h1>
        <p className="text-sm text-text-secondary mt-1.5 font-mono typing-cursor">
          {show2fa
            ? useRecoveryCode
              ? "Enter a recovery code"
              : "Enter your authenticator code"
            : "Access your operator console"}
        </p>
      </div>

      {/* Glass Card */}
      <div className="glass-card p-6 stagger-2">
        {!show2fa ? (
          /* ===== Login Form ===== */
          <form action={loginAction} className="space-y-5">
            {loginState.error && (
              <div className="animate-shake flex items-center gap-2.5 bg-danger-dim/20 border border-danger/15 rounded-xl px-4 py-3 text-sm text-danger">
                <svg className="w-4 h-4 shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <circle cx="12" cy="12" r="10" />
                  <line x1="15" y1="9" x2="9" y2="15" />
                  <line x1="9" y1="9" x2="15" y2="15" />
                </svg>
                {loginState.error}
              </div>
            )}

            {/* Username */}
            <div className="stagger-3 space-y-2">
              <label
                htmlFor="username"
                className="block text-[10px] font-mono font-medium text-text-secondary uppercase tracking-[0.15em]"
              >
                Username
              </label>
              <div className="input-field">
                <span className="input-icon">
                  <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" />
                    <circle cx="12" cy="7" r="4" />
                  </svg>
                </span>
                <input
                  id="username"
                  name="username"
                  type="text"
                  autoComplete="username"
                  required
                  className="input-enhanced w-full bg-bg-elevated/80 border border-border-default rounded-lg pl-10 pr-3 py-2.5 text-sm text-text-primary placeholder:text-text-muted focus:outline-none"
                  placeholder="ghost"
                />
              </div>
              {loginState.fieldErrors?.username && (
                <p className="text-xs text-danger mt-1 animate-slide-in-left">
                  {loginState.fieldErrors.username[0]}
                </p>
              )}
            </div>

            {/* Password */}
            <div className="stagger-4 space-y-2">
              <label
                htmlFor="password"
                className="block text-[10px] font-mono font-medium text-text-secondary uppercase tracking-[0.15em]"
              >
                Password
              </label>
              <div className="input-field">
                <span className="input-icon">
                  <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                    <rect x="3" y="11" width="18" height="11" rx="2" ry="2" />
                    <path d="M7 11V7a5 5 0 0 1 10 0v4" />
                  </svg>
                </span>
                <input
                  id="password"
                  name="password"
                  type={showPassword ? "text" : "password"}
                  autoComplete="current-password"
                  required
                  className="input-enhanced w-full bg-bg-elevated/80 border border-border-default rounded-lg pl-10 pr-10 py-2.5 text-sm text-text-primary placeholder:text-text-muted focus:outline-none"
                  placeholder="&#8226;&#8226;&#8226;&#8226;&#8226;&#8226;&#8226;&#8226;&#8226;&#8226;&#8226;&#8226;"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-text-muted hover:text-text-secondary transition-colors cursor-pointer z-2"
                  tabIndex={-1}
                  aria-label={showPassword ? "Hide password" : "Show password"}
                >
                  {showPassword ? (
                    <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94" />
                      <path d="M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19" />
                      <line x1="1" y1="1" x2="23" y2="23" />
                    </svg>
                  ) : (
                    <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
                      <circle cx="12" cy="12" r="3" />
                    </svg>
                  )}
                </button>
              </div>
              {loginState.fieldErrors?.password && (
                <p className="text-xs text-danger mt-1 animate-slide-in-left">
                  {loginState.fieldErrors.password[0]}
                </p>
              )}
            </div>

            {/* CAPTCHA */}
            {captchaEnabled && (
              <div className="stagger-5">
                <Captchacat
                  siteKey={captchaSiteKey}
                  onVerify={() => setIsVerified(true)}
                />
              </div>
            )}

            {/* Submit */}
            <div className="stagger-5 pt-1">
              <button
                type="submit"
                disabled={!isVerified || loginPending}
                className="btn-tactical w-full text-white font-semibold text-sm py-3 rounded-[10px] disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer"
              >
                {loginPending ? (
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
                    Authenticating...
                  </span>
                ) : (
                  <span className="relative z-10 flex items-center justify-center gap-2">
                    Sign In
                    <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M5 12h14" />
                      <path d="M12 5l7 7-7 7" />
                    </svg>
                  </span>
                )}
              </button>
              <p className="text-center text-[10px] text-text-muted/40 mt-2.5 font-mono">
                Press <kbd className="px-1.5 py-0.5 rounded-md bg-bg-elevated border border-border-default text-text-muted text-[9px]">Enter</kbd> to submit
              </p>
            </div>
          </form>
        ) : !useRecoveryCode ? (
          /* ===== 2FA Verification Form ===== */
          <form action={totpAction} className="space-y-5 animate-fade-in-up">
            <input
              type="hidden"
              name="userId"
              value={loginState.pendingUserId}
            />

            {totpState.error && (
              <div className="animate-shake flex items-center gap-2.5 bg-danger-dim/20 border border-danger/15 rounded-xl px-4 py-3 text-sm text-danger">
                <svg className="w-4 h-4 shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <circle cx="12" cy="12" r="10" />
                  <line x1="15" y1="9" x2="9" y2="15" />
                  <line x1="9" y1="9" x2="15" y2="15" />
                </svg>
                {totpState.error}
              </div>
            )}

            {/* Lock icon badge */}
            <div className="flex justify-center mb-1">
              <div className="relative w-14 h-14 rounded-xl bg-accent/10 border border-accent/20 flex items-center justify-center">
                <svg
                  className="w-7 h-7 text-accent"
                  fill="none"
                  viewBox="0 0 24 24"
                  strokeWidth={1.5}
                  stroke="currentColor"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    d="M16.5 10.5V6.75a4.5 4.5 0 10-9 0v3.75m-.75 11.25h10.5a2.25 2.25 0 002.25-2.25v-6.75a2.25 2.25 0 00-2.25-2.25H6.75a2.25 2.25 0 00-2.25 2.25v6.75a2.25 2.25 0 002.25 2.25z"
                  />
                </svg>
                {/* Pulse ring */}
                <div className="absolute inset-0 rounded-xl border border-accent/10 animate-pulse-glow" />
              </div>
            </div>

            {/* 2FA Code input */}
            <div className="space-y-2">
              <label
                htmlFor="code"
                className="block text-[10px] font-mono font-medium text-text-secondary uppercase tracking-[0.15em] text-center"
              >
                2FA Code
              </label>
              <input
                id="code"
                name="code"
                type="text"
                inputMode="numeric"
                autoComplete="one-time-code"
                maxLength={6}
                required
                className="input-enhanced w-full bg-bg-elevated/80 border border-border-default rounded-lg px-3 py-3 text-center text-lg font-mono tracking-[0.5em] text-text-primary placeholder:text-text-muted focus:outline-none"
                placeholder="000000"
                autoFocus
              />
              {totpState.fieldErrors?.code && (
                <p className="text-xs text-danger mt-1 text-center animate-slide-in-left">
                  {totpState.fieldErrors.code[0]}
                </p>
              )}
            </div>

            {/* Verify button */}
            <button
              type="submit"
              disabled={totpPending}
              className="btn-tactical w-full text-white font-semibold text-sm py-3 rounded-[10px] disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer"
            >
              {totpPending ? (
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
                <span className="relative z-10">Verify</span>
              )}
            </button>

            {/* Use recovery code */}
            <button
              type="button"
              onClick={() => setUseRecoveryCode(true)}
              className="w-full text-xs text-text-muted hover:text-text-secondary transition-colors duration-100 cursor-pointer text-center"
            >
              Use a recovery code
            </button>

            {/* Back to login */}
            <button
              type="button"
              onClick={() => setShow2fa(false)}
              className="w-full flex items-center justify-center gap-1.5 text-xs text-text-muted hover:text-text-secondary active:text-text-primary transition-colors duration-100 cursor-pointer"
            >
              <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M19 12H5" />
                <path d="M12 19l-7-7 7-7" />
              </svg>
              Back to login
            </button>
          </form>
        ) : (
          /* ===== Recovery Code Form ===== */
          <form action={recoveryAction} className="space-y-5 animate-fade-in-up">
            <input
              type="hidden"
              name="userId"
              value={loginState.pendingUserId}
            />

            {recoveryState.error && (
              <div className="animate-shake flex items-center gap-2.5 bg-danger-dim/20 border border-danger/15 rounded-xl px-4 py-3 text-sm text-danger">
                <svg className="w-4 h-4 shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <circle cx="12" cy="12" r="10" />
                  <line x1="15" y1="9" x2="9" y2="15" />
                  <line x1="9" y1="9" x2="15" y2="15" />
                </svg>
                {recoveryState.error}
              </div>
            )}

            {/* Key icon badge */}
            <div className="flex justify-center mb-1">
              <div className="relative w-14 h-14 rounded-xl bg-accent/10 border border-accent/20 flex items-center justify-center">
                <svg
                  className="w-7 h-7 text-accent"
                  fill="none"
                  viewBox="0 0 24 24"
                  strokeWidth={1.5}
                  stroke="currentColor"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    d="M15.75 5.25a3 3 0 013 3m3 0a6 6 0 01-7.029 5.912c-.563-.097-1.159.026-1.563.43L10.5 17.25H8.25v2.25H6v2.25H2.25v-2.818c0-.597.237-1.17.659-1.591l6.499-6.499c.404-.404.527-1 .43-1.563A6 6 0 1121.75 8.25z"
                  />
                </svg>
                <div className="absolute inset-0 rounded-xl border border-accent/10 animate-pulse-glow" />
              </div>
            </div>

            {/* Recovery code input */}
            <div className="space-y-2">
              <label
                htmlFor="recovery-code"
                className="block text-[10px] font-mono font-medium text-text-secondary uppercase tracking-[0.15em] text-center"
              >
                Recovery Code
              </label>
              <input
                id="recovery-code"
                name="code"
                type="text"
                autoComplete="off"
                maxLength={9}
                required
                className="input-enhanced w-full bg-bg-elevated/80 border border-border-default rounded-lg px-3 py-3 text-center text-lg font-mono tracking-[0.3em] text-text-primary placeholder:text-text-muted focus:outline-none"
                placeholder="a1b2-c3d4"
                autoFocus
              />
              {recoveryState.fieldErrors?.code && (
                <p className="text-xs text-danger mt-1 text-center animate-slide-in-left">
                  {recoveryState.fieldErrors.code[0]}
                </p>
              )}
            </div>

            {/* Verify button */}
            <button
              type="submit"
              disabled={recoveryPending}
              className="btn-tactical w-full text-white font-semibold text-sm py-3 rounded-[10px] disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer"
            >
              {recoveryPending ? (
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
                <span className="relative z-10">Verify</span>
              )}
            </button>

            {/* Switch back to authenticator */}
            <button
              type="button"
              onClick={() => setUseRecoveryCode(false)}
              className="w-full text-xs text-text-muted hover:text-text-secondary transition-colors duration-100 cursor-pointer text-center"
            >
              Use authenticator code instead
            </button>

            {/* Back to login */}
            <button
              type="button"
              onClick={() => {
                setShow2fa(false);
                setUseRecoveryCode(false);
              }}
              className="w-full flex items-center justify-center gap-1.5 text-xs text-text-muted hover:text-text-secondary active:text-text-primary transition-colors duration-100 cursor-pointer"
            >
              <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M19 12H5" />
                <path d="M12 19l-7-7 7-7" />
              </svg>
              Back to login
            </button>
          </form>
        )}
      </div>

      {/* Footer link */}
      {registrationEnabled && (
        <p className="mt-8 text-center text-sm text-text-muted stagger-6">
          No account?{" "}
          <Link
            href="/register"
            className="text-accent hover:text-accent-bright transition-colors duration-200 underline underline-offset-4 decoration-accent/30 hover:decoration-accent/60"
          >
            Register
          </Link>
        </p>
      )}
    </div>
  );
}
