"use client";

import { useActionState, useState } from "react";
import { updatePlatformSettings, purgeAllChatData, type AdminState } from "../actions";

const initialState: AdminState = {};

const MODES = [
  { value: "open", label: "Open", desc: "Anyone can register" },
  { value: "code", label: "Security Code", desc: "Requires a shared security code (env var)" },
  { value: "invite", label: "Invite Only", desc: "Requires an admin-generated invite code" },
  { value: "disabled", label: "Disabled", desc: "No new registrations allowed" },
];

function formatBytes(bytes: number): string {
  if (bytes < 1e9) return `${(bytes / 1e6).toFixed(0)} MB`;
  return `${(bytes / 1e9).toFixed(1)} GB`;
}

export function SettingsForm({ settings, chatStats }: {
  settings: Record<string, string>;
  chatStats: { sessions: number; messages: number };
}) {
  const [state, action, pending] = useActionState(updatePlatformSettings, initialState);
  const [purgeState, purgeAction, purgePending] = useActionState(purgeAllChatData, initialState);
  const [ollamaTest, setOllamaTest] = useState<{
    loading: boolean;
    error?: string;
    models?: { name: string; size: number }[];
  }>({ loading: false });

  async function testOllamaConnection() {
    const urlInput = document.querySelector<HTMLInputElement>('input[name="ollamaBaseUrl"]');
    const url = urlInput?.value?.trim();
    if (!url) {
      setOllamaTest({ loading: false, error: "Enter an Ollama URL first" });
      return;
    }

    setOllamaTest({ loading: true });
    try {
      const res = await fetch("/api/admin/ollama-test", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ url }),
      });
      const data = await res.json();
      if (!res.ok) {
        setOllamaTest({ loading: false, error: data.error || "Connection failed" });
      } else {
        setOllamaTest({ loading: false, models: data.models });
      }
    } catch {
      setOllamaTest({ loading: false, error: "Request failed" });
    }
  }

  return (
    <>
    <form action={action} className="space-y-6">
      {state.error && (
        <div className="flex items-center gap-2.5 bg-danger-dim/20 border border-danger/15 rounded-lg px-4 py-3 text-sm text-danger">
          <svg className="w-4 h-4 shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <circle cx="12" cy="12" r="10" />
            <line x1="15" y1="9" x2="9" y2="15" />
            <line x1="9" y1="9" x2="15" y2="15" />
          </svg>
          {state.error}
        </div>
      )}

      {state.success && (
        <div className="flex items-center gap-2.5 bg-green-500/10 border border-green-500/20 rounded-lg px-4 py-3 text-sm text-green-500">
          <svg className="w-4 h-4 shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14" />
            <polyline points="22 4 12 14.01 9 11.01" />
          </svg>
          {state.success}
        </div>
      )}

      {/* Registration Mode */}
      <div className="relative bg-bg-surface/80 border border-border-default rounded-lg p-6">
        <div className="absolute top-0 left-6 right-6 h-px bg-gradient-to-r from-transparent via-border-default to-transparent" />
        <h2 className="text-xs font-medium text-text-secondary uppercase tracking-wider mb-4">
          Registration Mode
        </h2>
        <div className="space-y-3">
          {MODES.map((mode) => (
            <label
              key={mode.value}
              className="flex items-start gap-3 p-3 rounded-lg border border-border-default hover:border-accent/20 transition-colors cursor-pointer"
            >
              <input
                type="radio"
                name="registrationMode"
                value={mode.value}
                defaultChecked={settings.registration_mode === mode.value}
                className="mt-0.5 accent-[var(--color-accent)]"
              />
              <div>
                <p className="text-sm font-medium text-text-primary">
                  {mode.label}
                </p>
                <p className="text-xs text-text-muted mt-0.5">{mode.desc}</p>
              </div>
            </label>
          ))}
        </div>
      </div>

      {/* Session TTL */}
      <div className="relative bg-bg-surface/80 border border-border-default rounded-lg p-6">
        <div className="absolute top-0 left-6 right-6 h-px bg-gradient-to-r from-transparent via-border-default to-transparent" />
        <h2 className="text-xs font-medium text-text-secondary uppercase tracking-wider mb-4">
          Session Duration
        </h2>
        <div className="flex items-center gap-3">
          <input
            type="number"
            name="sessionTtlHours"
            min={1}
            max={720}
            defaultValue={settings.session_ttl_hours || "24"}
            className="w-24 bg-bg-elevated/80 border border-border-default rounded-lg px-3 py-2 text-sm text-text-primary focus:outline-none focus:border-accent/50"
          />
          <span className="text-sm text-text-muted">hours</span>
        </div>
        <p className="text-xs text-text-muted mt-2">
          How long sessions remain valid before requiring re-authentication (1-720 hours)
        </p>
      </div>

      {/* Require 2FA */}
      <div className="relative bg-bg-surface/80 border border-border-default rounded-lg p-6">
        <div className="absolute top-0 left-6 right-6 h-px bg-gradient-to-r from-transparent via-border-default to-transparent" />
        <h2 className="text-xs font-medium text-text-secondary uppercase tracking-wider mb-4">
          Security Policy
        </h2>
        <label className="flex items-center gap-3 cursor-pointer">
          <input
            type="checkbox"
            name="require2fa"
            value="true"
            defaultChecked={settings.require_2fa === "true"}
            className="accent-[var(--color-accent)]"
          />
          <div>
            <p className="text-sm font-medium text-text-primary">
              Require Two-Factor Authentication
            </p>
            <p className="text-xs text-text-muted mt-0.5">
              All users must enable 2FA before accessing the platform
            </p>
          </div>
        </label>
      </div>

      {/* AI Assistant (Ollama) */}
      <div className="relative bg-bg-surface/80 border border-border-default rounded-lg p-6">
        <div className="absolute top-0 left-6 right-6 h-px bg-gradient-to-r from-transparent via-border-default to-transparent" />
        <h2 className="text-xs font-medium text-text-secondary uppercase tracking-wider mb-4">
          AI Assistant
        </h2>
        <p className="text-xs text-text-muted mb-4">
          Connect to an external Ollama instance to enable the AI chat assistant within engagements.
          Leave the URL empty to disable the feature.
        </p>

        <div className="space-y-4">
          {/* Ollama URL */}
          <div>
            <label className="block text-sm font-medium text-text-primary mb-1.5">
              Ollama URL
            </label>
            <div className="flex gap-2">
              <input
                type="text"
                name="ollamaBaseUrl"
                placeholder="http://localhost:11434"
                defaultValue={settings.ollama_base_url || ""}
                className="flex-1 bg-bg-elevated/80 border border-border-default rounded-lg px-3 py-2 text-sm text-text-primary placeholder:text-text-muted/50 focus:outline-none focus:border-accent/50 font-mono"
              />
              <button
                type="button"
                onClick={testOllamaConnection}
                disabled={ollamaTest.loading}
                className="px-3 py-2 text-xs font-medium text-text-secondary bg-bg-elevated/80 border border-border-default rounded-lg hover:border-accent/30 hover:text-text-primary transition-colors cursor-pointer disabled:opacity-50 whitespace-nowrap"
              >
                {ollamaTest.loading ? "Testing..." : "Test Connection"}
              </button>
            </div>

            {/* Test result */}
            {ollamaTest.error && (
              <div className="mt-2 flex items-center gap-2 text-xs text-danger">
                <svg className="w-3.5 h-3.5 shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <circle cx="12" cy="12" r="10" />
                  <line x1="15" y1="9" x2="9" y2="15" />
                  <line x1="9" y1="9" x2="15" y2="15" />
                </svg>
                {ollamaTest.error}
              </div>
            )}
            {ollamaTest.models && (
              <div className="mt-2 space-y-1.5">
                <div className="flex items-center gap-2 text-xs text-green-500">
                  <svg className="w-3.5 h-3.5 shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14" />
                    <polyline points="22 4 12 14.01 9 11.01" />
                  </svg>
                  Connected — {ollamaTest.models.length} model{ollamaTest.models.length !== 1 ? "s" : ""} available
                </div>
                {ollamaTest.models.length > 0 && (
                  <div className="ml-5.5 space-y-0.5">
                    {ollamaTest.models.map((m) => (
                      <div key={m.name} className="text-xs text-text-muted font-mono">
                        {m.name}
                        <span className="text-text-muted/50 ml-2">({formatBytes(m.size)})</span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Chat Model */}
          <div>
            <label className="block text-sm font-medium text-text-primary mb-1.5">
              Chat Model
            </label>
            {ollamaTest.models && ollamaTest.models.length > 0 ? (
              <select
                key={`chat-model-${settings.ollama_model}`}
                name="ollamaModel"
                defaultValue={
                  ollamaTest.models.some((m) => m.name === (settings.ollama_model || "llama3.1:70b"))
                    ? (settings.ollama_model || "llama3.1:70b")
                    : ollamaTest.models[0].name
                }
                className="w-full bg-bg-elevated/80 border border-border-default rounded-lg px-3 py-2 text-sm text-text-primary focus:outline-none focus:border-accent/50 font-mono cursor-pointer"
              >
                {ollamaTest.models.map((m) => (
                  <option key={m.name} value={m.name}>
                    {m.name} ({formatBytes(m.size)})
                  </option>
                ))}
              </select>
            ) : (
              <input
                key={`chat-model-input-${settings.ollama_model}`}
                type="text"
                name="ollamaModel"
                placeholder="llama3.1:70b"
                defaultValue={settings.ollama_model || "llama3.1:70b"}
                className="w-full bg-bg-elevated/80 border border-border-default rounded-lg px-3 py-2 text-sm text-text-primary placeholder:text-text-muted/50 focus:outline-none focus:border-accent/50 font-mono"
              />
            )}
            <p className="text-xs text-text-muted mt-1.5">
              {ollamaTest.models
                ? "Model used for the engagement chat assistant."
                : "Use \"Test Connection\" to load available models, or type a model name manually."}
            </p>
          </div>

          {/* Finding Assist Model */}
          <div>
            <label className="block text-sm font-medium text-text-primary mb-1.5">
              Finding Assist Model
            </label>
            {ollamaTest.models && ollamaTest.models.length > 0 ? (
              <select
                key={`finding-model-${settings.ollama_finding_model}`}
                name="ollamaFindingModel"
                defaultValue={
                  settings.ollama_finding_model && ollamaTest.models.some((m) => m.name === settings.ollama_finding_model)
                    ? settings.ollama_finding_model
                    : ""
                }
                className="w-full bg-bg-elevated/80 border border-border-default rounded-lg px-3 py-2 text-sm text-text-primary focus:outline-none focus:border-accent/50 font-mono cursor-pointer"
              >
                <option value="">Same as Chat Model</option>
                {ollamaTest.models.map((m) => (
                  <option key={m.name} value={m.name}>
                    {m.name} ({formatBytes(m.size)})
                  </option>
                ))}
              </select>
            ) : (
              <input
                key={`finding-model-input-${settings.ollama_finding_model}`}
                type="text"
                name="ollamaFindingModel"
                placeholder="Same as Chat Model"
                defaultValue={settings.ollama_finding_model || ""}
                className="w-full bg-bg-elevated/80 border border-border-default rounded-lg px-3 py-2 text-sm text-text-primary placeholder:text-text-muted/50 focus:outline-none focus:border-accent/50 font-mono"
              />
            )}
            <p className="text-xs text-text-muted mt-1.5">
              Model used for AI-assisted finding rewriting. Leave empty to use the chat model.
            </p>
          </div>
        </div>
      </div>

      {/* Submit */}
      <div className="flex justify-end">
        <button
          type="submit"
          disabled={pending}
          className="px-5 py-2.5 text-sm font-medium text-white bg-accent rounded-lg hover:bg-accent/80 transition-colors cursor-pointer disabled:opacity-50"
        >
          {pending ? "Saving..." : "Save Settings"}
        </button>
      </div>
    </form>

    {/* AI Chat Data Management (separate form) */}
    {(chatStats.sessions > 0 || chatStats.messages > 0) && (
      <form action={purgeAction}>
        <div className="relative bg-bg-surface/80 border border-border-default rounded-lg p-6">
          <div className="absolute top-0 left-6 right-6 h-px bg-gradient-to-r from-transparent via-border-default to-transparent" />
          <h2 className="text-xs font-medium text-text-secondary uppercase tracking-wider mb-4">
            AI Chat Data
          </h2>
          <div className="flex items-center justify-between">
            <div className="text-sm text-text-muted">
              <span className="text-text-primary font-medium">{chatStats.sessions}</span> session{chatStats.sessions !== 1 ? "s" : ""}
              {" / "}
              <span className="text-text-primary font-medium">{chatStats.messages}</span> message{chatStats.messages !== 1 ? "s" : ""}
            </div>
            <button
              type="submit"
              disabled={purgePending}
              className="px-3 py-1.5 text-xs font-medium text-danger bg-danger/10 border border-danger/20 rounded-lg hover:bg-danger/20 transition-colors cursor-pointer disabled:opacity-50"
            >
              {purgePending ? "Purging..." : "Purge All Chat Data"}
            </button>
          </div>
          {purgeState.success && (
            <p className="text-xs text-green-500 mt-2">{purgeState.success}</p>
          )}
        </div>
      </form>
    )}
    </>
  );
}
