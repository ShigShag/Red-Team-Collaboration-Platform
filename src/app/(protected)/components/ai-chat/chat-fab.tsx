"use client";

import { useState } from "react";
import { ChatPanel } from "./chat-panel";

interface ChatFabProps {
  engagementId: string;
  engagementName: string;
  modelName: string;
}

export function ChatFab({ engagementId, engagementName, modelName }: ChatFabProps) {
  const [open, setOpen] = useState(false);

  return (
    <>
      {/* Floating Action Button */}
      {!open && (
        <button
          type="button"
          onClick={() => setOpen(true)}
          className="fixed bottom-5 right-5 z-40 w-12 h-12 rounded-full bg-accent hover:bg-accent-bright shadow-lg shadow-accent/20 flex items-center justify-center transition-all duration-200 cursor-pointer hover:scale-105 active:scale-95 group"
          title="AI Assistant"
        >
          <svg
            className="w-5 h-5 text-white"
            fill="none"
            viewBox="0 0 24 24"
            strokeWidth={1.5}
            stroke="currentColor"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              d="M9.813 15.904L9 18.75l-.813-2.846a4.5 4.5 0 00-3.09-3.09L2.25 12l2.846-.813a4.5 4.5 0 003.09-3.09L9 5.25l.813 2.846a4.5 4.5 0 003.09 3.09L15.75 12l-2.846.813a4.5 4.5 0 00-3.09 3.09zM18.259 8.715L18 9.75l-.259-1.035a3.375 3.375 0 00-2.455-2.456L14.25 6l1.036-.259a3.375 3.375 0 002.455-2.456L18 2.25l.259 1.035a3.375 3.375 0 002.455 2.456L21.75 6l-1.036.259a3.375 3.375 0 00-2.455 2.456z"
            />
          </svg>
        </button>
      )}

      {/* Chat Panel — always mounted to preserve state */}
      <ChatPanel
        engagementId={engagementId}
        engagementName={engagementName}
        modelName={modelName}
        open={open}
        onClose={() => setOpen(false)}
      />
    </>
  );
}
