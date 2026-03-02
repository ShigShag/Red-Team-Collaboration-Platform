"use client";

import { useState, useEffect, useRef, useActionState } from "react";
import Link from "next/link";
import {
  removeCategory,
  assignToCategory,
  unassignFromCategory,
  toggleCategoryLock,
  updateCategory,
  type CategoryState,
} from "./actions";
import { AssignDropdown } from "./assign-dropdown";

interface Assignment {
  userId: string;
  username: string;
  displayName: string | null;
  avatarUrl: string | null;
}

interface Member {
  userId: string;
  username: string;
  displayName: string | null;
  avatarUrl: string | null;
}

interface Category {
  id: string;
  parentId: string | null;
  name: string;
  typeName: string;
  icon: string;
  color: string | null;
  description: string | null;
  locked: boolean;
  createdAt: string;
  resourceCount: number;
  actionCount: number;
  findingCount: number;
  assignments: Assignment[];
  children: Category[];
}

interface CategoryCardProps {
  category: Category;
  engagementId: string;
  currentUserId: string;
  currentUserRole: string;
  members: Member[];
}

const initialState: CategoryState = {};

export function CategoryCard({
  category,
  engagementId,
  currentUserId,
  currentUserRole,
  members,
}: CategoryCardProps) {
  const [removeState, removeAction, removePending] = useActionState(
    removeCategory,
    initialState
  );
  const [assignState, assignAction, assignPending] = useActionState(
    assignToCategory,
    initialState
  );
  const [unassignState, unassignAction, unassignPending] = useActionState(
    unassignFromCategory,
    initialState
  );
  const [lockState, lockAction, lockPending] = useActionState(
    toggleCategoryLock,
    initialState
  );
  const [updateState, updateAction, updatePending] = useActionState(
    updateCategory,
    initialState
  );
  const [confirmRemove, setConfirmRemove] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [editName, setEditName] = useState(category.name);
  const [editDescription, setEditDescription] = useState(category.description ?? "");
  const [editColor, setEditColor] = useState(category.color ?? "");
  const nameInputRef = useRef<HTMLInputElement>(null);

  const canEdit = currentUserRole === "write" || currentUserRole === "owner";
  const isOwner = currentUserRole === "owner";
  const canEditThis = canEdit && (!category.locked || isOwner);
  const isSelfAssigned = category.assignments.some(
    (a) => a.userId === currentUserId
  );

  // Close edit mode on successful update
  useEffect(() => {
    if (updateState.success) {
      setIsEditing(false);
    }
  }, [updateState.success]);

  // Focus name input when entering edit mode
  useEffect(() => {
    if (isEditing && nameInputRef.current) {
      nameInputRef.current.focus();
      nameInputRef.current.select();
    }
  }, [isEditing]);

  // Sync local state when category props change
  useEffect(() => {
    if (!isEditing) {
      setEditName(category.name);
      setEditDescription(category.description ?? "");
      setEditColor(category.color ?? "");
    }
  }, [category.name, category.description, category.color, isEditing]);

  function startEditing(e: React.MouseEvent) {
    e.preventDefault();
    e.stopPropagation();
    setIsEditing(true);
  }

  function cancelEditing() {
    setIsEditing(false);
    setEditName(category.name);
    setEditDescription(category.description ?? "");
    setEditColor(category.color ?? "");
  }

  return (
    <div className="group relative bg-bg-surface/80 border border-border-default rounded-lg p-4 hover:border-border-accent/30 transition-all duration-150">
      {/* Color accent stripe */}
      {(isEditing ? editColor : category.color) && (
        <div
          className="absolute top-0 left-4 right-4 h-px"
          style={{ backgroundColor: isEditing ? editColor : (category.color ?? undefined) }}
        />
      )}

      {isEditing ? (
        /* ── Edit Mode ── */
        <form action={updateAction} onKeyDown={(e) => { if (e.key === "Escape") cancelEditing(); }}>
          <input type="hidden" name="engagementId" value={engagementId} />
          <input type="hidden" name="categoryId" value={category.id} />
          {editColor && <input type="hidden" name="color" value={editColor} />}
          {editDescription && <input type="hidden" name="description" value={editDescription} />}

          {/* Name + icon row */}
          <div className="flex items-center gap-2.5 mb-2">
            <span
              className="text-lg flex-shrink-0"
              style={editColor ? { filter: "drop-shadow(0 0 4px " + editColor + "40)" } : undefined}
            >
              {category.icon}
            </span>
            <input
              ref={nameInputRef}
              type="text"
              name="name"
              value={editName}
              onChange={(e) => setEditName(e.target.value)}
              className="flex-1 min-w-0 px-2 py-1 text-sm font-medium text-text-primary bg-bg-base border border-border-default rounded focus:outline-none focus:border-accent/50 transition-colors"
              placeholder="Category name"
              maxLength={150}
            />
          </div>

          {/* Description */}
          <div className="pl-[34px] mb-2">
            <textarea
              value={editDescription}
              onChange={(e) => setEditDescription(e.target.value)}
              className="w-full px-2 py-1 text-[11px] text-text-secondary bg-bg-base border border-border-default rounded focus:outline-none focus:border-accent/50 transition-colors resize-none"
              placeholder="Description (optional)"
              rows={2}
              maxLength={500}
            />
          </div>

          {/* Color picker */}
          <div className="pl-[34px] mb-3 flex items-center gap-2">
            <label className="text-[10px] text-text-muted">Color:</label>
            <input
              type="color"
              value={editColor || "#e8735a"}
              onChange={(e) => setEditColor(e.target.value)}
              className="w-6 h-6 rounded cursor-pointer border border-border-default bg-transparent p-0"
            />
            {editColor && (
              <button
                type="button"
                onClick={() => setEditColor("")}
                className="text-[10px] text-text-muted hover:text-text-primary transition-colors"
              >
                clear
              </button>
            )}
          </div>

          {/* Actions */}
          <div className="pl-[34px] flex items-center gap-2">
            <button
              type="submit"
              disabled={updatePending || !editName.trim()}
              className="px-3 py-1 text-[11px] font-medium text-white bg-accent hover:bg-accent-bright rounded active:scale-[0.97] transition-all duration-100 disabled:opacity-50"
            >
              {updatePending ? "Saving..." : "Save"}
            </button>
            <button
              type="button"
              onClick={cancelEditing}
              className="px-3 py-1 text-[11px] text-text-muted hover:text-text-primary transition-colors duration-100"
            >
              Cancel
            </button>
          </div>

          {/* Errors */}
          {updateState.error && (
            <p className="text-[10px] text-danger mt-2 pl-[34px] animate-slide-in-left">
              {updateState.error}
            </p>
          )}
          {updateState.fieldErrors?.name && (
            <p className="text-[10px] text-danger mt-1 pl-[34px]">
              {updateState.fieldErrors.name[0]}
            </p>
          )}
        </form>
      ) : (
        /* ── Display Mode ── */
        <>
          {/* Header */}
          <div className="flex items-start justify-between mb-1">
            <Link
              href={`/engagements/${engagementId}/categories/${category.id}`}
              className="flex items-center gap-2.5 min-w-0 hover:opacity-80 transition-opacity duration-100"
            >
              <span
                className="text-lg flex-shrink-0"
                style={category.color ? { filter: "drop-shadow(0 0 4px " + category.color + "40)" } : undefined}
              >
                {category.icon}
              </span>
              <div className="min-w-0">
                <h3 className="text-sm font-medium text-text-primary leading-tight truncate">
                  {category.name}
                </h3>
                <span className="text-[10px] text-text-muted truncate block">
                  {category.typeName}
                </span>
              </div>
            </Link>

            <div className="flex items-center gap-2 flex-shrink-0">
              <span className="text-[10px] text-text-muted font-mono">
                {new Date(category.createdAt).toLocaleDateString("en-US", {
                  month: "short",
                  day: "numeric",
                })}
              </span>

              {/* Count badges */}
              {category.children.length > 0 && (
                <span className="inline-flex items-center gap-0.5 text-[10px] text-text-muted font-mono" title={`${category.children.length} sub-categories`}>
                  <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 12.75V12A2.25 2.25 0 014.5 9.75h15A2.25 2.25 0 0121.75 12v.75m-8.69-6.44l-2.12-2.12a1.5 1.5 0 00-1.061-.44H4.5A2.25 2.25 0 002.25 6v12a2.25 2.25 0 002.25 2.25h15A2.25 2.25 0 0021.75 18V9a2.25 2.25 0 00-2.25-2.25h-5.379a1.5 1.5 0 01-1.06-.44z" />
                  </svg>
                  {category.children.length}
                </span>
              )}
              {category.resourceCount > 0 && (
                <span className="inline-flex items-center gap-0.5 text-[10px] text-text-muted font-mono" title={`${category.resourceCount} resources`}>
                  <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M18.375 12.739l-7.693 7.693a4.5 4.5 0 01-6.364-6.364l10.94-10.94A3 3 0 1119.5 7.372L8.552 18.32m.009-.01l-.01.01m5.699-9.941l-7.81 7.81a1.5 1.5 0 002.112 2.13" />
                  </svg>
                  {category.resourceCount}
                </span>
              )}
              {category.actionCount > 0 && (
                <span className="inline-flex items-center gap-0.5 text-[10px] text-text-muted font-mono" title={`${category.actionCount} actions`}>
                  <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 13.5l10.5-11.25L12 10.5h8.25L9.75 21.75 12 13.5H3.75z" />
                  </svg>
                  {category.actionCount}
                </span>
              )}
              {category.findingCount > 0 && (
                <span className="inline-flex items-center gap-0.5 text-[10px] text-red-400 font-mono" title={`${category.findingCount} findings`}>
                  <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m0-10.036A11.959 11.959 0 013.598 6 11.99 11.99 0 003 9.749c0 5.592 3.824 10.29 9 11.623 5.176-1.332 9-6.03 9-11.622 0-1.31-.21-2.571-.598-3.751h-.152c-3.196 0-6.1-1.248-8.25-3.285zm0 13.036h.008v.008H12v-.008z" />
                  </svg>
                  {category.findingCount}
                </span>
              )}

              {/* Edit button */}
              {canEditThis && !confirmRemove && (
                <button
                  type="button"
                  onClick={startEditing}
                  className="opacity-0 group-hover:opacity-100 p-1 text-text-muted hover:text-accent transition-all duration-100 flex-shrink-0"
                  title="Edit category"
                >
                  <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M16.862 4.487l1.687-1.688a1.875 1.875 0 112.652 2.652L10.582 16.07a4.5 4.5 0 01-1.897 1.13L6 18l.8-2.685a4.5 4.5 0 011.13-1.897l8.932-8.931zm0 0L19.5 7.125M18 14v4.75A2.25 2.25 0 0115.75 21H5.25A2.25 2.25 0 013 18.75V8.25A2.25 2.25 0 015.25 6H10" />
                  </svg>
                </button>
              )}

              {/* Lock indicator for non-owners */}
              {category.locked && !isOwner && (
                <span title="Locked">
                  <svg className="w-3 h-3 text-text-muted" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M16.5 10.5V6.75a4.5 4.5 0 1 0-9 0v3.75m-.75 11.25h10.5a2.25 2.25 0 0 0 2.25-2.25v-6.75a2.25 2.25 0 0 0-2.25-2.25H6.75a2.25 2.25 0 0 0-2.25 2.25v6.75a2.25 2.25 0 0 0 2.25 2.25Z" />
                  </svg>
                </span>
              )}

              {/* Owner: lock/unlock toggle */}
              {isOwner && (
                <form action={lockAction}>
                  <input type="hidden" name="engagementId" value={engagementId} />
                  <input type="hidden" name="categoryId" value={category.id} />
                  <button
                    type="submit"
                    disabled={lockPending}
                    className={`p-1 transition-all duration-100 disabled:opacity-50 ${
                      category.locked
                        ? "text-amber-400 hover:text-amber-300"
                        : "opacity-0 group-hover:opacity-100 text-text-muted hover:text-amber-400"
                    }`}
                    title={category.locked ? "Unlock category" : "Lock category"}
                  >
                    {category.locked ? (
                      <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" d="M16.5 10.5V6.75a4.5 4.5 0 1 0-9 0v3.75m-.75 11.25h10.5a2.25 2.25 0 0 0 2.25-2.25v-6.75a2.25 2.25 0 0 0-2.25-2.25H6.75a2.25 2.25 0 0 0-2.25 2.25v6.75a2.25 2.25 0 0 0 2.25 2.25Z" />
                      </svg>
                    ) : (
                      <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" d="M13.5 10.5V6.75a4.5 4.5 0 1 1 9 0v3.75M3.75 21.75h10.5a2.25 2.25 0 0 0 2.25-2.25v-6.75a2.25 2.25 0 0 0-2.25-2.25H3.75a2.25 2.25 0 0 0-2.25 2.25v6.75a2.25 2.25 0 0 0 2.25 2.25Z" />
                      </svg>
                    )}
                  </button>
                </form>
              )}

              {/* Remove button — hidden for non-owners when locked */}
              {canEdit && !confirmRemove && !(category.locked && !isOwner) && (
              <button
                type="button"
                onClick={() => setConfirmRemove(true)}
                className="opacity-0 group-hover:opacity-100 p-1 text-text-muted hover:text-danger transition-all duration-100 flex-shrink-0"
                title="Remove category"
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
              )}

              {canEdit && confirmRemove && (
                <div className="flex items-center gap-1.5 animate-slide-in-left">
                  <form action={removeAction}>
                    <input type="hidden" name="engagementId" value={engagementId} />
                    <input type="hidden" name="categoryId" value={category.id} />
                    <button
                      type="submit"
                      disabled={removePending}
                      className="px-2 py-0.5 text-[10px] font-medium text-white bg-danger hover:bg-danger/80 rounded active:scale-[0.97] transition-all duration-100 disabled:opacity-50"
                    >
                      {removePending ? "..." : "Remove"}
                    </button>
                  </form>
                  <button
                    type="button"
                    onClick={() => setConfirmRemove(false)}
                    className="px-2 py-0.5 text-[10px] text-text-muted hover:text-text-primary transition-colors duration-100"
                  >
                    Cancel
                  </button>
                </div>
              )}
            </div>
          </div>

          {/* Description */}
          {category.description && (
            <p className="text-[11px] text-text-muted mt-0.5 mb-2 line-clamp-2 pl-[34px]">
              {category.description}
            </p>
          )}

          {/* Assignments row */}
          <div className="flex items-center gap-1.5 mt-3 pl-[34px]">
            {category.assignments.map((a) => {
              const name = a.displayName || a.username;
              const initial = name[0].toUpperCase();

              return (
                <div
                  key={a.userId}
                  className="relative group/avatar"
                  title={name}
                >
                  {a.avatarUrl ? (
                    <img
                      src={a.avatarUrl}
                      alt=""
                      className="w-6 h-6 rounded-full object-cover border-2 border-bg-surface"
                    />
                  ) : (
                    <div className="w-6 h-6 rounded-full bg-accent/10 border-2 border-bg-surface flex items-center justify-center">
                      <span className="text-[8px] font-medium text-accent">
                        {initial}
                      </span>
                    </div>
                  )}
                  {isOwner && (
                    <form action={unassignAction} className="absolute -top-1.5 -right-1.5 opacity-0 group-hover/avatar:opacity-100 transition-opacity duration-100">
                      <input type="hidden" name="engagementId" value={engagementId} />
                      <input type="hidden" name="categoryId" value={category.id} />
                      <input type="hidden" name="userId" value={a.userId} />
                      <button
                        type="submit"
                        disabled={unassignPending}
                        className="w-3.5 h-3.5 rounded-full bg-danger flex items-center justify-center hover:bg-danger/80 transition-colors duration-100 disabled:opacity-50"
                        title={`Remove ${name}`}
                      >
                        <svg className="w-2 h-2 text-white" fill="none" viewBox="0 0 24 24" strokeWidth={3} stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                        </svg>
                      </button>
                    </form>
                  )}
                </div>
              );
            })}

            {/* Self-assign / unassign toggle */}
            {canEdit && !isSelfAssigned && (
              <form action={assignAction}>
                <input type="hidden" name="engagementId" value={engagementId} />
                <input type="hidden" name="categoryId" value={category.id} />
                <input type="hidden" name="userId" value={currentUserId} />
                <button
                  type="submit"
                  disabled={assignPending}
                  className="w-6 h-6 rounded-full border border-dashed border-text-muted/30 hover:border-accent/50 flex items-center justify-center transition-colors duration-100 disabled:opacity-50"
                  title="Join this category"
                >
                  <svg
                    className="w-3 h-3 text-text-muted"
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
                </button>
              </form>
            )}

            {canEdit && isSelfAssigned && (
              <form action={unassignAction}>
                <input type="hidden" name="engagementId" value={engagementId} />
                <input type="hidden" name="categoryId" value={category.id} />
                <input type="hidden" name="userId" value={currentUserId} />
                <button
                  type="submit"
                  disabled={unassignPending}
                  className="text-[9px] font-mono text-text-muted hover:text-danger transition-colors duration-100 disabled:opacity-50 ml-1"
                  title="Leave this category"
                >
                  leave
                </button>
              </form>
            )}

            {/* Owner: assign others dropdown */}
            {isOwner && (
              <AssignDropdown
                categoryId={category.id}
                engagementId={engagementId}
                members={members}
                assignedUserIds={category.assignments.map((a) => a.userId)}
              />
            )}
          </div>

          {/* Error display */}
          {(removeState.error || assignState.error || unassignState.error || lockState.error) && (
            <p className="text-[10px] text-danger mt-2 pl-[34px] animate-slide-in-left">
              {removeState.error || assignState.error || unassignState.error || lockState.error}
            </p>
          )}
        </>
      )}
    </div>
  );
}
