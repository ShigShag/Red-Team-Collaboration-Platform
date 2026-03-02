"use client";

import { useState, useRef, useCallback, useEffect } from "react";

export interface MentionMember {
  id: string;
  username: string;
  displayName: string | null;
  avatarPath: string | null;
}

interface MentionAutocompleteProps {
  textareaRef: React.RefObject<HTMLTextAreaElement | null>;
  members: MentionMember[];
  onSelect: (username: string) => void;
}

export default function MentionAutocomplete({
  textareaRef,
  members,
  onSelect,
}: MentionAutocompleteProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [selectedIndex, setSelectedIndex] = useState(0);
  const [position, setPosition] = useState({ top: 0, left: 0 });
  const dropdownRef = useRef<HTMLDivElement>(null);

  const filtered = query
    ? members.filter(
        (m) =>
          m.username.toLowerCase().includes(query.toLowerCase()) ||
          (m.displayName?.toLowerCase().includes(query.toLowerCase()) ?? false)
      )
    : members;

  const handleInput = useCallback(() => {
    const textarea = textareaRef.current;
    if (!textarea) return;

    const value = textarea.value;
    const cursorPos = textarea.selectionStart;
    const textBefore = value.slice(0, cursorPos);

    // Find the last @ before cursor that isn't preceded by a word character
    const mentionMatch = textBefore.match(/(^|[^a-zA-Z0-9_-])@([a-zA-Z0-9_-]*)$/);

    if (mentionMatch) {
      const searchTerm = mentionMatch[2];
      setQuery(searchTerm);
      setIsOpen(true);
      setSelectedIndex(0);

      // Position the dropdown near the cursor
      // Use textarea position as baseline
      const rect = textarea.getBoundingClientRect();
      const lineHeight = parseInt(getComputedStyle(textarea).lineHeight) || 20;
      const lines = textBefore.split("\n");
      const currentLine = lines.length - 1;

      setPosition({
        top: Math.min(currentLine * lineHeight + lineHeight + 4, rect.height),
        left: 8,
      });
    } else {
      setIsOpen(false);
    }
  }, [textareaRef]);

  const selectMember = useCallback(
    (username: string) => {
      const textarea = textareaRef.current;
      if (!textarea) return;

      const value = textarea.value;
      const cursorPos = textarea.selectionStart;
      const textBefore = value.slice(0, cursorPos);
      const textAfter = value.slice(cursorPos);

      // Find and replace the @query with @username
      const mentionMatch = textBefore.match(/(^|[^a-zA-Z0-9_-])@([a-zA-Z0-9_-]*)$/);
      if (mentionMatch) {
        const startPos = textBefore.lastIndexOf("@" + mentionMatch[2]);
        const newText =
          value.slice(0, startPos) + `@${username} ` + textAfter;

        // Use native setter to trigger React's change detection
        const nativeSetter = Object.getOwnPropertyDescriptor(
          window.HTMLTextAreaElement.prototype,
          "value"
        )?.set;
        if (nativeSetter) {
          nativeSetter.call(textarea, newText);
          textarea.dispatchEvent(new Event("input", { bubbles: true }));
        }

        const newCursorPos = startPos + username.length + 2; // @username + space
        textarea.setSelectionRange(newCursorPos, newCursorPos);
        textarea.focus();
      }

      setIsOpen(false);
      onSelect(username);
    },
    [textareaRef, onSelect]
  );

  // Keyboard navigation
  useEffect(() => {
    const textarea = textareaRef.current;
    if (!textarea || !isOpen) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (!isOpen || filtered.length === 0) return;

      if (e.key === "ArrowDown") {
        e.preventDefault();
        setSelectedIndex((i) => Math.min(i + 1, filtered.length - 1));
      } else if (e.key === "ArrowUp") {
        e.preventDefault();
        setSelectedIndex((i) => Math.max(i - 1, 0));
      } else if (e.key === "Enter" || e.key === "Tab") {
        if (isOpen && filtered.length > 0) {
          e.preventDefault();
          selectMember(filtered[selectedIndex].username);
        }
      } else if (e.key === "Escape") {
        setIsOpen(false);
      }
    };

    textarea.addEventListener("keydown", handleKeyDown);
    return () => textarea.removeEventListener("keydown", handleKeyDown);
  }, [textareaRef, isOpen, filtered, selectedIndex, selectMember]);

  // Listen for input events on the textarea
  useEffect(() => {
    const textarea = textareaRef.current;
    if (!textarea) return;

    textarea.addEventListener("input", handleInput);
    textarea.addEventListener("click", handleInput);
    return () => {
      textarea.removeEventListener("input", handleInput);
      textarea.removeEventListener("click", handleInput);
    };
  }, [textareaRef, handleInput]);

  // Close on click outside
  useEffect(() => {
    if (!isOpen) return;
    const handleClick = (e: MouseEvent) => {
      if (
        dropdownRef.current &&
        !dropdownRef.current.contains(e.target as Node) &&
        textareaRef.current &&
        !textareaRef.current.contains(e.target as Node)
      ) {
        setIsOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, [isOpen, textareaRef]);

  if (!isOpen || filtered.length === 0) return null;

  return (
    <div
      ref={dropdownRef}
      className="absolute z-50 w-64 max-h-48 overflow-y-auto rounded-lg border border-border-default bg-bg-surface shadow-lg"
      style={{ top: position.top, left: position.left }}
    >
      {filtered.slice(0, 8).map((member, i) => (
        <button
          key={member.id}
          type="button"
          className={`w-full flex items-center gap-2 px-3 py-2 text-sm text-left hover:bg-bg-elevated transition-colors ${
            i === selectedIndex ? "bg-bg-elevated" : ""
          }`}
          onMouseDown={(e) => {
            e.preventDefault();
            selectMember(member.username);
          }}
          onMouseEnter={() => setSelectedIndex(i)}
        >
          {member.avatarPath ? (
            <img
              src={`/api/avatar/${member.id}`}
              alt=""
              className="w-5 h-5 rounded-full object-cover"
            />
          ) : (
            <div className="w-5 h-5 rounded-full bg-accent/10 border border-accent/20 flex items-center justify-center">
              <span className="text-[10px] font-medium text-accent">
                {(member.displayName || member.username)[0].toUpperCase()}
              </span>
            </div>
          )}
          <div className="min-w-0 flex-1">
            <span className="font-medium text-text-primary truncate block">
              {member.displayName || member.username}
            </span>
            {member.displayName && (
              <span className="text-text-muted text-xs">@{member.username}</span>
            )}
          </div>
        </button>
      ))}
    </div>
  );
}
