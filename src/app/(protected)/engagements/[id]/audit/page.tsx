import { redirect, notFound } from "next/navigation";
import { BackLink } from "../back-link";
import { eq, and, desc, sql, or, ilike, inArray, gte, lte, type SQL } from "drizzle-orm";
import { db } from "@/db";
import {
  users,
  engagements,
  engagementMembers,
  engagementCategories,
  engagementActivityLog,
  resources,
  resourceFields,
  categoryActions,
  actionTags,
  tags,
} from "@/db/schema";
import { getSession } from "@/lib/auth/session";
import { AuditTimeline } from "./audit-timeline";

const PAGE_SIZE = 50;

type ActivityEventType =
  | "category_created"
  | "category_updated"
  | "category_deleted"
  | "resource_created"
  | "resource_updated"
  | "resource_deleted"
  | "action_created"
  | "action_updated"
  | "action_deleted"
  | "finding_created"
  | "finding_updated"
  | "finding_deleted"
  | "member_joined"
  | "member_removed"
  | "member_role_changed"
  | "member_assigned"
  | "member_unassigned"
  | "engagement_status_changed"
  | "report_qa_requested"
  | "report_qa_comment"
  | "report_qa_resolved"
  | "report_qa_signed_off";

const VALID_EVENT_TYPES = new Set<string>([
  "category_created",
  "category_updated",
  "category_deleted",
  "resource_created",
  "resource_updated",
  "resource_deleted",
  "action_created",
  "action_updated",
  "action_deleted",
  "finding_created",
  "finding_updated",
  "finding_deleted",
  "member_joined",
  "member_removed",
  "member_role_changed",
  "member_assigned",
  "member_unassigned",
  "report_qa_requested",
  "report_qa_comment",
  "report_qa_resolved",
  "report_qa_signed_off",
]);

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function escapeLikePattern(s: string): string {
  return s.replace(/[%_\\]/g, "\\$&");
}

interface Props {
  params: Promise<{ id: string }>;
  searchParams: Promise<{
    page?: string;
    q?: string;
    deep?: string;
    types?: string;
    category?: string;
    actor?: string;
    tag?: string;
    from?: string;
    to?: string;
  }>;
}

