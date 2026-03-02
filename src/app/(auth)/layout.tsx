import { redirect } from "next/navigation";
import { createHash } from "crypto";
import { getSession } from "@/lib/auth/session";
import { getClientIp } from "@/lib/get-client-ip";

export default async function AuthLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await getSession();
  if (session) redirect("/dashboard");

  const clientIp = await getClientIp();
  const connId = createHash("sha256").update(clientIp).digest("hex").slice(0, 8).toUpperCase();

  return (
    <div className="relative min-h-screen flex flex-col lg:flex-row overflow-hidden">
      {/* ===== LEFT PANEL: Branding Showcase ===== */}
      <div className="relative lg:w-[44%] w-full shrink-0 overflow-hidden">
        {/* Layered backgrounds */}
        <div className="absolute inset-0 bg-bg-primary" />
        <div className="absolute inset-0 grid-bg opacity-60" />
        <div className="absolute inset-0 scanline-bg" />

        {/* Radar sweep — desktop only */}
        <div className="hidden lg:flex absolute inset-0 items-center justify-center pointer-events-none">
          <div className="radar-sweep w-[480px] h-[480px] rounded-full opacity-15" />
          {/* Concentric rings */}
          <div className="radar-ring w-[120px] h-[120px]" />
          <div className="radar-ring w-[240px] h-[240px]" />
          <div className="radar-ring w-[360px] h-[360px]" />
          <div className="radar-ring w-[480px] h-[480px]" />
        </div>

        {/* Accent glow orbs */}
        <div className="absolute top-[-25%] right-[-15%] w-[500px] h-[500px] rounded-full bg-accent/[0.04] blur-[140px]" />
        <div className="absolute bottom-[-30%] left-[-20%] w-[400px] h-[400px] rounded-full bg-accent/[0.03] blur-[110px]" />

        {/* Content */}
        <div className="relative z-10 flex flex-col justify-center items-center h-full px-8 py-10 lg:py-0 lg:min-h-screen">
          {/* Hexagon emblem */}
          <div className="mb-5 animate-fade-in">
            <svg width="64" height="64" viewBox="0 0 64 64" fill="none" className="opacity-80">
              <path
                d="M32 4L58 18v28L32 60 6 46V18L32 4z"
                stroke="var(--color-accent)"
                strokeWidth="1.5"
                fill="none"
                opacity="0.5"
              />
              <path
                d="M32 12L50 22v20L32 52 14 42V22L32 12z"
                stroke="var(--color-accent)"
                strokeWidth="1"
                fill="none"
                opacity="0.25"
              />
              <circle
                cx="32"
                cy="32"
                r="6"
                stroke="var(--color-accent)"
                strokeWidth="1.5"
                fill="none"
                opacity="0.7"
              />
              <line x1="32" y1="22" x2="32" y2="27" stroke="var(--color-accent)" strokeWidth="1" opacity="0.5" />
              <line x1="32" y1="37" x2="32" y2="42" stroke="var(--color-accent)" strokeWidth="1" opacity="0.5" />
              <line x1="22" y1="32" x2="27" y2="32" stroke="var(--color-accent)" strokeWidth="1" opacity="0.5" />
              <line x1="37" y1="32" x2="42" y2="32" stroke="var(--color-accent)" strokeWidth="1" opacity="0.5" />
              {/* Center dot */}
              <circle cx="32" cy="32" r="1.5" fill="var(--color-accent)" opacity="0.8" />
            </svg>
          </div>

          {/* Brand name */}
          <h1 className="text-3xl lg:text-4xl font-bold text-text-primary tracking-tight mb-1.5 animate-fade-in delay-75">
            RED<span className="text-accent">TEAM</span>
          </h1>

          {/* Tagline with typing cursor */}
          <p className="text-xs text-text-secondary font-mono tracking-wider typing-cursor animate-fade-in delay-150">
            Collaboration Platform
          </p>

          {/* HUD status indicators — desktop only */}
          <div className="hidden lg:flex flex-col items-center gap-2.5 mt-12 animate-fade-in delay-300">
            <div className="flex items-center gap-2 text-[10px] font-mono text-text-muted uppercase tracking-[0.15em]">
              <span className="w-1.5 h-1.5 rounded-full bg-green-500 animate-pulse-glow" />
              System: Online
            </div>
            <div className="flex items-center gap-2 text-[10px] font-mono text-text-muted uppercase tracking-[0.15em]">
              <span className="w-1.5 h-1.5 rounded-full bg-accent animate-pulse-glow" style={{ animationDelay: '0.5s' }} />
              Secure Channel: Active
            </div>
            <div className="text-[10px] font-mono text-text-muted/40 mt-3 tracking-wider">
              CONN_ID: RT-{connId} &bull; {clientIp}
            </div>
          </div>
        </div>

        {/* Corner brackets — desktop only */}
        <div className="hidden lg:block absolute top-8 left-8 animate-fade-in delay-400">
          <svg width="20" height="20" viewBox="0 0 20 20" fill="none" className="text-accent/25">
            <path d="M1 14V1h13" stroke="currentColor" strokeWidth="1" />
          </svg>
        </div>
        <div className="hidden lg:block absolute bottom-8 right-8 animate-fade-in delay-400">
          <svg width="20" height="20" viewBox="0 0 20 20" fill="none" className="text-accent/25">
            <path d="M19 6v13H6" stroke="currentColor" strokeWidth="1" />
          </svg>
        </div>

        {/* Right edge divider — desktop only */}
        <div className="hidden lg:block absolute right-0 top-[10%] bottom-[10%] w-px bg-gradient-to-b from-transparent via-accent/15 to-transparent" />
      </div>

      {/* ===== RIGHT PANEL: Form Area ===== */}
      <div className="relative flex-1 flex items-center justify-center min-h-[calc(100vh-120px)] lg:min-h-screen">
        {/* Subtle layered background */}
        <div className="absolute inset-0 bg-bg-secondary" />
        <div className="absolute inset-0 grid-bg opacity-20" />
        <div className="absolute inset-0 mesh-bg" />

        {/* Floating particles */}
        <div className="absolute inset-0 overflow-hidden pointer-events-none">
          <div className="particle particle-1" />
          <div className="particle particle-2" />
          <div className="particle particle-3" />
          <div className="particle particle-4" />
          <div className="particle particle-5" />
          <div className="particle particle-6" />
        </div>

        {/* Form content */}
        <div className="relative z-10 w-full max-w-[420px] mx-auto px-6 py-12 lg:py-8">
          {children}
        </div>
      </div>
    </div>
  );
}
