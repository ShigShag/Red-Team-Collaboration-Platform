"use client";

import { useState, useEffect, useRef, useActionState } from "react";
import { addMember, type EngagementState } from "../actions";

interface UserResult {
  id: string;
  username: string;
  displayName: string | null;
  avatarUrl: string | null;
}

const initialState: EngagementState = {};

export function AddMemberForm({ engagementId }: { engagementId: string }) {
  const [state, action, pending] = useActionState(addMember, initialState);
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<UserResult[]>([]);
  const [selected, setSelected] = useState<UserResult | null>(null);
  const [showDropdown, setShowDropdown] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout>>(undefined);

  // Search users as you type
  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);

    if (query.length < 2 || selected) {
      setResults([]);
      setShowDropdown(false);
      return;
    }

    debounceRef.current = setTimeout(async () => {
      try {
        const res = await fetch(
          `/api/users/search?q=${encodeURIComponent(query)}`
        );
        if (res.ok) {
          const data: UserResult[] = await res.json();
          setResults(data);
          setShowDropdown(data.length > 0);
        }
      } catch {
        // Silently fail on network error
      }
    }, 250);

    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, [query, selected]);

  // Close dropdown on click outside
  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (
        containerRef.current &&
        !containerRef.current.contains(e.target as Node)
      ) {
        setShowDropdown(false);
      }
    }
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, []);

  // Clear selection on success
  useEffect(() => {
    if (state.success) {
      setQuery("");
      setSelected(null);
      setResults([]);
    }
  }, [state.success]);

  function handleSelect(user: UserResult) {
    setSelected(user);
    setQuery(user.username);
    setShowDropdown(false);
  }

  function handleInputChange(value: string) {
    setQuery(value);
    if (selected && value !== selected.username) {
      setSelected(null);
    }
  }

  return (
    <form action={action} className="space-y-3">
      <input type="hidden" name="engagementId" value={engagementId} />
      <input type="hidden" name="username" value={selected?.username ?? query} />

      <div className="flex items-end gap-3">
        {/* Username search */}
        <div className="flex-1 relative" ref={containerRef}>
          <label
            htmlFor="username-search"
            className="block text-[10px] font-mono font-medium text-text-secondary uppercase tracking-[0.15em] mb-1.5"
          >
            Username
          </label>

          {/* Selected user preview */}
          {selected ? (
            <div className="flex items-center gap-2.5 px-3 py-1.5 bg-bg-primary border border-accent/30 rounded">
              {selected.avatarUrl ? (
                <img
                  src={selected.avatarUrl}
                  alt=""
                  className="w-7 h-7 rounded-full object-cover"
                />
              ) : (
                <div className="w-7 h-7 rounded-full bg-accent/10 border border-accent/20 flex items-center justify-center">
                  <span className="text-[10px] font-medium text-accent">
                    {(
                      selected.displayName?.[0] || selected.username[0]
                    ).toUpperCase()}
                  </span>
                </div>
              )}
              <div className="flex-1 min-w-0">
                <span className="text-sm text-text-primary truncate block">
                  {selected.displayName || selected.username}
                </span>
                {selected.displayName && (
                  <span className="text-[10px] text-text-muted">
                    @{selected.username}
                  </span>
                )}
              </div>
              <button
                type="button"
                onClick={() => {
                  setSelected(null);
                  setQuery("");
                }}
                className="p-0.5 text-text-muted hover:text-text-primary transition-colors duration-100"
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
            </div>
          ) : (
            <>
              <input
                id="username-search"
                type="text"
                value={query}
                onChange={(e) => handleInputChange(e.target.value)}
                onFocus={() => results.length > 0 && setShowDropdown(true)}
                autoComplete="off"
                placeholder="Search by username..."
                className="w-full px-3 py-2 bg-bg-primary border border-border-default rounded text-sm text-text-primary placeholder:text-text-muted focus:outline-none focus:border-accent/50 focus:ring-1 focus:ring-accent/20 transition-colors duration-100"
              />

              {/* Search results dropdown */}
              {showDropdown && (
                <div className="absolute left-0 right-0 top-full mt-1 bg-bg-surface border border-border-default rounded-lg shadow-lg shadow-black/30 z-50 overflow-hidden animate-dropdown">
                  {results.map((user) => (
                    <button
                      key={user.id}
                      type="button"
                      onClick={() => handleSelect(user)}
                      className="flex items-center gap-2.5 w-full px-3 py-2.5 text-left hover:bg-bg-elevated transition-colors duration-100"
                    >
                      {user.avatarUrl ? (
                        <img
                          src={user.avatarUrl}
                          alt=""
                          className="w-7 h-7 rounded-full object-cover"
                        />
                      ) : (
                        <div className="w-7 h-7 rounded-full bg-accent/10 border border-accent/20 flex items-center justify-center">
                          <span className="text-[10px] font-medium text-accent">
                            {(
                              user.displayName?.[0] || user.username[0]
                            ).toUpperCase()}
                          </span>
                        </div>
                      )}
                      <div className="min-w-0">
                        <span className="text-sm text-text-primary block truncate">
                          {user.displayName || user.username}
                        </span>
                        {user.displayName && (
                          <span className="text-[10px] text-text-muted">
                            @{user.username}
                          </span>
                        )}
                      </div>
                    </button>
                  ))}
                </div>
              )}
            </>
          )}
        </div>

        {/* Role */}
        <div className="w-28">
          <label
            htmlFor="role"
            className="block text-[10px] font-mono font-medium text-text-secondary uppercase tracking-[0.15em] mb-1.5"
          >
            Role
          </label>
          <select
            id="role"
            name="role"
            defaultValue="read"
            className="w-full px-3 py-2 bg-bg-primary border border-border-default rounded text-sm text-text-primary focus:outline-none focus:border-accent/50 focus:ring-1 focus:ring-accent/20 transition-colors duration-100"
          >
            <option value="read">Read</option>
            <option value="write">Write</option>
            <option value="owner">Owner</option>
          </select>
        </div>

        {/* Submit */}
        <button
          type="submit"
          disabled={pending || !query}
          className="px-4 py-2 text-sm font-medium text-bg-primary bg-accent hover:bg-accent-bright rounded active:scale-[0.97] transition-all duration-100 disabled:opacity-50 whitespace-nowrap"
        >
          {pending ? (
            <svg
              className="animate-spin h-4 w-4"
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
                d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"
              />
            </svg>
          ) : (
            "Add"
          )}
        </button>
      </div>

      {/* Field errors */}
      {state.fieldErrors?.username && (
        <p className="text-xs text-danger animate-slide-in-left">
          {state.fieldErrors.username[0]}
        </p>
      )}

      {/* General error */}
      {state.error && (
        <div className="bg-danger-dim/30 border border-danger/20 rounded px-3 py-2 text-sm text-danger animate-slide-in-left">
          {state.error}
        </div>
      )}

      {/* Success */}
      {state.success && (
        <div className="bg-accent/5 border border-accent/20 rounded px-3 py-2 text-sm text-accent animate-slide-in-left">
          {state.success}
        </div>
      )}
    </form>
  );
}
