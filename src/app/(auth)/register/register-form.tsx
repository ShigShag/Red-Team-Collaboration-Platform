"use client";

import { useActionState, useMemo, useState } from "react";
import Link from "next/link";
import { Captchacat } from "@captchacat/nextjs";
import { register, type AuthState } from "../actions";
import { PasswordRequirements } from "@/components/password-requirements";

const initialState: AuthState = {};

function getPasswordStrength(password: string) {
  let score = 0;
  if (password.length >= 12) score++;
  if (password.length >= 16) score++;
  if (/[a-z]/.test(password) && /[A-Z]/.test(password)) score++;
  if (/\d/.test(password)) score++;
  if (/[^a-zA-Z0-9]/.test(password)) score++;
  return score;
}

const strengthLabels = ["", "Weak", "Fair", "Good", "Strong", "Excellent"];
const strengthStrokeColors = [
  "var(--color-border-default)",
  "var(--color-danger)",
  "var(--color-warning)",
  "var(--color-warning)",
  "var(--color-accent)",
  "var(--color-green-500)",
];

const RING_RADIUS = 22;
const RING_CIRCUMFERENCE = 2 * Math.PI * RING_RADIUS;

export function RegisterForm({ captchaSiteKey, captchaEnabled, registrationMode }: { captchaSiteKey: string; captchaEnabled: boolean; registrationMode: "open" | "code" | "invite" }) {
  const [state, action, pending] = useActionState(register, initialState);
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [isVerified, setIsVerified] = useState(!captchaEnabled);

  const strength = useMemo(() => getPasswordStrength(password), [password]);

  return (
    <div>
      {/* Header */}
      <div className="mb-7 stagger-1">
        <div className="flex items-center gap-3 mb-3">
          <div className="h-px w-10 bg-gradient-to-r from-accent to-transparent" />
          <span className="text-[10px] font-mono font-medium text-accent tracking-[0.25em] uppercase">
            // Enrollment
          </span>
        </div>
        <h1 className="text-3xl font-bold text-text-primary tracking-tight">
          Create Account
        </h1>
        <p className="text-sm text-text-secondary mt-1.5 font-mono typing-cursor">
          Register as a new operator
        </p>
      </div>

      {/* Glass Card */}
      <div className="glass-card p-6 stagger-2">
        <form action={action} className="space-y-5">
          {state.error && (
            <div className="animate-shake flex items-center gap-2.5 bg-danger-dim/20 border border-danger/15 rounded-xl px-4 py-3 text-sm text-danger">
              <svg className="w-4 h-4 shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <circle cx="12" cy="12" r="10" />
                <line x1="15" y1="9" x2="9" y2="15" />
                <line x1="9" y1="9" x2="15" y2="15" />
              </svg>
              {state.error}
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
            {state.fieldErrors?.username && (
              <p className="text-xs text-danger mt-1 animate-slide-in-left">
                {state.fieldErrors.username[0]}
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
                autoComplete="new-password"
                required
                minLength={12}
                className="input-enhanced w-full bg-bg-elevated/80 border border-border-default rounded-lg pl-10 pr-10 py-2.5 text-sm text-text-primary placeholder:text-text-muted focus:outline-none"
                placeholder="Min 12 characters"
                onChange={(e) => setPassword(e.target.value)}
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
            {state.fieldErrors?.password && (
              <p className="text-xs text-danger mt-1 animate-slide-in-left">
                {state.fieldErrors.password[0]}
              </p>
            )}

            {/* Password strength ring */}
            {password.length > 0 && (
              <div className="animate-fade-in flex items-center gap-3.5 pt-2">
                <div className="relative shrink-0">
                  <svg width="52" height="52" viewBox="0 0 52 52" className="strength-glow -rotate-90">
                    {/* Background track */}
                    <circle
                      cx="26"
                      cy="26"
                      r={RING_RADIUS}
                      fill="none"
                      stroke="var(--color-border-default)"
                      strokeWidth="3"
                      strokeLinecap="round"
                      className="strength-ring-track"
                      opacity="0.4"
                    />
                    {/* Strength arc */}
                    <circle
                      cx="26"
                      cy="26"
                      r={RING_RADIUS}
                      fill="none"
                      stroke={strengthStrokeColors[strength]}
                      strokeWidth="3"
                      strokeLinecap="round"
                      strokeDasharray={RING_CIRCUMFERENCE}
                      strokeDashoffset={RING_CIRCUMFERENCE * (1 - strength / 5)}
                      className="strength-ring-fill"
                    />
                  </svg>
                  {/* Score in center */}
                  <span
                    className="absolute inset-0 flex items-center justify-center text-[11px] font-mono font-bold transition-colors duration-400"
                    style={{ color: strengthStrokeColors[strength] }}
                  >
                    {strength}/5
                  </span>
                </div>
                <div>
                  <p
                    className="text-xs font-semibold transition-colors duration-400"
                    style={{ color: strengthStrokeColors[strength] }}
                  >
                    {strengthLabels[strength]}
                  </p>
                  <p className="text-[10px] text-text-muted mt-0.5">
                    Password strength
                  </p>
                </div>
              </div>
            )}

            {/* Password requirements checklist */}
            {password.length > 0 && (
              <div className="animate-fade-in pt-1">
                <PasswordRequirements password={password} />
              </div>
            )}
          </div>

          {/* Confirm Password */}
          <div className="stagger-5 space-y-2">
            <label
              htmlFor="confirmPassword"
              className="block text-[10px] font-mono font-medium text-text-secondary uppercase tracking-[0.15em]"
            >
              Confirm Password
            </label>
            <div className="input-field">
              <span className="input-icon">
                <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
                  <path d="M9 12l2 2 4-4" />
                </svg>
              </span>
              <input
                id="confirmPassword"
                name="confirmPassword"
                type={showConfirmPassword ? "text" : "password"}
                autoComplete="new-password"
                required
                className="input-enhanced w-full bg-bg-elevated/80 border border-border-default rounded-lg pl-10 pr-10 py-2.5 text-sm text-text-primary placeholder:text-text-muted focus:outline-none"
                placeholder="Repeat password"
              />
              <button
                type="button"
                onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-text-muted hover:text-text-secondary transition-colors cursor-pointer z-2"
                tabIndex={-1}
                aria-label={showConfirmPassword ? "Hide password" : "Show password"}
              >
                {showConfirmPassword ? (
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
            {state.fieldErrors?.confirmPassword && (
              <p className="text-xs text-danger mt-1 animate-slide-in-left">
                {state.fieldErrors.confirmPassword[0]}
              </p>
            )}
          </div>

          {/* Security Code */}
          {registrationMode === "code" && (
            <div className="stagger-6 space-y-2">
              <label
                htmlFor="securityCode"
                className="block text-[10px] font-mono font-medium text-text-secondary uppercase tracking-[0.15em]"
              >
                Security Code
              </label>
              <div className="input-field">
                <span className="input-icon">
                  <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M21 2l-2 2m-7.61 7.61a5.5 5.5 0 1 1-7.778 7.778 5.5 5.5 0 0 1 7.777-7.777zm0 0L15.5 7.5m0 0l3 3L22 7l-3-3m-3.5 3.5L19 4" />
                  </svg>
                </span>
                <input
                  id="securityCode"
                  name="securityCode"
                  type="password"
                  autoComplete="off"
                  required
                  className="input-enhanced w-full bg-bg-elevated/80 border border-border-default rounded-lg pl-10 pr-3 py-2.5 text-sm text-text-primary placeholder:text-text-muted focus:outline-none"
                  placeholder="Required to register"
                />
              </div>
              {state.fieldErrors?.securityCode && (
                <p className="text-xs text-danger mt-1 animate-slide-in-left">
                  {state.fieldErrors.securityCode[0]}
                </p>
              )}
            </div>
          )}

          {/* Invite Code */}
          {registrationMode === "invite" && (
            <div className="stagger-6 space-y-2">
              <label
                htmlFor="inviteCode"
                className="block text-[10px] font-mono font-medium text-text-secondary uppercase tracking-[0.15em]"
              >
                Invite Code
              </label>
              <div className="input-field">
                <span className="input-icon">
                  <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M15 3h4a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2h-4" />
                    <polyline points="10 17 15 12 10 7" />
                    <line x1="15" y1="12" x2="3" y2="12" />
                  </svg>
                </span>
                <input
                  id="inviteCode"
                  name="inviteCode"
                  type="text"
                  autoComplete="off"
                  required
                  className="input-enhanced w-full bg-bg-elevated/80 border border-border-default rounded-lg pl-10 pr-3 py-2.5 text-sm text-text-primary placeholder:text-text-muted focus:outline-none font-mono"
                  placeholder="Enter invite code"
                />
              </div>
            </div>
          )}

          {/* CAPTCHA */}
          {captchaEnabled && (
            <div className="stagger-6">
              <Captchacat
                siteKey={captchaSiteKey}
                onVerify={() => setIsVerified(true)}
              />
            </div>
          )}

          {/* Submit */}
          <div className="stagger-6 pt-1">
            <button
              type="submit"
              disabled={!isVerified || pending}
              className="btn-tactical w-full text-white font-semibold text-sm py-3 rounded-[10px] disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer"
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
                  Creating account...
                </span>
              ) : (
                <span className="relative z-10 flex items-center justify-center gap-2">
                  Create Account
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
      </div>

      {/* Footer link */}
      <p className="mt-8 text-center text-sm text-text-muted stagger-7">
        Already have an account?{" "}
        <Link
          href="/login"
          className="text-accent hover:text-accent-bright transition-colors duration-200 underline underline-offset-4 decoration-accent/30 hover:decoration-accent/60"
        >
          Sign in
        </Link>
      </p>
    </div>
  );
}
