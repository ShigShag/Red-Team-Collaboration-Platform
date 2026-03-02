import type { EngagementStatus } from "@/lib/engagement-status";

export interface TimelineEvent {
  id: string;
  eventType: string;
  metadata: Record<string, string | null>;
  createdAt: string; // ISO string (serialized from server)
  actorId: string;
  actorUsername: string;
  actorDisplayName: string | null;
  actorAvatarPath: string | null;
}

export interface TimelinePhase {
  status: EngagementStatus;
  startTime: number; // epoch ms
  endTime: number; // epoch ms
  label: string;
  color: string;
}

export interface TimelineCategory {
  id: string;
  name: string;
  icon: string;
  color: string | null;
}

export interface CategoryActivityRange {
  categoryId: string;
  categoryName: string;
  categoryColor: string | null;
  categoryIcon: string;
  firstActivity: number; // epoch ms
  lastActivity: number; // epoch ms
  eventCount: number;
}

export type EventFilterType =
  | "findings"
  | "actions"
  | "resources"
  | "scope"
  | "members"
  | "status"
  | "comments"
  | "reports";

export interface TimelineData {
  events: TimelineEvent[];
  engagement: {
    id: string;
    name: string;
    status: string;
    createdAt: string;
    startDate: string | null;
    endDate: string | null;
  };
  categories: TimelineCategory[];
}
