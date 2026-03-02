"use client";

import { createContext, useContext, useState, useCallback } from "react";
import type { MentionMember } from "../../../components/mention-autocomplete";
import type { QACommentData } from "./report-qa-queries";

interface QAFieldContextValue {
  qaMode: boolean;
  activeFieldKey: string | null; // "sectionKey:fieldPath"
  setActiveFieldKey: (key: string | null) => void;
  getFieldComments: (sectionKey: string, fieldPath: string) => QACommentData[];
  getFieldOpenCount: (sectionKey: string, fieldPath: string) => number;
  // Props needed to create/display comments
  engagementId: string;
  reportConfigId: string;
  currentUserId: string;
  isOwner: boolean;
  members: MentionMember[];
  onCommentsChange: () => void;
}

const QAFieldContext = createContext<QAFieldContextValue | null>(null);

export function useQAField(): QAFieldContextValue | null {
  return useContext(QAFieldContext);
}

interface QAFieldProviderProps {
  qaMode: boolean;
  commentsBySection: Record<string, QACommentData[]>;
  engagementId: string;
  reportConfigId: string;
  currentUserId: string;
  isOwner: boolean;
  members: MentionMember[];
  onCommentsChange: () => void;
  /** Controlled active field key — when provided, parent owns the state */
  activeFieldKey?: string | null;
  onActiveFieldKeyChange?: (key: string | null) => void;
  children: React.ReactNode;
}

export function QAFieldProvider({
  qaMode,
  commentsBySection,
  engagementId,
  reportConfigId,
  currentUserId,
  isOwner,
  members,
  onCommentsChange,
  activeFieldKey: controlledKey,
  onActiveFieldKeyChange,
  children,
}: QAFieldProviderProps) {
  const [internalKey, setInternalKey] = useState<string | null>(null);
  const activeFieldKey = controlledKey !== undefined ? controlledKey : internalKey;
  function setActiveFieldKey(key: string | null) {
    if (onActiveFieldKeyChange) {
      onActiveFieldKeyChange(key);
    } else {
      setInternalKey(key);
    }
  }

  const getFieldComments = useCallback(
    (sectionKey: string, fieldPath: string): QACommentData[] => {
      const sectionComments = commentsBySection[sectionKey] ?? [];
      return sectionComments.filter(
        (c) => c.fieldPath === fieldPath && !c.deletedAt
      );
    },
    [commentsBySection]
  );

  const getFieldOpenCount = useCallback(
    (sectionKey: string, fieldPath: string): number => {
      return getFieldComments(sectionKey, fieldPath).filter(
        (c) => c.qaStatus === "open"
      ).length;
    },
    [getFieldComments]
  );

  return (
    <QAFieldContext.Provider
      value={{
        qaMode,
        activeFieldKey,
        setActiveFieldKey,
        getFieldComments,
        getFieldOpenCount,
        engagementId,
        reportConfigId,
        currentUserId,
        isOwner,
        members,
        onCommentsChange,
      }}
    >
      {children}
    </QAFieldContext.Provider>
  );
}
