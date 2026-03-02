"use client";

import { useActionState, useRef, useState } from "react";
import {
  updateProfile,
  uploadAvatar,
  removeAvatar,
  type SettingsState,
} from "./actions";

const initialState: SettingsState = {};

interface ProfileFormProps {
  username: string;
  displayName: string | null;
  avatarUrl: string | null;
}

export function ProfileForm({
  username,
  displayName,
  avatarUrl,
}: ProfileFormProps) {
  const [profileState, profileAction, profilePending] = useActionState(
    updateProfile,
    initialState
  );
  const [avatarState, avatarAction, avatarPending] = useActionState(
    uploadAvatar,
    initialState
  );
  const [removeState, removeAction, removePending] = useActionState(
    removeAvatar,
    initialState
  );
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [preview, setPreview] = useState<string | null>(null);

  const initial = (displayName || username).charAt(0).toUpperCase();
  const showAvatar = preview || avatarUrl;
  const avatarBusy = avatarPending || removePending;

  function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;

    // Client-side preview
    const reader = new FileReader();
    reader.onload = () => setPreview(reader.result as string);
    reader.readAsDataURL(file);

    // Submit the form
    const form = e.target.closest("form");
    if (form) form.requestSubmit();
  }

  // Merge avatar/remove messages
  const avatarMessage =
    avatarState.error ||
    avatarState.success ||
    removeState.error ||
    removeState.success;
  const avatarIsError = !!(avatarState.error || removeState.error);

  return (
    <div className="space-y-6">
      {/* Avatar section */}
      <div className="flex items-start gap-5">
        <div className="relative group">
          {/* Avatar upload form (hidden) */}
          <form action={avatarAction}>
            <input
              ref={fileInputRef}
              type="file"
              name="avatar"
              accept="image/jpeg,image/png,image/webp"
              className="hidden"
              onChange={handleFileChange}
            />
          </form>

          {/* Clickable avatar */}
          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            disabled={avatarBusy}
            className="w-16 h-16 rounded-full bg-accent/10 border border-accent/20 flex items-center justify-center text-2xl font-semibold text-accent flex-shrink-0 overflow-hidden cursor-pointer hover:border-accent/40 transition-colors duration-100 disabled:opacity-50 relative"
          >
            {showAvatar ? (
              <img
                src={preview || avatarUrl!}
                alt="Avatar"
                className="w-full h-full object-cover"
              />
            ) : (
              initial
            )}
            {/* Hover overlay */}
            <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity duration-100 flex items-center justify-center rounded-full">
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
                  d="M6.827 6.175A2.31 2.31 0 015.186 7.23c-.38.054-.757.112-1.134.175C2.999 7.58 2.25 8.507 2.25 9.574V18a2.25 2.25 0 002.25 2.25h15A2.25 2.25 0 0021.75 18V9.574c0-1.067-.75-1.994-1.802-2.169a47.865 47.865 0 00-1.134-.175 2.31 2.31 0 01-1.64-1.055l-.822-1.316a2.192 2.192 0 00-1.736-1.039 48.774 48.774 0 00-5.232 0 2.192 2.192 0 00-1.736 1.039l-.821 1.316z"
                />
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  d="M16.5 12.75a4.5 4.5 0 11-9 0 4.5 4.5 0 019 0z"
                />
              </svg>
            </div>
          </button>
        </div>

        <div className="pt-1 min-w-0">
          <p className="text-sm font-medium text-text-primary truncate">
            {displayName || username}
          </p>
          <p className="text-xs text-text-muted">@{username}</p>
          <div className="flex items-center gap-3 mt-2">
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              disabled={avatarBusy}
              className="text-xs text-accent hover:text-accent/80 transition-colors cursor-pointer disabled:opacity-50"
            >
              {avatarBusy ? "Uploading..." : "Change photo"}
            </button>
            {(avatarUrl || preview) && (
              <form action={removeAction}>
                <button
                  type="submit"
                  disabled={avatarBusy}
                  className="text-xs text-text-muted hover:text-danger transition-colors cursor-pointer disabled:opacity-50"
                >
                  Remove
                </button>
              </form>
            )}
          </div>
        </div>
      </div>

      {/* Avatar feedback */}
      {avatarMessage && (
        <div
          className={`animate-slide-in-left ${
            avatarIsError
              ? "bg-danger-dim/30 border border-danger/20 text-danger"
              : "bg-accent/5 border border-accent/20 text-accent"
          } rounded px-3 py-2 text-sm`}
        >
          {avatarMessage}
        </div>
      )}

      {/* Display name form */}
      <form action={profileAction} className="space-y-4">
        {profileState.error && (
          <div className="animate-slide-in-left bg-danger-dim/30 border border-danger/20 rounded px-3 py-2 text-sm text-danger">
            {profileState.error}
          </div>
        )}
        {profileState.success && (
          <div className="animate-slide-in-left bg-accent/5 border border-accent/20 rounded px-3 py-2 text-sm text-accent">
            {profileState.success}
          </div>
        )}

        <div className="space-y-1.5">
          <label
            htmlFor="displayName"
            className="block text-xs font-medium text-text-secondary uppercase tracking-wider"
          >
            Display Name
          </label>
          <div className="flex gap-3">
            <input
              id="displayName"
              name="displayName"
              type="text"
              defaultValue={displayName || ""}
              maxLength={100}
              className="input-glow flex-1 bg-bg-elevated border border-border-default rounded px-3 py-2.5 text-sm text-text-primary placeholder:text-text-muted focus:outline-none transition-shadow duration-200"
              placeholder="Enter your name"
            />
            <button
              type="submit"
              disabled={profilePending}
              className="btn-shimmer bg-accent hover:bg-accent/90 active:scale-[0.97] text-white font-semibold text-sm px-6 py-2.5 rounded transition-all duration-100 disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer"
            >
              {profilePending ? "Saving..." : "Save"}
            </button>
          </div>
          {profileState.fieldErrors?.displayName && (
            <p className="text-xs text-danger mt-1">
              {profileState.fieldErrors.displayName[0]}
            </p>
          )}
        </div>
      </form>
    </div>
  );
}