export default async function AuditPage({ params, searchParams }: Props) {
  const { id: engagementId } = await params;
  const sp = await searchParams;
  const session = await getSession();
  if (!session) redirect("/login");

  const page = Math.max(1, parseInt(sp.page ?? "1", 10) || 1);

  // Parse and validate filter params
  const searchQuery = (sp.q ?? "").slice(0, 200).trim();
  const deepSearch = sp.deep === "1";
  const typesList = (sp.types ?? "")
    .split(",")
    .filter((t) => VALID_EVENT_TYPES.has(t));
  const categoryFilter = sp.category && UUID_RE.test(sp.category) ? sp.category : "";
  const actorFilter = sp.actor && UUID_RE.test(sp.actor) ? sp.actor : "";
  const tagFilter = sp.tag && UUID_RE.test(sp.tag) ? sp.tag : "";
  const dateFrom = sp.from && /^\d{4}-\d{2}-\d{2}$/.test(sp.from) ? sp.from : "";
  const dateTo = sp.to && /^\d{4}-\d{2}-\d{2}$/.test(sp.to) ? sp.to : "";

  const filters = {
    q: searchQuery,
    deep: deepSearch,
    types: typesList,
    category: categoryFilter,
    actor: actorFilter,
    tag: tagFilter,
    from: dateFrom,
    to: dateTo,
  };

  const [engagement] = await db
    .select({ id: engagements.id, name: engagements.name })
    .from(engagements)
    .where(eq(engagements.id, engagementId))
    .limit(1);

  if (!engagement) notFound();

  // Any member can view audit log
  const [currentMember] = await db
    .select({ role: engagementMembers.role })
    .from(engagementMembers)
    .where(
      and(
        eq(engagementMembers.engagementId, engagementId),
        eq(engagementMembers.userId, session.userId)
      )
    )
    .limit(1);

  if (!currentMember) notFound();

  // Build WHERE conditions for activity log query
  const conditions: SQL[] = [
    eq(engagementActivityLog.engagementId, engagementId),
  ];

  // Event type filter
  if (typesList.length > 0) {
    conditions.push(
      inArray(
        engagementActivityLog.eventType,
        typesList as [ActivityEventType, ...ActivityEventType[]]
      )
    );
  }

  // Category filter (via JSONB metadata)
  if (categoryFilter) {
    conditions.push(
      sql`${engagementActivityLog.metadata}->>'categoryId' = ${categoryFilter}`
    );
  }

  // Actor filter
  if (actorFilter) {
    conditions.push(eq(engagementActivityLog.actorId, actorFilter));
  }

  // Tag filter — show only action events where the action is linked to this tag
  if (tagFilter) {
    const taggedActionIds = db
      .selectDistinct({ id: actionTags.actionId })
      .from(actionTags)
      .where(eq(actionTags.tagId, tagFilter));

    conditions.push(
      and(
        inArray(engagementActivityLog.eventType, [
          "action_created",
          "action_updated",
          "action_deleted",
        ]),
        sql`(${engagementActivityLog.metadata}->>'actionId')::uuid IN (${taggedActionIds})`
      )!
    );
  }

  // Date range
  if (dateFrom) {
    conditions.push(gte(engagementActivityLog.createdAt, new Date(dateFrom)));
  }
  if (dateTo) {
    conditions.push(
      lte(engagementActivityLog.createdAt, new Date(dateTo + "T23:59:59.999Z"))
    );
  }

  // Search query — matches metadata and actor names (always),
  // plus resource content and action content (only when deep search is enabled)
  if (searchQuery) {
    const likePattern = `%${escapeLikePattern(searchQuery)}%`;

    // Base search: metadata + actor names
    const searchConditions: SQL[] = [
      sql`${engagementActivityLog.metadata}::text ILIKE ${likePattern}`,
      ilike(users.username, likePattern),
      ilike(users.displayName, likePattern),
    ];

    // Deep search: also search inside resource fields, action content, and tags
    if (deepSearch) {
      // Subquery: resource IDs whose content matches the search
      const matchingResourceIds = db
        .selectDistinct({ id: resources.id })
        .from(resources)
        .leftJoin(
          resourceFields,
          and(
            eq(resourceFields.resourceId, resources.id),
            sql`${resourceFields.type} != 'secret'`
          )
        )
        .innerJoin(
          engagementCategories,
          eq(resources.categoryId, engagementCategories.id)
        )
        .where(
          and(
            eq(engagementCategories.engagementId, engagementId),
            or(
              ilike(resources.name, likePattern),
              ilike(resources.description, likePattern),
              ilike(resourceFields.value, likePattern)
            )
          )
        );

      // Subquery: action IDs whose content matches the search
      const matchingActionIds = db
        .selectDistinct({ id: categoryActions.id })
        .from(categoryActions)
        .innerJoin(
          engagementCategories,
          eq(categoryActions.categoryId, engagementCategories.id)
        )
        .where(
          and(
            eq(engagementCategories.engagementId, engagementId),
            or(
              ilike(categoryActions.title, likePattern),
              ilike(categoryActions.content, likePattern)
            )
          )
        );

      // Subquery: action IDs whose linked tags match the search
      const matchingActionIdsByTag = db
        .selectDistinct({ id: actionTags.actionId })
        .from(actionTags)
        .innerJoin(tags, eq(actionTags.tagId, tags.id))
        .innerJoin(categoryActions, eq(actionTags.actionId, categoryActions.id))
        .innerJoin(
          engagementCategories,
          eq(categoryActions.categoryId, engagementCategories.id)
        )
        .where(
          and(
            eq(engagementCategories.engagementId, engagementId),
            or(
              ilike(tags.name, likePattern),
              ilike(tags.mitreId, likePattern),
              ilike(tags.tactic, likePattern)
            )
          )
        );

      searchConditions.push(
        // Resource content match (for resource events only)
        and(
          inArray(engagementActivityLog.eventType, [
            "resource_created",
            "resource_updated",
            "resource_deleted",
          ]),
          sql`(${engagementActivityLog.metadata}->>'resourceId')::uuid IN (${matchingResourceIds})`
        )!,
        // Action content match (for action events only)
        and(
          inArray(engagementActivityLog.eventType, [
            "action_created",
            "action_updated",
            "action_deleted",
          ]),
          sql`(${engagementActivityLog.metadata}->>'actionId')::uuid IN (${matchingActionIds})`
        )!,
        // Tag match (for action events only)
        and(
          inArray(engagementActivityLog.eventType, [
            "action_created",
            "action_updated",
            "action_deleted",
          ]),
          sql`(${engagementActivityLog.metadata}->>'actionId')::uuid IN (${matchingActionIdsByTag})`
        )!
      );
    }

    conditions.push(or(...searchConditions)!);
  }

  const whereClause = and(...conditions)!;

  // Total filtered count for pagination
  const [{ count: totalCount }] = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(engagementActivityLog)
    .innerJoin(users, eq(engagementActivityLog.actorId, users.id))
    .where(whereClause);

  const totalPages = Math.max(1, Math.ceil(totalCount / PAGE_SIZE));
  const safePage = Math.min(page, totalPages);
  const offset = (safePage - 1) * PAGE_SIZE;

  // Fetch one page of filtered events
  const pageEvents = await db
    .select({
      id: engagementActivityLog.id,
      eventType: engagementActivityLog.eventType,
      metadata: engagementActivityLog.metadata,
      createdAt: engagementActivityLog.createdAt,
      actorId: engagementActivityLog.actorId,
      actorUsername: users.username,
      actorDisplayName: users.displayName,
      actorAvatarPath: users.avatarPath,
    })
    .from(engagementActivityLog)
    .innerJoin(users, eq(engagementActivityLog.actorId, users.id))
    .where(whereClause)
    .orderBy(desc(engagementActivityLog.createdAt))
    .limit(PAGE_SIZE)
    .offset(offset);

  // Categories for filter dropdown + cross-reference resolution
  const categories = await db
    .select({
      id: engagementCategories.id,
      name: engagementCategories.name,
    })
    .from(engagementCategories)
    .where(eq(engagementCategories.engagementId, engagementId))
    .orderBy(engagementCategories.name);

  // Members for actor filter dropdown
  const members = await db
    .select({
      id: engagementMembers.userId,
      username: users.username,
      displayName: users.displayName,
    })
    .from(engagementMembers)
    .innerJoin(users, eq(engagementMembers.userId, users.id))
    .where(eq(engagementMembers.engagementId, engagementId))
    .orderBy(users.username);

  // Tags used in this engagement (for filter dropdown)
  const engagementTags = await db
    .selectDistinct({
      id: tags.id,
      name: tags.name,
      mitreId: tags.mitreId,
      tactic: tags.tactic,
    })
    .from(tags)
    .innerJoin(actionTags, eq(tags.id, actionTags.tagId))
    .innerJoin(categoryActions, eq(actionTags.actionId, categoryActions.id))
    .innerJoin(
      engagementCategories,
      eq(categoryActions.categoryId, engagementCategories.id)
    )
    .where(eq(engagementCategories.engagementId, engagementId))
    .orderBy(tags.tactic, tags.mitreId, tags.name);

  // Serialize for client component
  const serializedEvents = pageEvents.map((e) => ({
    ...e,
    metadata: e.metadata as Record<string, string | null>,
    createdAt: e.createdAt.toISOString(),
  }));

  return (
    <div className="animate-fade-in-up">
      {/* Back link */}
      <div className="mb-6">
        <BackLink href={`/engagements/${engagementId}`} label={`Back to ${engagement.name}`} />
      </div>

      {/* Header */}
      <div className="mb-6">
        <div className="flex items-center gap-2 mb-2">
          <div className="h-px w-8 bg-accent/50" />
          <span className="text-[10px] font-medium text-accent tracking-[0.2em] uppercase">
            Audit Log
          </span>
        </div>
        <h1 className="text-2xl font-semibold text-text-primary tracking-tight">
          Activity History
        </h1>
        <p className="text-sm text-text-secondary mt-1">
          Complete audit trail for {engagement.name}
        </p>
      </div>

      <AuditTimeline
        events={serializedEvents}
        categories={categories}
        members={members}
        tags={engagementTags}
        engagementId={engagementId}
        page={safePage}
        totalPages={totalPages}
        totalCount={totalCount}
        filters={filters}
      />
    </div>
  );
}
