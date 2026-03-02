"use client";

import { useActionState, useState } from "react";
import { createInviteCode, revokeInviteCode, type AdminState } from "../actions";

const initialState: AdminState = {};

export function InviteForm({ revokeCodeId }: { revokeCodeId?: string }) {
  const [createState, createAction, creating] = useActionState(
    createInviteCode,
    initialState
  );
  const [revokeState, revokeAction, revoking] = useActionState(
    revokeInviteCode,
    initialState
  );
  const [copied, setCopied] = useState(false);

  // Revoke mode
  if (revokeCodeId) {
    return (
      <form action={revokeAction}>
        <input type="hidden" name="codeId" value={revokeCodeId} />
        <button
          type="submit"
          disabled={revoking}
          className="px-2 py-1 text-[10px] font-medium text-danger hover:bg-danger/10 rounded transition-colors cursor-pointer disabled:opacity-50"
        >
          {revoking ? "..." : "Revoke"}
        </button>
      </form>
    );
  }

  // Create mode
  const generatedCode = createState.success;

  return (
    <div className="space-y-4">
      {createState.error && (
        <div className="text-xs text-danger">{createState.error}</div>
      )}

      {generatedCode && (
        <div className="p-3 rounded-lg border border-accent/20 bg-accent/5">
          <p className="text-[10px] font-medium text-accent uppercase tracking-wider mb-2">
            Generated Code
          </p>
          <div className="flex items-center gap-2">
            <code className="text-xs font-mono text-accent break-all flex-1">
              {generatedCode}
            </code>
            <button
              type="button"
              onClick={() => {
                navigator.clipboard.writeText(generatedCode);
                setCopied(true);
                setTimeout(() => setCopied(false), 2000);
              }}
              className="px-2 py-1 text-[10px] font-medium text-accent bg-accent/10 rounded hover:bg-accent/20 transition-colors cursor-pointer shrink-0"
            >
              {copied ? "Copied!" : "Copy"}
            </button>
          </div>
        </div>
      )}

      <form action={createAction} className="flex items-end gap-3">
        <div className="flex-1">
          <label className="block text-[10px] font-medium text-text-muted uppercase tracking-wider mb-1.5">
            Expires in
          </label>
          <div className="flex items-center gap-2">
            <input
              type="number"
              name="expiresInHours"
              min={1}
              max={720}
              defaultValue={72}
              className="w-20 bg-bg-elevated/80 border border-border-default rounded-lg px-3 py-2 text-sm text-text-primary focus:outline-none focus:border-accent/50"
            />
            <span className="text-xs text-text-muted">hours</span>
          </div>
        </div>
        <button
          type="submit"
          disabled={creating}
          className="px-4 py-2 text-sm font-medium text-white bg-accent rounded-lg hover:bg-accent/80 transition-colors cursor-pointer disabled:opacity-50"
        >
          {creating ? "Generating..." : "Generate Code"}
        </button>
      </form>
    </div>
  );
}
