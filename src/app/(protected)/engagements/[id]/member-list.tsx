"use client";

import { useState, useRef, useEffect, useActionState } from "react";
import {
  updateMemberRole,
  removeMember,
  type EngagementState,
} from "../actions";

interface Member {
  memberId: string;
  userId: string;
  username: string;
  displayName: string | null;
  avatarUrl: string | null;
  role: string;
  joinedAt: string;
}

interface MemberListProps {
  members: Member[];
  engagementId: string;
  isOwner: boolean;
  currentUserId: string;
  ownerCount: number;
}

const initialState: EngagementState = {};

const roleConfig: Record<string, { label: string; color: string; bg: string; border: string }> = {
  owner: { label: "Owner", color: "text-accent", bg: "bg-accent/5", border: "border-accent/20" },
  write: { label: "Write", color: "text-green-500", bg: "bg-green-500/5", border: "border-green-500/20" },
  read: { label: "Read", color: "text-text-secondary", bg: "bg-bg-elevated", border: "border-border-default" },
};

export function MemberList({
  members,
  engagementId,
  isOwner,
  currentUserId,
  ownerCount,
}: MemberListProps) {
  return (
    <div className="space-y-1">
      {members.map((member) => (
        <MemberRow
          key={`${member.memberId}-${member.role}`}
          member={member}
          engagementId={engagementId}
          isOwner={isOwner}
          isCurrentUser={member.userId === currentUserId}
          isSoleOwner={member.role === "owner" && ownerCount <= 1}
        />
      ))}
    </div>
  );
}

function RoleDropdown({
  currentRole,
  engagementId,
  memberId,
}: {
  currentRole: string;
  engagementId: string;
  memberId: string;
}) {
  const [roleState, roleAction, rolePending] = useActionState(
    updateMemberRole,
    initialState
  );
  const [open, setOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, []);

  const current = roleConfig[currentRole] ?? roleConfig.read;
  const roles = ["read", "write", "owner"] as const;

  return (
    <div className="relative" ref={dropdownRef}>
      <button
        type="button"
        onClick={() => setOpen(!open)}
        disabled={rolePending}
        className={`inline-flex items-center gap-1.5 px-2 py-0.5 text-[10px] font-mono font-medium uppercase tracking-wider rounded border cursor-pointer transition-all duration-100 disabled:opacity-50 hover:brightness-125 ${current.color} ${current.bg} ${current.border}`}
      >
        {rolePending ? (
          <svg className="animate-spin h-3 w-3" fill="none" viewBox="0 0 24 24">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
          </svg>
        ) : (
          <>
            {currentRole}
            <svg className="w-3 h-3 opacity-50" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 8.25l-7.5 7.5-7.5-7.5" />
            </svg>
          </>
        )}
      </button>

      {open && (
        <div className="absolute right-0 top-full mt-1 bg-bg-surface border border-border-default rounded-lg shadow-lg shadow-black/30 z-50 overflow-hidden animate-dropdown min-w-[100px]">
          {roles.map((role) => {
            const config = roleConfig[role];
            const isActive = role === currentRole;
            return (
              <form
                key={role}
                action={roleAction}
                onSubmit={() => {
                  // Close dropdown after form submission is dispatched
                  requestAnimationFrame(() => setOpen(false));
                }}
              >
                <input type="hidden" name="engagementId" value={engagementId} />
                <input type="hidden" name="memberId" value={memberId} />
                <input type="hidden" name="role" value={role} />
                <button
                  type="submit"
                  disabled={isActive}
                  className={`flex items-center gap-2 w-full px-3 py-2 text-left transition-colors duration-100 ${
                    isActive
                      ? "bg-bg-elevated/50 cursor-default"
                      : "hover:bg-bg-elevated cursor-pointer"
                  }`}
                >
                  <span className={`w-1.5 h-1.5 rounded-full ${isActive ? "bg-accent" : "bg-border-default"}`} />
                  <span className={`text-[10px] font-mono font-medium uppercase tracking-wider ${isActive ? config.color : "text-text-secondary"}`}>
                    {config.label}
                  </span>
                </button>
              </form>
            );
          })}
        </div>
      )}

      {roleState.error && (
        <div className="absolute right-0 top-full mt-1 text-[10px] text-danger whitespace-nowrap bg-bg-surface border border-danger/20 rounded px-2 py-1 z-50">
          {roleState.error}
        </div>
      )}
    </div>
  );
}

