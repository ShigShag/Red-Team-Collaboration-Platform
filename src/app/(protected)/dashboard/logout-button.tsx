"use client";

import { logout } from "@/app/(auth)/actions";

export function LogoutButton() {
  return (
    <button
      type="button"
      onClick={async () => {
        await logout();
        window.location.href = "/login";
      }}
      className="flex items-center gap-3 w-full px-3 py-2.5 rounded border border-border-default hover:bg-bg-elevated hover:border-danger/20 active:scale-[0.98] transition-all duration-100 group cursor-pointer"
    >
      <svg
        className="w-4 h-4 text-text-muted group-hover:text-danger transition-colors duration-100"
        fill="none"
        viewBox="0 0 24 24"
        strokeWidth={1.5}
        stroke="currentColor"
      >
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          d="M15.75 9V5.25A2.25 2.25 0 0013.5 3h-6a2.25 2.25 0 00-2.25 2.25v13.5A2.25 2.25 0 007.5 21h6a2.25 2.25 0 002.25-2.25V15m3 0l3-3m0 0l-3-3m3 3H9"
        />
      </svg>
      <span className="text-sm text-text-primary group-hover:text-danger transition-colors duration-100">
        Sign Out
      </span>
    </button>
  );
}
