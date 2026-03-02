"use client";

import { useState, useActionState } from "react";
import { Modal } from "../components/modal";
import { createEngagement, type EngagementState } from "./actions";

const initialState: EngagementState = {};

export function CreateEngagementForm() {
  const [isOpen, setIsOpen] = useState(false);
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [excludeCoordinators, setExcludeCoordinators] = useState(false);
  const [state, action, pending] = useActionState(
    createEngagement,
    initialState
  );

  return (
    <>
      <button
        onClick={() => setIsOpen(true)}
        className="flex items-center gap-2 px-3 py-2 text-sm font-medium text-bg-primary bg-accent hover:bg-accent-bright rounded active:scale-[0.97] transition-all duration-100"
      >
        <svg
          className="w-4 h-4"
          fill="none"
          viewBox="0 0 24 24"
          strokeWidth={2}
          stroke="currentColor"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            d="M12 4.5v15m7.5-7.5h-15"
          />
        </svg>
        New Engagement
      </button>

      <Modal
        isOpen={isOpen}
        onClose={() => setIsOpen(false)}
        title="Create Engagement"
      >
        <form action={action} className="space-y-4">
          {/* Name */}
          <div>
            <label
              htmlFor="name"
              className="block text-[10px] font-mono font-medium text-text-secondary uppercase tracking-[0.15em] mb-1.5"
            >
              Engagement Name
            </label>
            <input
              id="name"
              name="name"
              type="text"
              required
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. Acme Corp Red Team 2026"
              className="w-full px-3 py-2 bg-bg-primary border border-border-default rounded text-sm text-text-primary placeholder:text-text-muted focus:outline-none focus:border-accent/50 focus:ring-1 focus:ring-accent/20 transition-colors duration-100"
            />
            {state.fieldErrors?.name && (
              <p className="text-xs text-danger mt-1 animate-slide-in-left">
                {state.fieldErrors.name[0]}
              </p>
            )}
          </div>

          {/* Description */}
          <div>
            <label
              htmlFor="description"
              className="block text-[10px] font-mono font-medium text-text-secondary uppercase tracking-[0.15em] mb-1.5"
            >
              Description{" "}
              <span className="text-text-muted font-normal">(optional)</span>
            </label>
            <textarea
              id="description"
              name="description"
              rows={3}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Brief description of the engagement scope..."
              className="w-full px-3 py-2 bg-bg-primary border border-border-default rounded text-sm text-text-primary placeholder:text-text-muted focus:outline-none focus:border-accent/50 focus:ring-1 focus:ring-accent/20 transition-colors duration-100 resize-none"
            />
            {state.fieldErrors?.description && (
              <p className="text-xs text-danger mt-1 animate-slide-in-left">
                {state.fieldErrors.description[0]}
              </p>
            )}
          </div>

          {/* Dates */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label
                htmlFor="startDate"
                className="block text-[10px] font-mono font-medium text-text-secondary uppercase tracking-[0.15em] mb-1.5"
              >
                Start Date{" "}
                <span className="text-text-muted font-normal">(optional)</span>
              </label>
              <input
                id="startDate"
                name="startDate"
                type="date"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
                className="w-full px-3 py-2 bg-bg-primary border border-border-default rounded text-sm text-text-primary focus:outline-none focus:border-accent/50 focus:ring-1 focus:ring-accent/20 transition-colors duration-100 [color-scheme:dark]"
              />
            </div>
            <div>
              <label
                htmlFor="endDate"
                className="block text-[10px] font-mono font-medium text-text-secondary uppercase tracking-[0.15em] mb-1.5"
              >
                End Date{" "}
                <span className="text-text-muted font-normal">(optional)</span>
              </label>
              <input
                id="endDate"
                name="endDate"
                type="date"
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
                className="w-full px-3 py-2 bg-bg-primary border border-border-default rounded text-sm text-text-primary focus:outline-none focus:border-accent/50 focus:ring-1 focus:ring-accent/20 transition-colors duration-100 [color-scheme:dark]"
              />
            </div>
          </div>

          {/* Exclude Coordinators */}
          <div className="flex items-center gap-2.5">
            <input type="hidden" name="excludeCoordinators" value={String(excludeCoordinators)} />
            <button
              type="button"
              role="switch"
              aria-checked={excludeCoordinators}
              onClick={() => setExcludeCoordinators(!excludeCoordinators)}
              className={`relative inline-flex h-5 w-9 flex-shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none ${
                excludeCoordinators ? "bg-accent" : "bg-border-default"
              }`}
            >
              <span
                className={`pointer-events-none inline-block h-4 w-4 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out ${
                  excludeCoordinators ? "translate-x-4" : "translate-x-0"
                }`}
              />
            </button>
            <div>
              <span className="text-xs text-text-secondary">
                Exclude coordinators
              </span>
              <p className="text-[10px] text-text-muted">
                Prevent coordinators from viewing this engagement
              </p>
            </div>
          </div>

          {/* Error */}
          {state.error && (
            <div className="bg-danger-dim/30 border border-danger/20 rounded px-3 py-2 text-sm text-danger animate-slide-in-left">
              {state.error}
            </div>
          )}

          {/* Actions */}
          <div className="flex items-center justify-end gap-3 pt-2">
            <button
              type="button"
              onClick={() => setIsOpen(false)}
              className="px-3 py-2 text-sm text-text-secondary hover:text-text-primary transition-colors duration-100"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={pending}
              className="px-4 py-2 text-sm font-medium text-bg-primary bg-accent hover:bg-accent-bright rounded active:scale-[0.97] transition-all duration-100 disabled:opacity-50"
            >
              {pending ? (
                <span className="flex items-center gap-2">
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
                  Creating…
                </span>
              ) : (
                "Create Engagement"
              )}
            </button>
          </div>
        </form>
      </Modal>
    </>
  );
}
