"use client";

import { useState, useRef, useEffect, useActionState } from "react";
import {
  assignToCategory,
  unassignFromCategory,
  type CategoryState,
} from "./actions";

interface Member {
  userId: string;
  username: string;
  displayName: string | null;
  avatarUrl: string | null;
}

interface AssignDropdownProps {
  categoryId: string;
  engagementId: string;
  members: Member[];
  assignedUserIds: string[];
}

const initialState: CategoryState = {};

export function AssignDropdown({
  categoryId,
  engagementId,
  members,
  assignedUserIds,
}: AssignDropdownProps) {
  const [open, setOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const [assignState, assignAction, assignPending] = useActionState(
    assignToCategory,
    initialState
  );
  const [unassignState, unassignAction, unassignPending] = useActionState(
    unassignFromCategory,
    initialState
  );

  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (
        dropdownRef.current &&
        !dropdownRef.current.contains(e.target as Node)
      ) {
        setOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, []);

  const pending = assignPending || unassignPending;

  return (
    <div className="relative" ref={dropdownRef}>
      <button
        type="button"
        onClick={() => setOpen(!open)}
        className="w-6 h-6 rounded-full border border-dashed border-text-muted/20 hover:border-accent/40 flex items-center justify-center transition-colors duration-100"
        title="Manage assignments"
      >
        <svg
          className="w-3 h-3 text-text-muted"
          fill="none"
          viewBox="0 0 24 24"
          strokeWidth={1.5}
          stroke="currentColor"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            d="M18 7.5v3m0 0v3m0-3h3m-3 0h-3m-2.25-4.125a3.375 3.375 0 11-6.75 0 3.375 3.375 0 016.75 0zM3 19.235v-.11a6.375 6.375 0 0112.75 0v.109A12.318 12.318 0 019.374 21c-2.331 0-4.512-.645-6.374-1.766z"
          />
        </svg>
      </button>

      {open && (
        <div className="absolute right-0 top-full mt-1 bg-bg-surface border border-border-default rounded-lg shadow-lg shadow-black/30 z-50 overflow-hidden animate-dropdown min-w-[180px]">
          <div className="px-3 py-2 border-b border-border-subtle">
            <span className="text-[10px] font-mono font-medium text-text-secondary uppercase tracking-wider">
              Assign Members
            </span>
          </div>
          <div className="max-h-48 overflow-y-auto">
            {members.map((member) => {
              const isAssigned = assignedUserIds.includes(member.userId);
              const name = member.displayName || member.username;
              const initial = name[0].toUpperCase();

              return (
                <form
                  key={member.userId}
                  action={isAssigned ? unassignAction : assignAction}
                  onSubmit={() => {
                    requestAnimationFrame(() => setOpen(false));
                  }}
                >
                  <input
                    type="hidden"
                    name="engagementId"
                    value={engagementId}
                  />
                  <input
                    type="hidden"
                    name="categoryId"
                    value={categoryId}
                  />
                  <input
                    type="hidden"
                    name="userId"
                    value={member.userId}
                  />
                  <button
                    type="submit"
                    disabled={pending}
                    className="flex items-center gap-2.5 w-full px-3 py-2 text-left hover:bg-bg-elevated/50 transition-colors duration-100 disabled:opacity-50"
                  >
                    {/* Avatar */}
                    {member.avatarUrl ? (
                      <img
                        src={member.avatarUrl}
                        alt=""
                        className="w-5 h-5 rounded-full object-cover flex-shrink-0"
                      />
                    ) : (
                      <div className="w-5 h-5 rounded-full bg-accent/10 border border-accent/20 flex items-center justify-center flex-shrink-0">
                        <span className="text-[7px] font-medium text-accent">
                          {initial}
                        </span>
                      </div>
                    )}

                    {/* Name */}
                    <span className="text-xs text-text-primary truncate flex-1">
                      {name}
                    </span>

                    {/* Checkmark */}
                    {isAssigned && (
                      <svg
                        className="w-3.5 h-3.5 text-accent flex-shrink-0"
                        fill="none"
                        viewBox="0 0 24 24"
                        strokeWidth={2}
                        stroke="currentColor"
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          d="M4.5 12.75l6 6 9-13.5"
                        />
                      </svg>
                    )}
                  </button>
                </form>
              );
            })}
          </div>

          {(assignState.error || unassignState.error) && (
            <div className="px-3 py-2 border-t border-border-subtle">
              <p className="text-[10px] text-danger">
                {assignState.error || unassignState.error}
              </p>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
