"use client";

import { useState, useEffect, useActionState } from "react";
import { Modal } from "@/app/(protected)/components/modal";
import { createCategory, createSubCategory, type CategoryState } from "./actions";
import {
  createPreset,
  updatePreset,
  deletePreset,
  type PresetState,
} from "./preset-actions";

interface Preset {
  id: string;
  name: string;
  icon: string;
  color: string | null;
  description: string | null;
  isSystem: boolean;
  createdBy: string | null;
}

const initialCategoryState: CategoryState = {};
const initialPresetState: PresetState = {};

const colorSwatches = [
  "#3b82f6",
  "#22c55e",
  "#eab308",
  "#ef4444",
  "#8b5cf6",
  "#ec4899",
  "#f97316",
  "#14b8a6",
];

type ModalMode = "presets" | "form" | "preset-form";

export function AddCategoryModal({
  isOpen,
  onClose,
  engagementId,
  parentId,
}: {
  isOpen: boolean;
  onClose: () => void;
  engagementId: string;
  parentId?: string;
}) {
  const [mode, setMode] = useState<ModalMode>("presets");
  const [presets, setPresets] = useState<Preset[]>([]);
  const [loadingPresets, setLoadingPresets] = useState(false);
  const [selectedPreset, setSelectedPreset] = useState<Preset | null>(null);
  const [manageMode, setManageMode] = useState(false);
  const [editingPreset, setEditingPreset] = useState<Preset | null>(null);
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);
  const [deleteError, setDeleteError] = useState<string | null>(null);

  // Category create action — use sub-category action when parentId is set
  const [catState, catAction, catPending] = useActionState(
    parentId ? createSubCategory : createCategory,
    initialCategoryState
  );
  const [prevCatSuccess, setPrevCatSuccess] = useState<string | undefined>(undefined);

  // Preset CRUD actions
  const [createPState, createPAction, createPPending] = useActionState(
    createPreset,
    initialPresetState
  );
  const [lastCreatePState, setLastCreatePState] = useState(createPState);

  const [updatePState, updatePAction, updatePPending] = useActionState(
    updatePreset,
    initialPresetState
  );
  const [lastUpdatePState, setLastUpdatePState] = useState(updatePState);

  const [deletePState, deletePAction, deletePPending] = useActionState(
    deletePreset,
    initialPresetState
  );
  const [lastDeletePState, setLastDeletePState] = useState(deletePState);

  // Preset form fields
  const [presetName, setPresetName] = useState("");
  const [presetIcon, setPresetIcon] = useState("\u{1F3AF}");
  const [presetColor, setPresetColor] = useState("");
  const [presetDescription, setPresetDescription] = useState("");

  // Category form fields
  const [name, setName] = useState("");
  const [color, setColor] = useState("");
  const [description, setDescription] = useState("");

  // Close on category create success
  useEffect(() => {
    if (catState.success && catState.success !== prevCatSuccess) {
      setPrevCatSuccess(catState.success);
      onClose();
    }
  }, [catState.success, prevCatSuccess, onClose]);

  // Handle preset create success
  useEffect(() => {
    if (createPState !== lastCreatePState) {
      setLastCreatePState(createPState);
      if (createPState.success && createPState.preset) {
        setPresets((prev) => [...prev, createPState.preset!]);
        setMode("presets");
      }
    }
  }, [createPState, lastCreatePState]);

  // Handle preset update success
  useEffect(() => {
    if (updatePState !== lastUpdatePState) {
      setLastUpdatePState(updatePState);
      if (updatePState.success && updatePState.preset) {
        setPresets((prev) =>
          prev.map((p) =>
            p.id === updatePState.preset!.id ? updatePState.preset! : p
          )
        );
        setMode("presets");
      }
    }
  }, [updatePState, lastUpdatePState]);

  // Handle preset delete success/error
  useEffect(() => {
    if (deletePState !== lastDeletePState) {
      setLastDeletePState(deletePState);
      if (deletePState.success) {
        setPresets((prev) => prev.filter((p) => p.id !== confirmDeleteId));
        setConfirmDeleteId(null);
        setDeleteError(null);
      } else if (deletePState.error) {
        setDeleteError(deletePState.error);
      }
    }
  }, [deletePState, lastDeletePState, confirmDeleteId]);

  // Fetch presets when modal opens
  useEffect(() => {
    if (isOpen && presets.length === 0) {
      setLoadingPresets(true);
      fetch("/api/category-presets")
        .then((r) => r.json())
        .then((data) => setPresets(data))
        .catch(() => {})
        .finally(() => setLoadingPresets(false));
    }
  }, [isOpen, presets.length]);

  // Reset on close
  useEffect(() => {
    if (!isOpen) {
      setMode("presets");
      setSelectedPreset(null);
      setManageMode(false);
      setEditingPreset(null);
      setConfirmDeleteId(null);
      setDeleteError(null);
      setName("");
      setColor("");
      setDescription("");
      setPresetName("");
      setPresetIcon("\u{1F3AF}");
      setPresetColor("");
      setPresetDescription("");
    }
  }, [isOpen]);

  function handlePresetSelect(preset: Preset) {
    if (manageMode) return;
    setSelectedPreset(preset);
    setName(preset.name);
    setColor(preset.color || "");
    setDescription("");
    setMode("form");
  }

  function handleEditPreset(preset: Preset) {
    setEditingPreset(preset);
    setPresetName(preset.name);
    setPresetIcon(preset.icon);
    setPresetColor(preset.color || "");
    setPresetDescription(preset.description || "");
    setMode("preset-form");
  }

  function handleCreatePreset() {
    setEditingPreset(null);
    setPresetName("");
    setPresetIcon("\u{1F3AF}");
    setPresetColor("");
    setPresetDescription("");
    setMode("preset-form");
  }

  const modalTitle =
    mode === "preset-form"
      ? editingPreset
        ? "Edit Type"
        : "Create Type"
      : parentId
        ? "Add Sub-category"
        : "Add Category";

  return (
    <Modal isOpen={isOpen} onClose={onClose} title={modalTitle}>
      {/* ───── Preset Picker ───── */}
      {mode === "presets" && (
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <p className="text-xs text-text-muted">Select a category type</p>
            <button
              type="button"
              onClick={() => {
                setManageMode(!manageMode);
                setConfirmDeleteId(null);
                setDeleteError(null);
              }}
              className={`text-[10px] font-mono px-2 py-1 rounded transition-all duration-100 ${
                manageMode
                  ? "text-accent bg-accent/10 border border-accent/20"
                  : "text-text-muted hover:text-text-secondary border border-transparent"
              }`}
            >
              {manageMode ? "Done" : "Manage"}
            </button>
          </div>

          {loadingPresets ? (
            <div className="flex items-center justify-center py-8">
              <svg
                className="animate-spin h-5 w-5 text-text-muted"
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
            </div>
          ) : (
            <div className="grid grid-cols-2 gap-2">
              {presets.map((preset) => (
                <div key={preset.id}>
                  <div
                    role={manageMode ? undefined : "button"}
                    tabIndex={manageMode ? undefined : 0}
                    onClick={() => handlePresetSelect(preset)}
                    onKeyDown={(e) => {
                      if (!manageMode && (e.key === "Enter" || e.key === " ")) {
                        e.preventDefault();
                        handlePresetSelect(preset);
                      }
                    }}
                    className={`w-full flex items-center gap-2.5 p-3 text-left bg-bg-primary border border-border-default rounded-lg transition-all duration-100 ${
                      manageMode
                        ? "cursor-default"
                        : "hover:border-accent/30 hover:bg-bg-elevated/50 cursor-pointer"
                    }`}
                  >
                    <span className="text-lg flex-shrink-0">{preset.icon}</span>
                    <div className="min-w-0 flex-1">
                      <span className="text-xs font-medium text-text-primary block truncate">
                        {preset.name}
                      </span>
                      {preset.description && (
                        <span className="text-[10px] text-text-muted block truncate">
                          {preset.description}
                        </span>
                      )}
                    </div>

                    {/* Edit / Delete buttons — always visible in manage mode */}
                    {manageMode && !preset.isSystem && confirmDeleteId !== preset.id && (
                      <div className="flex items-center gap-0.5 flex-shrink-0">
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            handleEditPreset(preset);
                          }}
                          className="p-1 text-text-muted hover:text-accent transition-colors duration-100"
                          title="Edit type"
                        >
                          <svg
                            className="w-3 h-3"
                            fill="none"
                            viewBox="0 0 24 24"
                            strokeWidth={1.5}
                            stroke="currentColor"
                          >
                            <path
                              strokeLinecap="round"
                              strokeLinejoin="round"
                              d="m16.862 4.487 1.687-1.688a1.875 1.875 0 1 1 2.652 2.652L10.582 16.07a4.5 4.5 0 0 1-1.897 1.13L6 18l.8-2.685a4.5 4.5 0 0 1 1.13-1.897l8.932-8.931Zm0 0L19.5 7.125"
                            />
                          </svg>
                        </button>
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            setConfirmDeleteId(preset.id);
                            setDeleteError(null);
                          }}
                          className="p-1 text-text-muted hover:text-danger transition-colors duration-100"
                          title="Delete type"
                        >
                          <svg
                            className="w-3 h-3"
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
                    )}
                  </div>

                  {/* Manage mode controls — inline in the button row */}
                  {manageMode && !preset.isSystem && confirmDeleteId === preset.id && (
                    <div className="flex items-center gap-1.5 mt-1">
                      <form action={deletePAction} className="flex">
                        <input
                          type="hidden"
                          name="presetId"
                          value={preset.id}
                        />
                        <button
                          type="submit"
                          disabled={deletePPending}
                          className="text-[10px] font-medium text-danger hover:text-danger/80 disabled:opacity-50"
                        >
                          {deletePPending ? "..." : "Delete"}
                        </button>
                      </form>
                      <button
                        type="button"
                        onClick={() => {
                          setConfirmDeleteId(null);
                          setDeleteError(null);
                        }}
                        className="text-[10px] text-text-muted hover:text-text-secondary"
                      >
                        Cancel
                      </button>
                      {deleteError && (
                        <span className="text-[9px] text-danger ml-1 animate-slide-in-left">
                          {deleteError}
                        </span>
                      )}
                    </div>
                  )}
                </div>
              ))}

              {/* Create new type card (manage mode) */}
              {manageMode && (
                <button
                  type="button"
                  onClick={handleCreatePreset}
                  className="flex items-center gap-2.5 p-3 text-left border border-dashed border-border-default rounded-lg hover:border-accent/30 transition-all duration-100"
                >
                  <span className="text-lg text-text-muted">+</span>
                  <span className="text-xs font-medium text-text-secondary">
                    Create new type
                  </span>
                </button>
              )}
            </div>
          )}
        </div>
      )}

      {/* ───── Category Form (after selecting a preset) ───── */}
      {mode === "form" && (
        <form action={catAction} className="space-y-4">
          <input type="hidden" name="engagementId" value={engagementId} />
          {parentId && <input type="hidden" name="parentId" value={parentId} />}
          <input type="hidden" name="presetId" value={selectedPreset!.id} />

          {/* Back to presets */}
          <button
            type="button"
            onClick={() => {
              setMode("presets");
              setSelectedPreset(null);
            }}
            className="inline-flex items-center gap-1 text-xs text-text-muted hover:text-text-secondary transition-colors duration-100"
          >
            <svg
              className="w-3 h-3"
              fill="none"
              viewBox="0 0 24 24"
              strokeWidth={1.5}
              stroke="currentColor"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M10.5 19.5L3 12m0 0l7.5-7.5M3 12h18"
              />
            </svg>
            Change type
          </button>

          {/* Selected type indicator */}
          <div className="flex items-center gap-2.5 px-3 py-2 bg-bg-primary border border-accent/20 rounded-lg">
            <span className="text-lg">{selectedPreset!.icon}</span>
            <div>
              <span className="text-xs font-medium text-accent">
                {selectedPreset!.name}
              </span>
              <span className="text-[10px] text-text-muted block">
                Category type
              </span>
            </div>
          </div>

          {/* Name */}
          <div>
            <label className="block text-[10px] font-mono font-medium text-text-secondary uppercase tracking-[0.15em] mb-1.5">
              Name
            </label>
            <input
              name="name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              required
              placeholder="e.g. Internal Network"
              className="w-full px-3 py-2 bg-bg-primary border border-border-default rounded text-sm text-text-primary placeholder:text-text-muted focus:outline-none focus:border-accent/50 focus:ring-1 focus:ring-accent/20 transition-colors duration-100"
            />
            {catState.fieldErrors?.name && (
              <p className="text-[10px] text-danger mt-1">
                {catState.fieldErrors.name[0]}
              </p>
            )}
          </div>

          {/* Color picker */}
          <div>
            <label className="block text-[10px] font-mono font-medium text-text-secondary uppercase tracking-[0.15em] mb-1.5">
              Color{" "}
              <span className="text-text-muted font-normal">(optional)</span>
            </label>
            <div className="flex items-center gap-2">
              {colorSwatches.map((c) => (
                <button
                  key={c}
                  type="button"
                  onClick={() => setColor(color === c ? "" : c)}
                  className={`w-6 h-6 rounded-full transition-all duration-100 ${
                    color === c
                      ? "ring-2 ring-white/60 ring-offset-2 ring-offset-bg-surface scale-110"
                      : "hover:scale-110"
                  }`}
                  style={{ backgroundColor: c }}
                />
              ))}
              {color && (
                <button
                  type="button"
                  onClick={() => setColor("")}
                  className="text-[10px] text-text-muted hover:text-text-secondary ml-1"
                >
                  clear
                </button>
              )}
            </div>
            <input type="hidden" name="color" value={color} />
          </div>

          {/* Description */}
          <div>
            <label className="block text-[10px] font-mono font-medium text-text-secondary uppercase tracking-[0.15em] mb-1.5">
              Description{" "}
              <span className="text-text-muted font-normal">(optional)</span>
            </label>
            <textarea
              name="description"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={2}
              placeholder="Scope, targets, notes..."
              className="w-full px-3 py-2 bg-bg-primary border border-border-default rounded text-sm text-text-primary placeholder:text-text-muted focus:outline-none focus:border-accent/50 focus:ring-1 focus:ring-accent/20 transition-colors duration-100 resize-none"
            />
            {catState.fieldErrors?.description && (
              <p className="text-[10px] text-danger mt-1">
                {catState.fieldErrors.description[0]}
              </p>
            )}
          </div>

          {/* Error */}
          {catState.error && (
            <div className="bg-danger-dim/30 border border-danger/20 rounded px-3 py-2 text-sm text-danger animate-slide-in-left">
              {catState.error}
            </div>
          )}

          {/* Actions */}
          <div className="flex items-center justify-end gap-3 pt-1">
            <button
              type="button"
              onClick={onClose}
              className="px-3 py-2 text-sm text-text-secondary hover:text-text-primary transition-colors duration-100"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={catPending || !name.trim()}
              className="px-4 py-2 text-sm font-medium text-bg-primary bg-accent hover:bg-accent-bright rounded active:scale-[0.97] transition-all duration-100 disabled:opacity-50"
            >
              {catPending ? "Adding..." : parentId ? "Add Sub-category" : "Add Category"}
            </button>
          </div>
        </form>
      )}

      {/* ───── Preset Create/Edit Form ───── */}
      {mode === "preset-form" && (
        <form
          action={editingPreset ? updatePAction : createPAction}
          className="space-y-4"
        >
          {editingPreset && (
            <input type="hidden" name="presetId" value={editingPreset.id} />
          )}

          {/* Back to presets */}
          <button
            type="button"
            onClick={() => setMode("presets")}
            className="inline-flex items-center gap-1 text-xs text-text-muted hover:text-text-secondary transition-colors duration-100"
          >
            <svg
              className="w-3 h-3"
              fill="none"
              viewBox="0 0 24 24"
              strokeWidth={1.5}
              stroke="currentColor"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M10.5 19.5L3 12m0 0l7.5-7.5M3 12h18"
              />
            </svg>
            Back to types
          </button>

          {/* Icon */}
          <div>
            <label className="block text-[10px] font-mono font-medium text-text-secondary uppercase tracking-[0.15em] mb-1.5">
              Icon
            </label>
            <div className="flex items-center gap-3">
              <input
                name="icon"
                value={presetIcon}
                onChange={(e) => setPresetIcon(e.target.value)}
                placeholder="Paste an emoji"
                className="w-16 px-2 py-2 bg-bg-primary border border-border-default rounded text-center text-lg text-text-primary focus:outline-none focus:border-accent/50 focus:ring-1 focus:ring-accent/20 transition-colors duration-100"
              />
              <div className="text-[10px] text-text-muted leading-relaxed space-y-1">
                <div className="flex items-center gap-1.5">
                  <svg className="w-3 h-3 flex-shrink-0" viewBox="0 0 24 24" fill="currentColor"><path d="M20 3H4a1 1 0 00-1 1v16a1 1 0 001 1h16a1 1 0 001-1V4a1 1 0 00-1-1zm-8.5 12.5l-4-4 1.41-1.41L11.5 12.67l5.09-5.09L18 9l-6.5 6.5z"/></svg>
                  <span>Linux: <kbd className="px-1 py-0.5 bg-bg-primary border border-border-default rounded text-[9px] font-mono">Ctrl + .</kbd> or <kbd className="px-1 py-0.5 bg-bg-primary border border-border-default rounded text-[9px] font-mono">Ctrl + ;</kbd></span>
                </div>
                <div className="flex items-center gap-1.5">
                  <svg className="w-3 h-3 flex-shrink-0" viewBox="0 0 24 24" fill="currentColor"><path d="M3 3h8v2H5v14h14v-6h2v8H3V3zm9.3 9.3L20 4.6V9h2V2h-7v2h4.4l-7.7 7.7 1.6 1.6z"/></svg>
                  <span>Windows: <kbd className="px-1 py-0.5 bg-bg-primary border border-border-default rounded text-[9px] font-mono">Win + .</kbd></span>
                </div>
                <div className="flex items-center gap-1.5">
                  <svg className="w-3 h-3 flex-shrink-0" viewBox="0 0 24 24" fill="currentColor"><path d="M18.71 19.5c-.83 1.24-1.71 2.45-3.05 2.47-1.34.03-1.77-.79-3.29-.79-1.53 0-2 .77-3.27.82-1.31.05-2.3-1.32-3.14-2.53C4.25 17 2.94 12.45 4.7 9.39c.87-1.52 2.43-2.48 4.12-2.51 1.28-.02 2.5.87 3.29.87.78 0 2.26-1.07 3.8-.91.65.03 2.47.26 3.64 1.98-.09.06-2.17 1.28-2.15 3.81.03 3.02 2.65 4.03 2.68 4.04-.03.07-.42 1.44-1.38 2.83M13 3.5c.73-.83 1.94-1.46 2.94-1.5.13 1.17-.34 2.35-1.04 3.19-.69.85-1.83 1.51-2.95 1.42-.15-1.15.41-2.35 1.05-3.11z"/></svg>
                  <span>macOS: <kbd className="px-1 py-0.5 bg-bg-primary border border-border-default rounded text-[9px] font-mono">Cmd + Ctrl + Space</kbd></span>
                </div>
                <div className="flex items-center gap-1.5 pt-0.5">
                  <svg className="w-3 h-3 flex-shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="10"/><path d="M2 12h20M12 2a15.3 15.3 0 014 10 15.3 15.3 0 01-4 10 15.3 15.3 0 01-4-10 15.3 15.3 0 014-10z"/></svg>
                  <span>Or copy from <a href="https://emojipedia.org" target="_blank" rel="noopener noreferrer" className="text-accent hover:text-accent-bright underline underline-offset-2">emojipedia.org</a></span>
                </div>
              </div>
            </div>
            {(editingPreset ? updatePState : createPState).fieldErrors
              ?.icon && (
              <p className="text-[10px] text-danger mt-1">
                {(editingPreset ? updatePState : createPState).fieldErrors!
                  .icon![0]}
              </p>
            )}
          </div>

          {/* Name */}
          <div>
            <label className="block text-[10px] font-mono font-medium text-text-secondary uppercase tracking-[0.15em] mb-1.5">
              Name
            </label>
            <input
              name="name"
              value={presetName}
              onChange={(e) => setPresetName(e.target.value)}
              required
              placeholder="e.g. Kubernetes Cluster"
              className="w-full px-3 py-2 bg-bg-primary border border-border-default rounded text-sm text-text-primary placeholder:text-text-muted focus:outline-none focus:border-accent/50 focus:ring-1 focus:ring-accent/20 transition-colors duration-100"
            />
            {(editingPreset ? updatePState : createPState).fieldErrors
              ?.name && (
              <p className="text-[10px] text-danger mt-1">
                {(editingPreset ? updatePState : createPState).fieldErrors!
                  .name![0]}
              </p>
            )}
          </div>

          {/* Color */}
          <div>
            <label className="block text-[10px] font-mono font-medium text-text-secondary uppercase tracking-[0.15em] mb-1.5">
              Color{" "}
              <span className="text-text-muted font-normal">(optional)</span>
            </label>
            <div className="flex items-center gap-2">
              {colorSwatches.map((c) => (
                <button
                  key={c}
                  type="button"
                  onClick={() =>
                    setPresetColor(presetColor === c ? "" : c)
                  }
                  className={`w-6 h-6 rounded-full transition-all duration-100 ${
                    presetColor === c
                      ? "ring-2 ring-white/60 ring-offset-2 ring-offset-bg-surface scale-110"
                      : "hover:scale-110"
                  }`}
                  style={{ backgroundColor: c }}
                />
              ))}
              {presetColor && (
                <button
                  type="button"
                  onClick={() => setPresetColor("")}
                  className="text-[10px] text-text-muted hover:text-text-secondary ml-1"
                >
                  clear
                </button>
              )}
            </div>
            <input type="hidden" name="color" value={presetColor} />
          </div>

          {/* Description */}
          <div>
            <label className="block text-[10px] font-mono font-medium text-text-secondary uppercase tracking-[0.15em] mb-1.5">
              Description{" "}
              <span className="text-text-muted font-normal">(optional)</span>
            </label>
            <textarea
              name="description"
              value={presetDescription}
              onChange={(e) => setPresetDescription(e.target.value)}
              rows={2}
              placeholder="What does this type represent?"
              className="w-full px-3 py-2 bg-bg-primary border border-border-default rounded text-sm text-text-primary placeholder:text-text-muted focus:outline-none focus:border-accent/50 focus:ring-1 focus:ring-accent/20 transition-colors duration-100 resize-none"
            />
          </div>

          {/* Error */}
          {(editingPreset ? updatePState : createPState).error && (
            <div className="bg-danger-dim/30 border border-danger/20 rounded px-3 py-2 text-sm text-danger animate-slide-in-left">
              {(editingPreset ? updatePState : createPState).error}
            </div>
          )}

          {/* Actions */}
          <div className="flex items-center justify-end gap-3 pt-1">
            <button
              type="button"
              onClick={() => setMode("presets")}
              className="px-3 py-2 text-sm text-text-secondary hover:text-text-primary transition-colors duration-100"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={
                (editingPreset ? updatePPending : createPPending) ||
                !presetName.trim() ||
                !presetIcon
              }
              className="px-4 py-2 text-sm font-medium text-bg-primary bg-accent hover:bg-accent-bright rounded active:scale-[0.97] transition-all duration-100 disabled:opacity-50"
            >
              {editingPreset
                ? updatePPending
                  ? "Saving..."
                  : "Save Changes"
                : createPPending
                  ? "Creating..."
                  : "Create Type"}
            </button>
          </div>
        </form>
      )}
    </Modal>
  );
}
