"use client";

import { useState, useRef, useEffect, useActionState } from "react";
import {
  disableUser,
  enableUser,
  deleteUser,
  forcePasswordReset,
  adminResetPassword,
  grantAdmin,
  revokeAdmin,
  grantCoordinator,
  revokeCoordinator,
  type AdminState,
} from "../actions";

interface User {
  id: string;
  username: string;
  displayName: string | null;
  avatarPath: string | null;
  isAdmin: boolean;
  isCoordinator: boolean;
  totpEnabled: boolean;
  disabledAt: Date | null;
  passwordResetRequired: boolean;
  createdAt: Date;
}

const initialState: AdminState = {};

export function UserRow({ user, isSelf }: { user: User; isSelf: boolean }) {
  const [menuOpen, setMenuOpen] = useState(false);
  const [confirmAction, setConfirmAction] = useState<string | null>(null);
  const [openUpward, setOpenUpward] = useState(false);
  const [copied, setCopied] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);

  const [disableState, disableAction, disabling] = useActionState(
    disableUser,
    initialState
  );
  const [enableState, enableAction, enabling] = useActionState(
    enableUser,
    initialState
  );
  const [deleteState, deleteAction, deleting] = useActionState(
    deleteUser,
    initialState
  );
  const [resetState, resetAction, resetting] = useActionState(
    forcePasswordReset,
    initialState
  );
  const [pwResetState, pwResetAction, pwResetting] = useActionState(
    adminResetPassword,
    initialState
  );
  const [grantState, grantAction, granting] = useActionState(
    grantAdmin,
    initialState
  );
  const [revokeState, revokeAction, revoking] = useActionState(
    revokeAdmin,
    initialState
  );
  const [grantCoordState, grantCoordAction, grantingCoord] = useActionState(
    grantCoordinator,
    initialState
  );
  const [revokeCoordState, revokeCoordAction, revokingCoord] = useActionState(
    revokeCoordinator,
    initialState
  );

  const isDisabled = !!user.disabledAt;
  const pending =
    disabling || enabling || deleting || resetting || pwResetting || granting || revoking || grantingCoord || revokingCoord;
  const error =
    disableState.error ||
    enableState.error ||
    deleteState.error ||
    resetState.error ||
    pwResetState.error ||
    grantState.error ||
    revokeState.error ||
    grantCoordState.error ||
    revokeCoordState.error;

  // The temp password is returned in pwResetState.success
  const tempPassword = pwResetState.success;

  useEffect(() => {
    if (!menuOpen) return;
    function handleClickOutside(e: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setMenuOpen(false);
        setConfirmAction(null);
      }
    }
    function handleEscape(e: KeyboardEvent) {
      if (e.key === "Escape") {
        setMenuOpen(false);
        setConfirmAction(null);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    document.addEventListener("keydown", handleEscape);
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
      document.removeEventListener("keydown", handleEscape);
    };
  }, [menuOpen]);

  const initial = (user.displayName || user.username).charAt(0).toUpperCase();

  return (
    <div
      className={`grid grid-cols-[1fr_auto_auto_auto] gap-4 px-6 py-3 border-b border-border-default last:border-b-0 items-center ${
        isDisabled ? "opacity-60" : ""
      }`}
    >
      {/* User Info */}
      <div className="flex items-center gap-3 min-w-0">
        <div className="w-8 h-8 rounded-full bg-accent/10 border border-accent/20 flex items-center justify-center text-xs font-semibold text-accent flex-shrink-0 overflow-hidden">
          {user.avatarPath ? (
            <img
              src={`/api/avatar/${user.id}`}
              alt=""
              className="w-full h-full object-cover"
            />
          ) : (
            initial
          )}
        </div>
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <p className="text-sm font-medium text-text-primary truncate">
              {user.displayName || user.username}
            </p>
            {user.isAdmin && (
              <span className="px-1.5 py-0.5 text-[9px] font-medium uppercase tracking-wider bg-accent/10 text-accent border border-accent/20 rounded">
                Admin
              </span>
            )}
            {user.isCoordinator && (
              <span className="px-1.5 py-0.5 text-[9px] font-medium uppercase tracking-wider bg-purple-500/10 text-purple-400 border border-purple-500/20 rounded">
                Coordinator
              </span>
            )}
            {isSelf && (
              <span className="text-[9px] text-text-muted">(you)</span>
            )}
          </div>
          <p className="text-xs text-text-muted truncate">@{user.username}</p>
        </div>
      </div>

      {/* Status */}
      <div className="w-20 flex justify-center">
        {isDisabled ? (
          <span className="flex items-center gap-1.5 text-[10px] font-medium text-danger">
            <div className="w-1.5 h-1.5 rounded-full bg-danger" />
            Disabled
          </span>
        ) : (
          <span className="flex items-center gap-1.5 text-[10px] font-medium text-green-500">
            <div className="w-1.5 h-1.5 rounded-full bg-green-500" />
            Active
          </span>
        )}
      </div>

      {/* 2FA */}
      <div className="w-16 flex justify-center">
        {user.totpEnabled ? (
          <span className="text-[10px] font-medium text-accent">On</span>
        ) : (
          <span className="text-[10px] text-text-muted">Off</span>
        )}
      </div>

      {/* Actions */}
      <div className="w-28 flex justify-end" ref={menuRef}>
        <div className="relative">
          <button
            ref={buttonRef}
            onClick={() => {
              if (!menuOpen && buttonRef.current) {
                const rect = buttonRef.current.getBoundingClientRect();
                setOpenUpward(rect.bottom + 280 > window.innerHeight);
              }
              setMenuOpen(!menuOpen);
              setConfirmAction(null);
            }}
            disabled={pending}
            className="p-1.5 rounded hover:bg-bg-elevated text-text-muted hover:text-text-secondary transition-colors cursor-pointer disabled:opacity-50"
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
                d="M6.75 12a.75.75 0 11-1.5 0 .75.75 0 011.5 0zM12.75 12a.75.75 0 11-1.5 0 .75.75 0 011.5 0zM18.75 12a.75.75 0 11-1.5 0 .75.75 0 011.5 0z"
              />
            </svg>
          </button>

          {menuOpen && (
            <div className={`animate-dropdown absolute right-0 w-52 bg-bg-surface border border-border-default rounded-lg shadow-lg shadow-black/30 z-50 ${openUpward ? "bottom-full mb-1" : "top-full mt-1"}`}>
              {error && (
                <div className="px-3 py-2 text-xs text-danger bg-danger/5 border-b border-border-default">
                  {error}
                </div>
              )}

              {confirmAction === "delete" ? (
                <div className="p-3 space-y-2">
                  <p className="text-xs text-danger font-medium">
                    Delete @{user.username}?
                  </p>
                  <p className="text-[10px] text-text-muted">
                    This will permanently remove the user and all their data.
                  </p>
                  <div className="flex gap-2">
                    <form action={deleteAction} className="flex-1">
                      <input type="hidden" name="userId" value={user.id} />
                      <button
                        type="submit"
                        disabled={pending}
                        className="w-full px-2 py-1.5 text-xs font-medium text-white bg-danger rounded hover:bg-danger/80 transition-colors cursor-pointer disabled:opacity-50"
                      >
                        Confirm
                      </button>
                    </form>
                    <button
                      onClick={() => setConfirmAction(null)}
                      className="flex-1 px-2 py-1.5 text-xs text-text-muted bg-bg-elevated rounded hover:text-text-secondary transition-colors cursor-pointer"
                    >
                      Cancel
                    </button>
                  </div>
                </div>
              ) : confirmAction === "resetPassword" ? (
                tempPassword ? (
                  <div className="p-3 space-y-2">
                    <p className="text-xs text-green-500 font-medium">
                      Password reset for @{user.username}
                    </p>
                    <p className="text-[10px] text-text-muted">
                      Temporary password (shown once):
                    </p>
                    <div className="flex items-center gap-1.5">
                      <code className="flex-1 bg-bg-elevated border border-border-default rounded px-2 py-1.5 text-xs font-mono text-accent break-all select-all">
                        {tempPassword}
                      </code>
                      <button
                        onClick={() => {
                          navigator.clipboard.writeText(tempPassword);
                          setCopied(true);
                          setTimeout(() => setCopied(false), 2000);
                        }}
                        className="shrink-0 p-1.5 rounded hover:bg-bg-elevated text-text-muted hover:text-text-secondary transition-colors cursor-pointer"
                        title="Copy to clipboard"
                      >
                        {copied ? (
                          <svg className="w-3.5 h-3.5 text-green-500" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12.75l6 6 9-13.5" />
                          </svg>
                        ) : (
                          <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" d="M15.666 3.888A2.25 2.25 0 0013.5 2.25h-3c-1.03 0-1.9.693-2.166 1.638m7.332 0c.055.194.084.4.084.612v0a.75.75 0 01-.75.75H9.75a.75.75 0 01-.75-.75v0c0-.212.03-.418.084-.612m7.332 0c.646.049 1.288.11 1.927.184 1.1.128 1.907 1.077 1.907 2.185V19.5a2.25 2.25 0 01-2.25 2.25H6.75A2.25 2.25 0 014.5 19.5V6.257c0-1.108.806-2.057 1.907-2.185a48.208 48.208 0 011.927-.184" />
                          </svg>
                        )}
                      </button>
                    </div>
                    {user.totpEnabled && (
                      <p className="text-[10px] text-warning">
                        2FA has been disabled for this user.
                      </p>
                    )}
                    <button
                      onClick={() => {
                        setMenuOpen(false);
                        setConfirmAction(null);
                      }}
                      className="w-full px-2 py-1.5 text-xs text-text-muted bg-bg-elevated rounded hover:text-text-secondary transition-colors cursor-pointer"
                    >
                      Done
                    </button>
                  </div>
                ) : (
                  <div className="p-3 space-y-2">
                    <p className="text-xs text-warning font-medium">
                      Reset password for @{user.username}?
                    </p>
                    <p className="text-[10px] text-text-muted">
                      This will generate a temporary password and force the user to change it on next login.
                      {user.totpEnabled && " Their 2FA will also be disabled."}
                    </p>
                    <div className="flex gap-2">
                      <form action={pwResetAction} className="flex-1">
                        <input type="hidden" name="userId" value={user.id} />
                        <button
                          type="submit"
                          disabled={pending}
                          className="w-full px-2 py-1.5 text-xs font-medium text-white bg-warning rounded hover:bg-warning/80 transition-colors cursor-pointer disabled:opacity-50"
                        >
                          {pwResetting ? "Resetting..." : "Reset"}
                        </button>
                      </form>
                      <button
                        onClick={() => setConfirmAction(null)}
                        className="flex-1 px-2 py-1.5 text-xs text-text-muted bg-bg-elevated rounded hover:text-text-secondary transition-colors cursor-pointer"
                      >
                        Cancel
                      </button>
                    </div>
                  </div>
                )
              ) : (
                <div className="py-1">
                  {/* Disable / Enable */}
                  {!isSelf && (
                    <form
                      action={isDisabled ? enableAction : disableAction}
                    >
                      <input type="hidden" name="userId" value={user.id} />
                      <button
                        type="submit"
                        disabled={pending}
                        className="flex items-center gap-2 w-full px-3 py-2 text-xs text-text-secondary hover:bg-bg-elevated hover:text-text-primary transition-colors cursor-pointer disabled:opacity-50"
                      >
                        {isDisabled ? "Enable User" : "Disable User"}
                      </button>
                    </form>
                  )}

                  {/* Force Password Reset */}
                  <form action={resetAction}>
                    <input type="hidden" name="userId" value={user.id} />
                    <button
                      type="submit"
                      disabled={pending || user.passwordResetRequired}
                      className="flex items-center gap-2 w-full px-3 py-2 text-xs text-text-secondary hover:bg-bg-elevated hover:text-text-primary transition-colors cursor-pointer disabled:opacity-50"
                    >
                      Force Password Reset
                      {user.passwordResetRequired && (
                        <span className="text-[9px] text-warning">(pending)</span>
                      )}
                    </button>
                  </form>

                  {/* Reset Password (generate temp password) */}
                  {!isSelf && (
                    <button
                      onClick={() => setConfirmAction("resetPassword")}
                      className="flex items-center gap-2 w-full px-3 py-2 text-xs text-text-secondary hover:bg-bg-elevated hover:text-text-primary transition-colors cursor-pointer"
                    >
                      Reset Password
                    </button>
                  )}

                  {/* Grant / Revoke Admin */}
                  {!isSelf && (
                    <form
                      action={user.isAdmin ? revokeAction : grantAction}
                    >
                      <input type="hidden" name="userId" value={user.id} />
                      <button
                        type="submit"
                        disabled={pending}
                        className="flex items-center gap-2 w-full px-3 py-2 text-xs text-text-secondary hover:bg-bg-elevated hover:text-text-primary transition-colors cursor-pointer disabled:opacity-50"
                      >
                        {user.isAdmin ? "Revoke Admin" : "Grant Admin"}
                      </button>
                    </form>
                  )}

                  {/* Grant / Revoke Coordinator */}
                  {!isSelf && (
                    <form
                      action={user.isCoordinator ? revokeCoordAction : grantCoordAction}
                    >
                      <input type="hidden" name="userId" value={user.id} />
                      <button
                        type="submit"
                        disabled={pending}
                        className="flex items-center gap-2 w-full px-3 py-2 text-xs text-text-secondary hover:bg-bg-elevated hover:text-text-primary transition-colors cursor-pointer disabled:opacity-50"
                      >
                        {user.isCoordinator ? "Revoke Coordinator" : "Grant Coordinator"}
                      </button>
                    </form>
                  )}

                  {/* Delete */}
                  {!isSelf && (
                    <button
                      onClick={() => setConfirmAction("delete")}
                      className="flex items-center gap-2 w-full px-3 py-2 text-xs text-danger hover:bg-bg-elevated transition-colors cursor-pointer"
                    >
                      Delete User
                    </button>
                  )}
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
