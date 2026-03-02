"use client";

import { useState, useEffect, useRef, useActionState } from "react";
import { updateCategory, type CategoryState } from "../actions";

interface CategoryHeaderProps {
  category: {
    id: string;
    name: string;
    typeName: string;
    icon: string;
    color: string | null;
    description: string | null;
    locked: boolean;
    createdAt: string;
  };
  engagementId: string;
  canEdit: boolean;
  isOwner: boolean;
}

const initialState: CategoryState = {};

export function CategoryHeader({
  category,
  engagementId,
  canEdit,
  isOwner,
}: CategoryHeaderProps) {
  const [updateState, updateAction, updatePending] = useActionState(
    updateCategory,
    initialState
  );
  const [isEditing, setIsEditing] = useState(false);
  const [editName, setEditName] = useState(category.name);
  const [editDescription, setEditDescription] = useState(category.description ?? "");
  const [editColor, setEditColor] = useState(category.color ?? "");
  const nameInputRef = useRef<HTMLInputElement>(null);

  const canEditThis = canEdit && (!category.locked || isOwner);

  useEffect(() => {
    if (updateState.success) {
      setIsEditing(false);
    }
  }, [updateState.success]);

  useEffect(() => {
    if (isEditing && nameInputRef.current) {
      nameInputRef.current.focus();
      nameInputRef.current.select();
    }
  }, [isEditing]);

  useEffect(() => {
    if (!isEditing) {
      setEditName(category.name);
      setEditDescription(category.description ?? "");
      setEditColor(category.color ?? "");
    }
  }, [category.name, category.description, category.color, isEditing]);

  function cancelEditing() {
    setIsEditing(false);
    setEditName(category.name);
    setEditDescription(category.description ?? "");
    setEditColor(category.color ?? "");
  }

  if (isEditing) {
    return (
      <div className="mb-8">
        <form
          action={updateAction}
          onKeyDown={(e) => { if (e.key === "Escape") cancelEditing(); }}
        >
          <input type="hidden" name="engagementId" value={engagementId} />
          <input type="hidden" name="categoryId" value={category.id} />
          {editColor && <input type="hidden" name="color" value={editColor} />}
          {editDescription && <input type="hidden" name="description" value={editDescription} />}

          <div className="flex items-center gap-3 mb-3">
            <span
              className="text-2xl"
              style={
                editColor
                  ? { filter: "drop-shadow(0 0 6px " + editColor + "40)" }
                  : undefined
              }
            >
              {category.icon}
            </span>
            <div className="flex-1">
              <input
                ref={nameInputRef}
                type="text"
                name="name"
                value={editName}
                onChange={(e) => setEditName(e.target.value)}
                className="w-full px-3 py-1.5 text-xl font-semibold text-text-primary bg-bg-base border border-border-default rounded focus:outline-none focus:border-accent/50 transition-colors tracking-tight"
                placeholder="Category name"
                maxLength={150}
              />
              <div className="flex items-center gap-2 mt-1.5">
                <span className="text-xs text-text-muted">{category.typeName}</span>
                {category.locked && (
                  <span className="inline-flex items-center gap-0.5 text-[10px] text-amber-400">
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
                        d="M16.5 10.5V6.75a4.5 4.5 0 1 0-9 0v3.75m-.75 11.25h10.5a2.25 2.25 0 0 0 2.25-2.25v-6.75a2.25 2.25 0 0 0-2.25-2.25H6.75a2.25 2.25 0 0 0-2.25 2.25v6.75a2.25 2.25 0 0 0 2.25 2.25Z"
                      />
                    </svg>
                    Locked
                  </span>
                )}
              </div>
            </div>
          </div>

          <div className="ml-[44px] space-y-3">
            <textarea
              value={editDescription}
              onChange={(e) => setEditDescription(e.target.value)}
              className="w-full px-3 py-2 text-sm text-text-secondary bg-bg-base border border-border-default rounded focus:outline-none focus:border-accent/50 transition-colors resize-none"
              placeholder="Description (optional)"
              rows={3}
              maxLength={500}
            />

            <div className="flex items-center gap-2">
              <label className="text-xs text-text-muted">Color:</label>
              <input
                type="color"
                value={editColor || "#e8735a"}
                onChange={(e) => setEditColor(e.target.value)}
                className="w-7 h-7 rounded cursor-pointer border border-border-default bg-transparent p-0"
              />
              {editColor && (
                <button
                  type="button"
                  onClick={() => setEditColor("")}
                  className="text-xs text-text-muted hover:text-text-primary transition-colors"
                >
                  clear
                </button>
              )}
            </div>

            <div className="flex items-center gap-2 pt-1">
              <button
                type="submit"
                disabled={updatePending || !editName.trim()}
                className="px-4 py-1.5 text-xs font-medium text-white bg-accent hover:bg-accent-bright rounded active:scale-[0.97] transition-all duration-100 disabled:opacity-50"
              >
                {updatePending ? "Saving..." : "Save"}
              </button>
              <button
                type="button"
                onClick={cancelEditing}
                className="px-4 py-1.5 text-xs text-text-muted hover:text-text-primary transition-colors duration-100"
              >
                Cancel
              </button>
            </div>

            {updateState.error && (
              <p className="text-xs text-danger animate-slide-in-left">
                {updateState.error}
              </p>
            )}
            {updateState.fieldErrors?.name && (
              <p className="text-xs text-danger">
                {updateState.fieldErrors.name[0]}
              </p>
            )}
          </div>
        </form>
      </div>
    );
  }

  return (
    <div className="mb-8 group/header">
      <div className="flex items-center gap-3 mb-2">
        <span
          className="text-2xl"
          style={
            category.color
              ? { filter: "drop-shadow(0 0 6px " + category.color + "40)" }
              : undefined
          }
        >
          {category.icon}
        </span>
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-xl font-semibold text-text-primary tracking-tight">
              {category.name}
            </h1>
            {canEditThis && (
              <button
                type="button"
                onClick={() => setIsEditing(true)}
                className="opacity-0 group-hover/header:opacity-100 p-1 text-text-muted hover:text-accent transition-all duration-100"
                title="Edit category"
              >
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M16.862 4.487l1.687-1.688a1.875 1.875 0 112.652 2.652L10.582 16.07a4.5 4.5 0 01-1.897 1.13L6 18l.8-2.685a4.5 4.5 0 011.13-1.897l8.932-8.931zm0 0L19.5 7.125M18 14v4.75A2.25 2.25 0 0115.75 21H5.25A2.25 2.25 0 013 18.75V8.25A2.25 2.25 0 015.25 6H10" />
                </svg>
              </button>
            )}
          </div>
          <div className="flex items-center gap-2 mt-0.5">
            <span className="text-xs text-text-muted">{category.typeName}</span>
            {category.locked && (
              <span className="inline-flex items-center gap-0.5 text-[10px] text-amber-400">
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
                    d="M16.5 10.5V6.75a4.5 4.5 0 1 0-9 0v3.75m-.75 11.25h10.5a2.25 2.25 0 0 0 2.25-2.25v-6.75a2.25 2.25 0 0 0-2.25-2.25H6.75a2.25 2.25 0 0 0-2.25 2.25v6.75a2.25 2.25 0 0 0 2.25 2.25Z"
                  />
                </svg>
                Locked
              </span>
            )}
            <span className="text-[10px] text-text-muted font-mono">
              Created{" "}
              {new Date(category.createdAt).toLocaleDateString("en-US", {
                month: "short",
                day: "numeric",
                year: "numeric",
              })}
            </span>
          </div>
        </div>
      </div>
      {category.description && (
        <p className="text-sm text-text-secondary mt-2 ml-[44px]">
          {category.description}
        </p>
      )}
    </div>
  );
}
