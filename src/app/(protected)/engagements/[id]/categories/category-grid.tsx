"use client";

import { useState } from "react";
import { CategoryCard } from "./category-card";
import { AddCategoryModal } from "./add-category-modal";

interface Assignment {
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

interface Member {
  userId: string;
  username: string;
  displayName: string | null;
  avatarUrl: string | null;
}

interface CategoryGridProps {
  categories: Category[];
  engagementId: string;
  currentUserId: string;
  currentUserRole: string;
  members: Member[];
  parentId?: string;
  readOnly?: boolean;
}

export function CategoryGrid({
  categories,
  engagementId,
  currentUserId,
  currentUserRole,
  members,
  parentId,
  readOnly,
}: CategoryGridProps) {
  const [showAddModal, setShowAddModal] = useState(false);
  const canEdit = !readOnly && (currentUserRole === "write" || currentUserRole === "owner");

  // Empty state for readers
  if (categories.length === 0 && !canEdit) {
    return (
      <div className="border border-border-subtle border-dashed rounded-lg p-4 text-center">
        <p className="text-xs text-text-muted">
          No categories have been added yet
        </p>
      </div>
    );
  }

  return (
    <>
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <div className="h-px w-8 bg-accent/50" />
          <span className="text-[10px] font-medium text-accent tracking-[0.2em] uppercase">
            {parentId ? "Sub-categories" : "Categories"}
          </span>
          <span className="text-[10px] font-mono text-text-muted">
            {categories.length}
          </span>
        </div>
        {canEdit && (
          <button
            onClick={() => setShowAddModal(true)}
            className="inline-flex items-center gap-1.5 px-2.5 py-1.5 text-xs text-text-muted hover:text-text-primary border border-border-default hover:border-accent/30 rounded transition-all duration-100 hover:bg-bg-elevated/50"
          >
            <svg
              className="w-3.5 h-3.5"
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
            Add
          </button>
        )}
      </div>

      {/* Empty state */}
      {categories.length === 0 && (
        <div className="border border-border-subtle border-dashed rounded-lg p-4 text-center">
          <p className="text-xs text-text-muted">
            {parentId ? "No sub-categories yet" : "No categories yet"}
          </p>
        </div>
      )}

      {/* Grid */}
      {categories.length > 0 && (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {categories.map((category) => (
            <CategoryCard
              key={category.id}
              category={category}
              engagementId={engagementId}
              currentUserId={currentUserId}
              currentUserRole={currentUserRole}
              members={members}
            />
          ))}
        </div>
      )}

      <AddCategoryModal
        isOpen={showAddModal}
        onClose={() => setShowAddModal(false)}
        engagementId={engagementId}
        parentId={parentId}
      />
    </>
  );
}
