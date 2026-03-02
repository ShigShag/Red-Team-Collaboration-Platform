"use client";

import { useState, useActionState } from "react";
import { logout } from "@/app/(auth)/actions";
import { deleteAccount, type SettingsState } from "./actions";

const initialState: SettingsState = {};

export function DangerZone() {
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [state, action, pending] = useActionState(deleteAccount, initialState);

  return (
    <div className="space-y-4">
      {/* Sign out */}
      <div className="flex items-center justify-between">
        <div>
          <p className="text-sm text-text-primary">Sign Out</p>
          <p className="text-xs text-text-muted mt-0.5">
            End your current session
          </p>
        </div>
        <form action={logout}>
          <button
            type="submit"
            className="text-sm font-medium text-text-secondary hover:text-text-primary border border-border-default hover:border-border-accent px-4 py-1.5 rounded transition-colors duration-100 cursor-pointer"
          >
            Sign Out
          </button>
        </form>
      </div>

      {/* Delete account */}
      <div className="pt-4 border-t border-border-default">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm text-text-primary">Delete Account</p>
            <p className="text-xs text-text-muted mt-0.5">
              Permanently delete your account and all data
            </p>
          </div>
          {!showDeleteConfirm && (
            <button
              onClick={() => setShowDeleteConfirm(true)}
              className="text-sm font-medium text-danger border border-danger/30 hover:bg-danger/10 px-4 py-1.5 rounded transition-colors duration-100 cursor-pointer"
            >
              Delete
            </button>
          )}
        </div>

        {showDeleteConfirm && (
          <div className="animate-fade-in-up mt-4 p-4 bg-danger/5 border border-danger/20 rounded-lg">
            <p className="text-sm text-text-primary mb-3">
              Enter your password to confirm. This action cannot be undone.
            </p>
            <form action={action} className="space-y-3">
              {state.error && (
                <div className="bg-danger-dim/30 border border-danger/20 rounded px-3 py-2 text-sm text-danger">
                  {state.error}
                </div>
              )}
              {state.fieldErrors?.password && (
                <div className="bg-danger-dim/30 border border-danger/20 rounded px-3 py-2 text-sm text-danger">
                  {state.fieldErrors.password[0]}
                </div>
              )}
              <input
                name="password"
                type="password"
                required
                className="input-glow w-full bg-bg-elevated border border-border-default rounded px-3 py-2.5 text-sm text-text-primary placeholder:text-text-muted focus:outline-none transition-shadow duration-200"
                placeholder="Enter your password"
              />
              <div className="flex gap-2 justify-end">
                <button
                  type="button"
                  onClick={() => setShowDeleteConfirm(false)}
                  className="text-sm text-text-muted hover:text-text-secondary px-4 py-1.5 rounded transition-colors cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={pending}
                  className="text-sm font-medium text-white bg-danger hover:bg-danger/90 active:scale-[0.97] px-4 py-1.5 rounded transition-all duration-100 disabled:opacity-50 cursor-pointer"
                >
                  {pending ? "Deleting..." : "Delete Account"}
                </button>
              </div>
            </form>
          </div>
        )}
      </div>
    </div>
  );
}
