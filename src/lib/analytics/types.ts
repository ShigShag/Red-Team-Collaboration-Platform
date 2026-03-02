export interface SeverityDistribution {
  severity: "critical" | "high" | "medium" | "low" | "info" | "fixed";
  count: number;
}

export interface CategoryProgress {
  categoryId: string;
  categoryName: string;
  color: string | null;
  findingCount: number;
  actionCount: number;
  resourceCount: number;
}

export interface OperatorContribution {
  userId: string;
  username: string;
  displayName: string | null;
  findingsCreated: number;
  actionsCreated: number;
  resourcesCreated: number;
}

export interface DayCount {
  date: string;
  count: number;
}

export interface TeamMember {
  userId: string;
  username: string;
  displayName: string | null;
  avatarPath: string | null;
  role: string;
}

export interface EngagementAnalytics {
  engagementId: string;
  engagementName: string;
  status: string;
  totalFindings: number;
  totalActions: number;
  totalResources: number;
  avgCvss: number | null;
  cvssCount: number;
  highestCvss: number | null;
  severity: SeverityDistribution[];
  categoryProgress: CategoryProgress[];
  categoriesTotal: number;
  categoriesWithActivity: number;
  operators: OperatorContribution[];
  members: TeamMember[];
  activityByDay: DayCount[];
  findingsByDay: DayCount[];
  totalActivityEvents: number;
}

export interface DashboardAnalytics {
  totalEngagements: number;
  activeEngagements: number;
  totalFindings: number;
  severityAcrossAll: SeverityDistribution[];
  findingsPerEngagement: { name: string; count: number; status: string }[];
  recentActivity: DayCount[];
  myContributions: {
    findingsCreated: number;
    actionsCreated: number;
    resourcesCreated: number;
  };
}
