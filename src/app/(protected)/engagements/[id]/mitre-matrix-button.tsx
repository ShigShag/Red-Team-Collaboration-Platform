"use client";

import { useState, useTransition } from "react";
import { getEngagementMitreCoverage } from "./mitre-actions";
import type { CoverageEntry } from "./mitre-actions";
import { MitreMatrixOverlay } from "./mitre-matrix-overlay";

interface MitreMatrixButtonProps {
  engagementId: string;
}

export function MitreMatrixButton({ engagementId }: MitreMatrixButtonProps) {
  const [isPending, startTransition] = useTransition();
  const [coverage, setCoverage] = useState<CoverageEntry[] | null>(null);
  const [isOpen, setIsOpen] = useState(false);

  function handleOpen() {
    startTransition(async () => {
      const data = await getEngagementMitreCoverage(engagementId);
      setCoverage(data);
      setIsOpen(true);
    });
  }

  function handleClose() {
    setIsOpen(false);
  }

  return (
    <>
      <button
        onClick={handleOpen}
        disabled={isPending}
        className="inline-flex items-center gap-1.5 px-2.5 py-1.5 text-xs text-text-muted hover:text-text-primary border border-border-default hover:border-accent/30 rounded transition-all duration-100 hover:bg-bg-elevated/50 disabled:opacity-50"
        title="MITRE ATT&CK Coverage Matrix"
      >
        {isPending ? (
          <svg
            className="w-4 h-4 animate-spin"
            fill="none"
            viewBox="0 0 24 24"
          >
            <circle
              className="opacity-25"
              cx="12"
              cy="12"
              r="10"
              stroke="currentColor"
              strokeWidth="4"
            />
            <path
              className="opacity-75"
              fill="currentColor"
              d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
            />
          </svg>
        ) : (
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
              d="M3.75 6A2.25 2.25 0 016 3.75h2.25A2.25 2.25 0 0110.5 6v2.25a2.25 2.25 0 01-2.25 2.25H6a2.25 2.25 0 01-2.25-2.25V6zM3.75 15.75A2.25 2.25 0 016 13.5h2.25a2.25 2.25 0 012.25 2.25V18a2.25 2.25 0 01-2.25 2.25H6A2.25 2.25 0 013.75 18v-2.25zM13.5 6a2.25 2.25 0 012.25-2.25H18A2.25 2.25 0 0120.25 6v2.25A2.25 2.25 0 0118 10.5h-2.25a2.25 2.25 0 01-2.25-2.25V6zM13.5 15.75a2.25 2.25 0 012.25-2.25H18a2.25 2.25 0 012.25 2.25V18A2.25 2.25 0 0118 20.25h-2.25a2.25 2.25 0 01-2.25-2.25v-2.25z"
            />
          </svg>
        )}
        ATT&CK
      </button>

      {coverage !== null && (
        <MitreMatrixOverlay
          isOpen={isOpen}
          onClose={handleClose}
          engagementId={engagementId}
          coverage={coverage}
        />
      )}
    </>
  );
}
