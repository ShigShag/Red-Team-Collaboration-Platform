"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { getDecryptedField } from "../engagements/[id]/categories/resource-actions";

export function SecretField({
  fieldId,
  engagementId,
  hasValue,
}: {
  fieldId: string;
  engagementId: string;
  hasValue: boolean;
}) {
  const [revealed, setRevealed] = useState(false);
  const [value, setValue] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [copied, setCopied] = useState(false);
  const timerRef = useRef<ReturnType<typeof setTimeout>>(null);

  const reveal = useCallback(async () => {
    if (revealed) {
      setRevealed(false);
      setValue(null);
      if (timerRef.current) clearTimeout(timerRef.current);
      return;
    }
    setLoading(true);
    const result = await getDecryptedField(fieldId, engagementId);
    setLoading(false);
    if (result.value) {
      setValue(result.value);
      setRevealed(true);
      timerRef.current = setTimeout(() => {
        setRevealed(false);
        setValue(null);
      }, 30000);
    }
  }, [revealed, fieldId, engagementId]);

  useEffect(() => {
    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, []);

  const copyValue = useCallback(async () => {
    if (!value) {
      const result = await getDecryptedField(fieldId, engagementId);
      if (result.value) {
        await navigator.clipboard.writeText(result.value);
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
      }
      return;
    }
    await navigator.clipboard.writeText(value);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }, [value, fieldId, engagementId]);

  if (!hasValue) {
    return <span className="text-text-muted/50 text-[11px] italic">empty</span>;
  }

  return (
    <div className="flex items-center gap-1.5">
      <span className="font-mono text-[11px] text-text-secondary">
        {revealed && value ? value : "\u2022\u2022\u2022\u2022\u2022\u2022\u2022\u2022"}
      </span>
      <button
        type="button"
        onClick={reveal}
        disabled={loading}
        className="p-0.5 text-text-muted hover:text-accent transition-colors duration-100 disabled:opacity-50"
        title={revealed ? "Hide" : "Reveal"}
      >
        {loading ? (
          <svg className="w-3 h-3 animate-spin" viewBox="0 0 24 24" fill="none">
            <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="2" strokeDasharray="31.42" strokeDashoffset="10" />
          </svg>
        ) : revealed ? (
          <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" d="M3.98 8.223A10.477 10.477 0 001.934 12C3.226 16.338 7.244 19.5 12 19.5c.993 0 1.953-.138 2.863-.395M6.228 6.228A10.45 10.45 0 0112 4.5c4.756 0 8.773 3.162 10.065 7.498a10.523 10.523 0 01-4.293 5.774M6.228 6.228L3 3m3.228 3.228l3.65 3.65m7.894 7.894L21 21m-3.228-3.228l-3.65-3.65m0 0a3 3 0 10-4.243-4.243m4.242 4.242L9.88 9.88" />
          </svg>
        ) : (
          <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" d="M2.036 12.322a1.012 1.012 0 010-.639C3.423 7.51 7.36 4.5 12 4.5c4.638 0 8.573 3.007 9.963 7.178.07.207.07.431 0 .639C20.577 16.49 16.64 19.5 12 19.5c-4.638 0-8.573-3.007-9.963-7.178z" />
            <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
          </svg>
        )}
      </button>
      <button
        type="button"
        onClick={copyValue}
        className="p-0.5 text-text-muted hover:text-accent transition-colors duration-100"
        title="Copy"
      >
        {copied ? (
          <svg className="w-3 h-3 text-green-400" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12.75l6 6 9-13.5" />
          </svg>
        ) : (
          <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" d="M15.666 3.888A2.25 2.25 0 0013.5 2.25h-3c-1.03 0-1.9.693-2.166 1.638m7.332 0c.055.194.084.4.084.612v0a.75.75 0 01-.75.75H9.75a.75.75 0 01-.75-.75v0c0-.212.03-.418.084-.612m7.332 0c.646.049 1.288.11 1.927.184 1.1.128 1.907 1.077 1.907 2.185V19.5a2.25 2.25 0 01-2.25 2.25H6.75A2.25 2.25 0 014.5 19.5V6.257c0-1.108.806-2.057 1.907-2.185a48.208 48.208 0 011.927-.184" />
          </svg>
        )}
      </button>
    </div>
  );
}
