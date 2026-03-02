"use client";

import { useRouter, useSearchParams, usePathname } from "next/navigation";
import { useCallback } from "react";

export function EngagementsViewSwitcher() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const pathname = usePathname();
  const currentView = searchParams.get("view") ?? "grid";

  const switchView = useCallback(
    (view: string) => {
      const params = new URLSearchParams(searchParams.toString());
      if (view === "grid") {
        params.delete("view");
      } else {
        params.set("view", view);
      }
      const qs = params.toString();
      router.push(qs ? `${pathname}?${qs}` : pathname);
    },
    [router, searchParams, pathname]
  );

  return (
    <div className="flex items-center gap-1">
      <button
        onClick={() => switchView("grid")}
        className={`px-2.5 py-1.5 text-xs font-medium rounded transition-all duration-100 ${
          currentView === "grid"
            ? "bg-accent/15 text-accent border border-accent/30"
            : "text-text-muted hover:text-text-primary border border-transparent hover:border-border-default"
        }`}
        title="Grid view"
      >
        <span className="inline-flex items-center gap-1.5">
          <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 6A2.25 2.25 0 016 3.75h2.25A2.25 2.25 0 0110.5 6v2.25a2.25 2.25 0 01-2.25 2.25H6a2.25 2.25 0 01-2.25-2.25V6zM3.75 15.75A2.25 2.25 0 016 13.5h2.25a2.25 2.25 0 012.25 2.25V18a2.25 2.25 0 01-2.25 2.25H6A2.25 2.25 0 013.75 18v-2.25zM13.5 6a2.25 2.25 0 012.25-2.25H18A2.25 2.25 0 0120.25 6v2.25A2.25 2.25 0 0118 10.5h-2.25a2.25 2.25 0 01-2.25-2.25V6zM13.5 15.75a2.25 2.25 0 012.25-2.25H18a2.25 2.25 0 012.25 2.25V18A2.25 2.25 0 0118 20.25h-2.25A2.25 2.25 0 0113.5 18v-2.25z" />
          </svg>
          Grid
        </span>
      </button>
      <button
        onClick={() => switchView("timeline")}
        className={`px-2.5 py-1.5 text-xs font-medium rounded transition-all duration-100 ${
          currentView === "timeline"
            ? "bg-accent/15 text-accent border border-accent/30"
            : "text-text-muted hover:text-text-primary border border-transparent hover:border-border-default"
        }`}
        title="Timeline view"
      >
        <span className="inline-flex items-center gap-1.5">
          <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 6.75h16.5M3.75 12h16.5m-16.5 5.25H12" />
          </svg>
          Timeline
        </span>
      </button>
    </div>
  );
}
