"use client";

import { useState, useRef, useEffect, useActionState } from "react";
import {
  excludeCoordinator,
  promoteCoordinator,
  type EngagementState,
} from "../actions";

interface VirtualCoordinator {
  userId: string;
  username: string;
  displayName: string | null;
  avatarUrl: string | null;
}

interface CoordinatorListProps {
  coordinators: VirtualCoordinator[];
  engagementId: string;
}

const initialState: EngagementState = {};

export function CoordinatorList({
  coordinators,
  engagementId,
}: CoordinatorListProps) {
  if (coordinators.length === 0) {
    return (
      <p className="text-xs text-text-muted py-2">
        No virtual coordinators for this engagement.
      </p>
    );
  }

  return (
    <div className="space-y-1">
      {coordinators.map((coordinator) => (
        <CoordinatorRow
          key={coordinator.userId}
          coordinator={coordinator}
          engagementId={engagementId}
        />
      ))}
    </div>
  );
}

function CoordinatorRow({
  coordinator,
  engagementId,
}: {
  coordinator: VirtualCoordinator;
  engagementId: string;
}) {
  const [excludeState, excludeAction, excludePending] = useActionState(
    excludeCoordinator,
    initialState
  );
  const [promoteState, promoteAction, promotePending] = useActionState(
    promoteCoordinator,
    initialState
  );
  const [showActions, setShowActions] = useState(false);
  const actionsRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (actionsRef.current && !actionsRef.current.contains(e.target as Node)) {
        setShowActions(false);
      }
    }
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, []);

  const displayName = coordinator.displayName || coordinator.username;
  const initial = displayName[0].toUpperCase();
  const pending = excludePending || promotePending;

  return (
    <div className="flex items-center gap-3 px-3 py-2.5 rounded hover:bg-bg-elevated/50 transition-colors duration-100 group">
      {/* Avatar */}
      {coordinator.avatarUrl ? (
        <img
          src={coordinator.avatarUrl}
          alt=""
          className="w-8 h-8 rounded-full object-cover"
        />
      ) : (
        <div className="w-8 h-8 rounded-full bg-purple-500/10 border border-purple-500/20 flex items-center justify-center">
          <span className="text-xs font-medium text-purple-400">{initial}</span>
        </div>
      )}

      {/* Info */}
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <span className="text-sm font-medium text-text-primary truncate">
            {displayName}
          </span>
        </div>
        <span className="text-xs text-text-muted">@{coordinator.username}</span>
      </div>

      {/* Coordinator badge */}
      <span className="inline-flex items-center px-2 py-0.5 text-[10px] font-mono font-medium uppercase tracking-wider rounded border text-purple-400 bg-purple-500/5 border-purple-500/20">
        coordinator
      </span>

      {/* Actions dropdown */}
      <div className="relative" ref={actionsRef}>
        <button
          type="button"
          onClick={() => setShowActions(!showActions)}
          disabled={pending}
          className="opacity-0 group-hover:opacity-100 p-1 text-text-muted hover:text-text-primary transition-all duration-100 disabled:opacity-50"
          title="Manage coordinator"
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
              d="M12 6.75a.75.75 0 110-1.5.75.75 0 010 1.5zM12 12.75a.75.75 0 110-1.5.75.75 0 010 1.5zM12 18.75a.75.75 0 110-1.5.75.75 0 010 1.5z"
            />
          </svg>
        </button>

        {showActions && (
          <div className="absolute right-0 top-full mt-1 bg-bg-surface border border-border-default rounded-lg shadow-lg shadow-black/30 z-50 overflow-hidden animate-dropdown min-w-[160px]">
            <div className="px-3 py-1.5 text-[9px] font-mono text-text-muted uppercase tracking-wider border-b border-border-default">
              Add as member
            </div>
            {(["read", "write", "owner"] as const).map((role) => (
              <form
                key={role}
                action={promoteAction}
                onSubmit={() => {
                  requestAnimationFrame(() => setShowActions(false));
                }}
              >
                <input type="hidden" name="engagementId" value={engagementId} />
                <input type="hidden" name="userId" value={coordinator.userId} />
                <input type="hidden" name="role" value={role} />
                <button
                  type="submit"
                  disabled={promotePending}
                  className="flex items-center gap-2 w-full px-3 py-2 text-left hover:bg-bg-elevated cursor-pointer transition-colors duration-100"
                >
                  <span className={`w-1.5 h-1.5 rounded-full ${
                    role === "owner" ? "bg-accent" : role === "write" ? "bg-green-500" : "bg-text-muted"
                  }`} />
                  <span className="text-[10px] font-mono font-medium uppercase tracking-wider text-text-secondary">
                    {role}
                  </span>
                </button>
              </form>
            ))}
            <div className="border-t border-border-default">
              <form
                action={excludeAction}
                onSubmit={() => {
                  requestAnimationFrame(() => setShowActions(false));
                }}
              >
                <input type="hidden" name="engagementId" value={engagementId} />
                <input type="hidden" name="userId" value={coordinator.userId} />
                <button
                  type="submit"
                  disabled={excludePending}
                  className="flex items-center gap-2 w-full px-3 py-2 text-left hover:bg-danger/5 cursor-pointer transition-colors duration-100"
                >
                  <svg className="w-3 h-3 text-danger" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M18.364 18.364A9 9 0 005.636 5.636m12.728 12.728A9 9 0 015.636 5.636m12.728 12.728L5.636 5.636" />
                  </svg>
                  <span className="text-[10px] font-mono font-medium uppercase tracking-wider text-danger">
                    Exclude
                  </span>
                </button>
              </form>
            </div>
          </div>
        )}
      </div>

      {/* Error display */}
      {(excludeState.error || promoteState.error) && (
        <span className="text-[10px] text-danger">
          {excludeState.error || promoteState.error}
        </span>
      )}
    </div>
  );
}
