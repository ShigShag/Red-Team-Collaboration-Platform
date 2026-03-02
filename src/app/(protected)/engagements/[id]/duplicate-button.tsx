"use client";

import { useState } from "react";
import { DuplicateModal } from "./duplicate-modal";

interface Category {
  id: string;
  name: string;
  icon: string;
  color: string | null;
}

interface Member {
  userId: string;
  username: string;
  displayName: string | null;
  role: string;
}

export function DuplicateButton({
  engagementId,
  engagementName,
  categories,
  members,
}: {
  engagementId: string;
  engagementName: string;
  categories: Category[];
  members: Member[];
}) {
  const [isOpen, setIsOpen] = useState(false);

  return (
    <>
      <button
        type="button"
        onClick={() => setIsOpen(true)}
        className="inline-flex items-center gap-1.5 px-2.5 py-1.5 text-xs text-text-muted hover:text-text-primary border border-border-default hover:border-accent/30 rounded transition-all duration-100 hover:bg-bg-elevated/50"
        title="Duplicate engagement"
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
            d="M15.75 17.25v3.375c0 .621-.504 1.125-1.125 1.125h-9.75a1.125 1.125 0 01-1.125-1.125V7.875c0-.621.504-1.125 1.125-1.125H6.75a9.06 9.06 0 011.5.124m7.5 10.376h3.375c.621 0 1.125-.504 1.125-1.125V11.25c0-4.46-3.243-8.161-7.5-8.876a9.06 9.06 0 00-1.5-.124H9.375c-.621 0-1.125.504-1.125 1.125v3.5m7.5 10.375H9.375a1.125 1.125 0 01-1.125-1.125v-9.25m12 6.625v-1.875a3.375 3.375 0 00-3.375-3.375h-1.5a1.125 1.125 0 01-1.125-1.125v-1.5a3.375 3.375 0 00-3.375-3.375H9.75"
          />
        </svg>
        Duplicate
      </button>

      <DuplicateModal
        isOpen={isOpen}
        onClose={() => setIsOpen(false)}
        engagementId={engagementId}
        engagementName={engagementName}
        categories={categories}
        members={members}
      />
    </>
  );
}