function MemberRow({
  member,
  engagementId,
  isOwner,
  isCurrentUser,
  isSoleOwner,
}: {
  member: Member;
  engagementId: string;
  isOwner: boolean;
  isCurrentUser: boolean;
  isSoleOwner: boolean;
}) {
  const [removeState, removeAction, removePending] = useActionState(
    removeMember,
    initialState
  );
  const [confirmRemove, setConfirmRemove] = useState(false);

  const current = roleConfig[member.role] ?? roleConfig.read;
  const displayName = member.displayName || member.username;
  const initial = displayName[0].toUpperCase();

  return (
    <div className="flex items-center gap-3 px-3 py-2.5 rounded hover:bg-bg-elevated/50 transition-colors duration-100 group">
      {/* Avatar */}
      {member.avatarUrl ? (
        <img
          src={member.avatarUrl}
          alt=""
          className="w-8 h-8 rounded-full object-cover"
        />
      ) : (
        <div className="w-8 h-8 rounded-full bg-accent/10 border border-accent/20 flex items-center justify-center">
          <span className="text-xs font-medium text-accent">{initial}</span>
        </div>
      )}

      {/* Info */}
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <span className="text-sm font-medium text-text-primary truncate">
            {displayName}
          </span>
          {isCurrentUser && (
            <span className="text-[9px] font-mono text-text-muted">(you)</span>
          )}
        </div>
        <span className="text-xs text-text-muted">@{member.username}</span>
      </div>

      {/* Role */}
      {isOwner && !isSoleOwner ? (
        <RoleDropdown
          currentRole={member.role}
          engagementId={engagementId}
          memberId={member.memberId}
        />
      ) : (
        <span
          className={`inline-flex items-center px-2 py-0.5 text-[10px] font-mono font-medium uppercase tracking-wider rounded border ${current.color} ${current.bg} ${current.border}`}
        >
          {member.role}
        </span>
      )}

      {/* Remove button (owner only, can't remove sole owner) */}
      {isOwner && !isSoleOwner && (
        confirmRemove ? (
          <div className="flex items-center gap-1.5 animate-slide-in-left">
            <form action={removeAction}>
              <input type="hidden" name="engagementId" value={engagementId} />
              <input type="hidden" name="memberId" value={member.memberId} />
              <button
                type="submit"
                disabled={removePending}
                className="px-2 py-0.5 text-[10px] font-medium text-white bg-danger hover:bg-danger/80 rounded active:scale-[0.97] transition-all duration-100 disabled:opacity-50"
              >
                {removePending ? "Removing…" : "Remove"}
              </button>
            </form>
            <button
              type="button"
              onClick={() => setConfirmRemove(false)}
              className="px-2 py-0.5 text-[10px] text-text-muted hover:text-text-primary transition-colors duration-100"
            >
              Cancel
            </button>
          </div>
        ) : (
          <button
            type="button"
            onClick={() => setConfirmRemove(true)}
            className="opacity-0 group-hover:opacity-100 p-1 text-text-muted hover:text-danger transition-all duration-100"
            title="Remove member"
          >
            <svg
              className="w-3.5 h-3.5"
              fill="none"
              viewBox="0 0 24 24"
              strokeWidth={1.5}
              stroke="currentColor"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M6 18L18 6M6 6l12 12"
              />
            </svg>
          </button>
        )
      )}

      {/* Error display */}
      {removeState.error && (
        <span className="text-[10px] text-danger">
          {removeState.error}
        </span>
      )}
    </div>
  );
}
