"use client";

import { useState, useEffect } from "react";
import { CommandPalette } from "./command-palette";

export function SearchTrigger() {
  const [isOpen, setIsOpen] = useState(false);
  const [isMac, setIsMac] = useState(false);

  useEffect(() => {
    setIsMac(navigator.platform.toUpperCase().includes("MAC"));

    function handleKeyDown(e: KeyboardEvent) {
      if ((e.metaKey || e.ctrlKey) && e.key === "k") {
        e.preventDefault();
        setIsOpen(true);
      }
    }

    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, []);

  return (
    <>
      <button
        type="button"
        onClick={() => setIsOpen(true)}
        className="flex items-center gap-2 px-3 py-1.5 text-xs text-text-muted hover:text-text-secondary bg-bg-primary/50 border border-border-subtle rounded transition-colors duration-100 cursor-pointer group"
      >
        <svg
          className="w-3.5 h-3.5 text-text-muted group-hover:text-text-secondary transition-colors duration-100"
          fill="none"
          viewBox="0 0 24 24"
          strokeWidth={1.5}
          stroke="currentColor"
        >
          <path strokeLinecap="round" strokeLinejoin="round" d="m21 21-5.197-5.197m0 0A7.5 7.5 0 1 0 5.196 5.196a7.5 7.5 0 0 0 10.607 10.607Z" />
        </svg>
        <span className="hidden sm:inline">Search...</span>
        <kbd className="hidden sm:inline text-[10px] font-mono text-text-muted/60 bg-bg-elevated px-1.5 py-0.5 rounded border border-border-subtle">
          {isMac ? "⌘K" : "Ctrl+K"}
        </kbd>
      </button>
      <CommandPalette isOpen={isOpen} onClose={() => setIsOpen(false)} />
    </>
  );
}
