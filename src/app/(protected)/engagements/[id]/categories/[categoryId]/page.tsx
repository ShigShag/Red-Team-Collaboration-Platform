import { redirect, notFound } from "next/navigation";
import Link from "next/link";
import { BackLink } from "../../back-link";
import { eq, and, inArray, sql, desc } from "drizzle-orm";
import { db } from "@/db";
import {
  users,
  engagements,
  engagementMembers,
  engagementCategories,
  categoryAssignments,
  categoryPresets,
  resources,
  resourceFields,
  resourceFiles,
  resourceTemplates,
  categoryActions,
  actionResources,
  actionTags,
  categoryFindings,
  findingResources,
  findingTags,
  findingScreenshots,
  tags,
  engagementActivityLog,
} from "@/db/schema";
import { getSession } from "@/lib/auth/session";
import { CategoryGrid } from "../category-grid";
import { ResourceList } from "./resource-list";
import { ActionList } from "./action-list";
import { FindingList } from "./finding-list";
import { CopyPathButton } from "./copy-path-button";
import { CategoryHeader } from "./category-header";
import { ActivityTimeline } from "../../activity-timeline";
import {
  isContentLocked,
  type EngagementStatus,
} from "@/lib/engagement-status";
import { getCommentsForTargets } from "../comment-queries";
import { isOllamaConfigured } from "@/lib/ai/ollama-client";

interface Props {
  params: Promise<{ id: string; categoryId: string }>;
  searchParams: Promise<{ activityPage?: string }>;
}

export default async function CategoryDetailPage({ params, searchParams }: Props) {
  const { id: engagementId, categoryId } = await params;
  const { activityPage: activityPageParam } = await searchParams;
  const session = await getSession();
  if (!session) redirect("/login");

  // Fetch engagement
  const [engagement] = await db
    .select({ id: engagements.id, name: engagements.name, status: engagements.status })
    .from(engagements)
    .where(eq(engagements.id, engagementId))
    .limit(1);

  if (!engagement) notFound();

  // Verify membership
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

  // Fetch the category with preset info
  const [category] = await db
    .select({
      id: engagementCategories.id,
      parentId: engagementCategories.parentId,
      name: engagementCategories.name,
      typeName: categoryPresets.name,
      icon: categoryPresets.icon,
      color: engagementCategories.color,
      description: engagementCategories.description,
      locked: engagementCategories.locked,
      createdAt: engagementCategories.createdAt,
      createdBy: engagementCategories.createdBy,
    })
    .from(engagementCategories)
    .innerJoin(
      categoryPresets,
      eq(engagementCategories.presetId, categoryPresets.id)
    )
    .where(
      and(
        eq(engagementCategories.id, categoryId),
        eq(engagementCategories.engagementId, engagementId)
      )
    )
    .limit(1);

  if (!category) notFound();

  // Build breadcrumb by tracing parent chain
  const breadcrumb: { id: string; name: string; icon: string }[] = [];
  let currentParentId = category.parentId;
  while (currentParentId) {
    const [parent] = await db
      .select({
        id: engagementCategories.id,
        parentId: engagementCategories.parentId,
        name: engagementCategories.name,
        icon: categoryPresets.icon,
      })
      .from(engagementCategories)
      .innerJoin(
        categoryPresets,
        eq(engagementCategories.presetId, categoryPresets.id)
      )
      .where(eq(engagementCategories.id, currentParentId))
      .limit(1);

    if (!parent) break;
    breadcrumb.unshift({ id: parent.id, name: parent.name, icon: parent.icon });
    currentParentId = parent.parentId;
  }

  // Fetch assignments for this category
  const assignments = await db
    .select({
      userId: categoryAssignments.userId,
      username: users.username,
      displayName: users.displayName,
      avatarPath: users.avatarPath,
    })
    .from(categoryAssignments)
    .innerJoin(users, eq(categoryAssignments.userId, users.id))
    .where(eq(categoryAssignments.categoryId, categoryId));

  // Fetch all engagement members
  const members = await db
    .select({
      userId: engagementMembers.userId,
      role: engagementMembers.role,
      username: users.username,
      displayName: users.displayName,
      avatarPath: users.avatarPath,
    })
    .from(engagementMembers)
    .innerJoin(users, eq(engagementMembers.userId, users.id))
    .where(eq(engagementMembers.engagementId, engagementId))
    .orderBy(engagementMembers.createdAt);

  // Fetch direct children (sub-categories)
  const childCategories = await db
    .select({
      id: engagementCategories.id,
      parentId: engagementCategories.parentId,
      name: engagementCategories.name,
      typeName: categoryPresets.name,
      icon: categoryPresets.icon,
      color: engagementCategories.color,
      description: engagementCategories.description,
      locked: engagementCategories.locked,
      createdAt: engagementCategories.createdAt,
    })
    .from(engagementCategories)
    .innerJoin(
      categoryPresets,
      eq(engagementCategories.presetId, categoryPresets.id)
    )
    .where(
      and(
        eq(engagementCategories.parentId, categoryId),
        eq(engagementCategories.engagementId, engagementId)
      )
    )
    .orderBy(engagementCategories.createdAt);

  // Fetch child category IDs + current category for counts
  const allCategoryIds = [categoryId, ...childCategories.map((c) => c.id)];

  // Fetch assignments, resource counts, action counts, finding counts for children
  const [childAssignments, resourceCounts, actionCounts, findingCounts] = await Promise.all([
    allCategoryIds.length > 0
      ? db
          .select({
            categoryId: categoryAssignments.categoryId,
            userId: categoryAssignments.userId,
            username: users.username,
            displayName: users.displayName,
            avatarPath: users.avatarPath,
          })
          .from(categoryAssignments)
          .innerJoin(users, eq(categoryAssignments.userId, users.id))
          .where(inArray(categoryAssignments.categoryId, allCategoryIds))
      : Promise.resolve([]),
    allCategoryIds.length > 0
      ? db
          .select({
            categoryId: resources.categoryId,
            count: sql<number>`count(*)::int`,
          })
          .from(resources)
          .where(inArray(resources.categoryId, allCategoryIds))
          .groupBy(resources.categoryId)
      : Promise.resolve([]),
    allCategoryIds.length > 0
      ? db
          .select({
            categoryId: categoryActions.categoryId,
            count: sql<number>`count(*)::int`,
          })
          .from(categoryActions)
          .where(inArray(categoryActions.categoryId, allCategoryIds))
          .groupBy(categoryActions.categoryId)
      : Promise.resolve([]),
    allCategoryIds.length > 0
      ? db
          .select({
            categoryId: categoryFindings.categoryId,
            count: sql<number>`count(*)::int`,
          })
          .from(categoryFindings)
          .where(inArray(categoryFindings.categoryId, allCategoryIds))
          .groupBy(categoryFindings.categoryId)
      : Promise.resolve([]),
  ]);

  const resourceCountMap = new Map(
    resourceCounts.map((r) => [r.categoryId, r.count])
  );
  const actionCountMap = new Map(
    actionCounts.map((a) => [a.categoryId, a.count])
  );
  const findingCountMap = new Map(
    findingCounts.map((f) => [f.categoryId, f.count])
  );

  // Build child category data for CategoryGrid
  const childCategoryData = childCategories.map((c) => ({
    id: c.id,
    parentId: c.parentId,
    name: c.name,
    typeName: c.typeName,
    icon: c.icon,
    color: c.color,
    description: c.description,
    locked: c.locked,
    createdAt: c.createdAt.toISOString(),
    resourceCount: resourceCountMap.get(c.id) || 0,
    actionCount: actionCountMap.get(c.id) || 0,
    findingCount: findingCountMap.get(c.id) || 0,
    assignments: childAssignments
      .filter((a) => a.categoryId === c.id)
      .map((a) => ({
        userId: a.userId,
        username: a.username,
        displayName: a.displayName,
        avatarUrl: a.avatarPath ? `/api/avatar/${a.userId}` : null,
      })),
    children: [],
  }));

  // Fetch resources for this category (new schema: resources + fields + files)
  const categoryResources = await db
    .select({
      id: resources.id,
      name: resources.name,
      description: resources.description,
      templateId: resources.templateId,
      templateName: resourceTemplates.name,
      templateIcon: resourceTemplates.icon,
      createdAt: resources.createdAt,
      createdByUsername: users.username,
      createdByDisplayName: users.displayName,
    })
    .from(resources)
    .innerJoin(users, eq(resources.createdBy, users.id))
    .leftJoin(resourceTemplates, eq(resources.templateId, resourceTemplates.id))
    .where(eq(resources.categoryId, categoryId))
    .orderBy(desc(resources.createdAt));

  const resourceIds = categoryResources.map((r) => r.id);

  // Fetch fields and files for all resources
  const [allFields, allFiles] =
    resourceIds.length > 0
      ? await Promise.all([
          db
            .select({
              id: resourceFields.id,
              resourceId: resourceFields.resourceId,
              key: resourceFields.key,
              label: resourceFields.label,
              type: resourceFields.type,
              language: resourceFields.language,
              value: resourceFields.value,
              encryptedValue: resourceFields.encryptedValue,
              sortOrder: resourceFields.sortOrder,
            })
            .from(resourceFields)
            .where(inArray(resourceFields.resourceId, resourceIds))
            .orderBy(resourceFields.sortOrder),
          db
            .select({
              id: resourceFiles.id,
              resourceId: resourceFiles.resourceId,
              originalFilename: resourceFiles.originalFilename,
              mimeType: resourceFiles.mimeType,
              fileSize: resourceFiles.fileSize,
              sortOrder: resourceFiles.sortOrder,
            })
            .from(resourceFiles)
            .where(inArray(resourceFiles.resourceId, resourceIds))
            .orderBy(resourceFiles.sortOrder),
        ])
      : [[], []];

  // Serialize resources for client
  const resourcesData = categoryResources.map((r) => ({
    id: r.id,
    name: r.name,
    description: r.description,
    templateName: r.templateName,
    templateIcon: r.templateIcon,
    createdAt: r.createdAt.toISOString(),
    createdBy: r.createdByDisplayName || r.createdByUsername,
    fields: allFields
      .filter((f) => f.resourceId === r.id)
      .map((f) => ({
        id: f.id,
        key: f.key,
        label: f.label,
        type: f.type,
        language: f.language,
        // Don't send secret values to client — they are fetched on demand
        value: f.type === "secret" ? null : f.value,
        hasValue: f.type === "secret" ? !!f.encryptedValue : !!f.value,
      })),
    files: allFiles
      .filter((f) => f.resourceId === r.id)
      .map((f) => ({
        id: f.id,
        originalFilename: f.originalFilename,
        mimeType: f.mimeType,
        fileSize: f.fileSize,
      })),
  }));

  // Fetch actions for this category
  const actions = await db
    .select({
      id: categoryActions.id,
      title: categoryActions.title,
      content: categoryActions.content,
      contentFormat: categoryActions.contentFormat,
      performedAt: categoryActions.performedAt,
      createdAt: categoryActions.createdAt,
      createdByUsername: users.username,
      createdByDisplayName: users.displayName,
    })
    .from(categoryActions)
    .innerJoin(users, eq(categoryActions.createdBy, users.id))
    .where(eq(categoryActions.categoryId, categoryId))
    .orderBy(desc(categoryActions.performedAt));

  // Fetch linked resources for each action
  const actionIds = actions.map((a) => a.id);
  let actionResourceLinks: Array<{
    actionId: string;
    resourceId: string;
    resourceName: string;
    templateIcon: string | null;
  }> = [];

  let actionTagLinks: Array<{
    actionId: string;
    tagId: string;
    tagName: string;
    mitreId: string | null;
    tactic: string | null;
  }> = [];

  if (actionIds.length > 0) {
    [actionResourceLinks, actionTagLinks] = await Promise.all([
      db
        .select({
          actionId: actionResources.actionId,
          resourceId: actionResources.resourceId,
          resourceName: resources.name,
          templateIcon: resourceTemplates.icon,
        })
        .from(actionResources)
        .innerJoin(resources, eq(actionResources.resourceId, resources.id))
        .leftJoin(resourceTemplates, eq(resources.templateId, resourceTemplates.id))
        .where(inArray(actionResources.actionId, actionIds)),
      db
        .select({
          actionId: actionTags.actionId,
          tagId: actionTags.tagId,
          tagName: tags.name,
          mitreId: tags.mitreId,
          tactic: tags.tactic,
        })
        .from(actionTags)
        .innerJoin(tags, eq(actionTags.tagId, tags.id))
        .where(inArray(actionTags.actionId, actionIds)),
    ]);
  }

  // Fetch findings for this category
  const findings = await db
    .select({
      id: categoryFindings.id,
      title: categoryFindings.title,
      overview: categoryFindings.overview,
      overviewFormat: categoryFindings.overviewFormat,
      impact: categoryFindings.impact,
      impactFormat: categoryFindings.impactFormat,
      recommendation: categoryFindings.recommendation,
      recommendationFormat: categoryFindings.recommendationFormat,
      severity: categoryFindings.severity,
      cvssScore: categoryFindings.cvssScore,
      cvssVector: categoryFindings.cvssVector,
      createdAt: categoryFindings.createdAt,
      updatedAt: categoryFindings.updatedAt,
      createdByUsername: users.username,
      createdByDisplayName: users.displayName,
    })
    .from(categoryFindings)
    .innerJoin(users, eq(categoryFindings.createdBy, users.id))
    .where(eq(categoryFindings.categoryId, categoryId))
    .orderBy(desc(categoryFindings.createdAt));

  // Fetch linked resources and tags for each finding
  const findingIds = findings.map((f) => f.id);
  let findingResourceLinks: Array<{
    findingId: string;
    resourceId: string;
    resourceName: string;
    templateIcon: string | null;
  }> = [];

  let findingTagLinks: Array<{
    findingId: string;
    tagId: string;
    tagName: string;
    mitreId: string | null;
    tactic: string | null;
  }> = [];

  let findingScreenshotLinks: Array<{
    findingId: string;
    id: string;
    originalFilename: string;
    mimeType: string;
    fileSize: number;
    caption: string | null;
  }> = [];

  if (findingIds.length > 0) {
    [findingResourceLinks, findingTagLinks, findingScreenshotLinks] = await Promise.all([
      db
        .select({
          findingId: findingResources.findingId,
          resourceId: findingResources.resourceId,
          resourceName: resources.name,
          templateIcon: resourceTemplates.icon,
        })
        .from(findingResources)
        .innerJoin(resources, eq(findingResources.resourceId, resources.id))
        .leftJoin(resourceTemplates, eq(resources.templateId, resourceTemplates.id))
        .where(inArray(findingResources.findingId, findingIds)),
      db
        .select({
          findingId: findingTags.findingId,
          tagId: findingTags.tagId,
          tagName: tags.name,
          mitreId: tags.mitreId,
          tactic: tags.tactic,
        })
        .from(findingTags)
        .innerJoin(tags, eq(findingTags.tagId, tags.id))
        .where(inArray(findingTags.findingId, findingIds)),
      db
        .select({
          findingId: findingScreenshots.findingId,
          id: findingScreenshots.id,
          originalFilename: findingScreenshots.originalFilename,
          mimeType: findingScreenshots.mimeType,
          fileSize: findingScreenshots.fileSize,
          caption: findingScreenshots.caption,
        })
        .from(findingScreenshots)
        .where(inArray(findingScreenshots.findingId, findingIds))
        .orderBy(findingScreenshots.sortOrder, findingScreenshots.createdAt),
    ]);
  }

  // Fetch all available tags for the tag picker
  const allTags = await db
    .select({
      id: tags.id,
      name: tags.name,
      mitreId: tags.mitreId,
      tactic: tags.tactic,
      description: tags.description,
      isSystem: tags.isSystem,
    })
    .from(tags)
    .orderBy(tags.tactic, tags.mitreId, tags.name);

  // Fetch scoped activity for this category
  const ACTIVITY_PAGE_SIZE = 20;
  const activityPage = Math.max(1, parseInt(activityPageParam ?? "1", 10) || 1);

  const [{ count: activityTotalCount }] = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(engagementActivityLog)
    .where(
      and(
        eq(engagementActivityLog.engagementId, engagementId),
        sql`${engagementActivityLog.metadata}->>'categoryId' = ${categoryId}`
      )
    );

  const activityTotalPages = Math.max(1, Math.ceil(activityTotalCount / ACTIVITY_PAGE_SIZE));
  const safeActivityPage = Math.min(activityPage, activityTotalPages);
  const activityOffset = (safeActivityPage - 1) * ACTIVITY_PAGE_SIZE;

  const activityEvents = await db
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
    .where(
      and(
        eq(engagementActivityLog.engagementId, engagementId),
        sql`${engagementActivityLog.metadata}->>'categoryId' = ${categoryId}`
      )
    )
    .orderBy(desc(engagementActivityLog.createdAt))
    .limit(ACTIVITY_PAGE_SIZE)
    .offset(activityOffset);

  const engagementStatus = (engagement.status ?? "scoping") as EngagementStatus;
  const isOwner = currentMember.role === "owner";
  const readOnly = isContentLocked(engagementStatus, isOwner);
  const canEdit =
    !readOnly && (currentMember.role === "write" || currentMember.role === "owner");
  const canComment = engagementStatus !== "closed" && engagementStatus !== "archived";
  const aiAssistEnabled = canEdit && (await isOllamaConfigured());

  // Fetch comments for all entities on this page
  const commentTargets: Array<{ type: string; id: string }> = [
    ...findingIds.map((id) => ({ type: "finding", id })),
    ...actionIds.map((id) => ({ type: "action", id })),
    ...resourceIds.map((id) => ({ type: "resource", id })),
  ];
  const commentsMap = await getCommentsForTargets(engagementId, commentTargets);

  // Serialize comments for client components
  const serializeComments = (targetType: string, targetId: string) => {
    const key = `${targetType}:${targetId}`;
    const threads = commentsMap.get(key) ?? [];
    return JSON.parse(JSON.stringify(threads));
  };

  // Format members for @mention autocomplete
  const mentionMembers = members.map((m) => ({
    id: m.userId,
    username: m.username,
    displayName: m.displayName,
    avatarPath: m.avatarPath,
  }));

  const actionsData = actions.map((a) => ({
    id: a.id,
    title: a.title,
    content: a.content,
    contentFormat: a.contentFormat,
    performedAt: a.performedAt.toISOString(),
    createdAt: a.createdAt.toISOString(),
    createdBy: a.createdByDisplayName || a.createdByUsername,
    linkedResources: actionResourceLinks
      .filter((l) => l.actionId === a.id)
      .map((l) => ({
        resourceId: l.resourceId,
        name: l.resourceName,
        templateIcon: l.templateIcon,
      })),
    linkedTags: actionTagLinks
      .filter((l) => l.actionId === a.id)
      .map((l) => ({
        tagId: l.tagId,
        name: l.tagName,
        mitreId: l.mitreId,
        tactic: l.tactic,
      })),
  }));

  const findingsData = findings.map((f) => ({
    id: f.id,
    title: f.title,
    overview: f.overview,
    overviewFormat: f.overviewFormat,
    impact: f.impact,
    impactFormat: f.impactFormat,
    recommendation: f.recommendation,
    recommendationFormat: f.recommendationFormat,
    severity: f.severity,
    cvssScore: f.cvssScore,
    cvssVector: f.cvssVector,
    createdAt: f.createdAt.toISOString(),
    updatedAt: f.updatedAt.toISOString(),
    createdBy: f.createdByDisplayName || f.createdByUsername,
    linkedResources: findingResourceLinks
      .filter((l) => l.findingId === f.id)
      .map((l) => ({
        resourceId: l.resourceId,
        name: l.resourceName,
        templateIcon: l.templateIcon,
      })),
    linkedTags: findingTagLinks
      .filter((l) => l.findingId === f.id)
      .map((l) => ({
        tagId: l.tagId,
        name: l.tagName,
        mitreId: l.mitreId,
        tactic: l.tactic,
      })),
    screenshots: findingScreenshotLinks
      .filter((s) => s.findingId === f.id)
      .map((s) => ({
        id: s.id,
        originalFilename: s.originalFilename,
        mimeType: s.mimeType,
        fileSize: s.fileSize,
        caption: s.caption,
      })),
  }));

  return (
    <div className="animate-fade-in-up">
      {/* Back link */}
      <div className="mb-3">
        <BackLink
          href={
            breadcrumb.length > 0
              ? `/engagements/${engagementId}/categories/${breadcrumb[breadcrumb.length - 1].id}`
              : `/engagements/${engagementId}`
          }
          label={
            breadcrumb.length > 0
              ? `Back to ${breadcrumb[breadcrumb.length - 1].name}`
              : `Back to ${engagement.name}`
          }
        />
      </div>

      {/* Breadcrumb */}
      {(() => {
        const pathParts = [
          "Engagements",
          engagement.name,
          ...breadcrumb.map((bc) => `${bc.icon} ${bc.name}`),
          `${category.icon} ${category.name}`,
        ];
        const pathString = pathParts.join(" / ");
        return (
          <nav className="flex items-center gap-1.5 text-xs text-text-muted mb-6 flex-wrap">
            <Link
              href="/engagements"
              className="hover:text-text-secondary transition-colors duration-100"
            >
              Engagements
            </Link>
            <span className="text-text-muted/50">/</span>
            <Link
              href={`/engagements/${engagementId}`}
              className="hover:text-text-secondary transition-colors duration-100"
            >
              {engagement.name}
            </Link>
            {breadcrumb.map((bc) => (
              <span key={bc.id} className="contents">
                <span className="text-text-muted/50">/</span>
                <Link
                  href={`/engagements/${engagementId}/categories/${bc.id}`}
                  className="hover:text-text-secondary transition-colors duration-100"
                >
                  <span className="mr-0.5">{bc.icon}</span>
                  {bc.name}
                </Link>
              </span>
            ))}
            <span className="text-text-muted/50">/</span>
            <span className="text-text-secondary">
              <span className="mr-0.5">{category.icon}</span>
              {category.name}
            </span>
            <CopyPathButton path={pathString} />
          </nav>
        );
      })()}

      {/* Category Header */}
      <CategoryHeader
        category={{
          id: category.id,
          name: category.name,
          typeName: category.typeName,
          icon: category.icon,
          color: category.color,
          description: category.description,
          locked: category.locked,
          createdAt: category.createdAt.toISOString(),
        }}
        engagementId={engagementId}
        canEdit={canEdit}
        isOwner={isOwner}
      />

      {/* Assignments */}
      <div className="flex items-center gap-1.5 -mt-5 mb-8 ml-[44px]">
        {assignments.map((a) => {
          const name = a.displayName || a.username;
          const initial = name[0].toUpperCase();
          return (
            <div key={a.userId} title={name}>
              {a.avatarPath ? (
                <img
                  src={`/api/avatar/${a.userId}`}
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
            </div>
          );
        })}
        {assignments.length === 0 && (
          <span className="text-[10px] text-text-muted">No one assigned</span>
        )}
      </div>

      {/* Content sections */}
      <div className="space-y-8">
        {/* Sub-categories */}
        <CategoryGrid
          categories={childCategoryData}
          engagementId={engagementId}
          currentUserId={session.userId}
          currentUserRole={currentMember.role}
          members={members.map((m) => ({
            userId: m.userId,
            username: m.username,
            displayName: m.displayName,
            avatarUrl: m.avatarPath ? `/api/avatar/${m.userId}` : null,
          }))}
          parentId={categoryId}
          readOnly={readOnly}
        />

        {/* Resources */}
        <ResourceList
          resources={resourcesData}
          engagementId={engagementId}
          categoryId={categoryId}
          canEdit={canEdit}
          canComment={canComment}
          commentsMap={Object.fromEntries(
            resourceIds.map((id) => [id, serializeComments("resource", id)])
          )}
          mentionMembers={mentionMembers}
          currentUserId={session.userId}
          isOwner={isOwner}
        />

        {/* Actions */}
        <ActionList
          actions={actionsData}
          resources={resourcesData.map((r) => ({
            id: r.id,
            name: r.name,
            templateIcon: r.templateIcon,
          }))}
          tags={allTags}
          engagementId={engagementId}
          categoryId={categoryId}
          canEdit={canEdit}
          canComment={canComment}
          commentsMap={Object.fromEntries(
            actionIds.map((id) => [id, serializeComments("action", id)])
          )}
          mentionMembers={mentionMembers}
          currentUserId={session.userId}
          isOwner={isOwner}
        />

        {/* Findings */}
        <FindingList
          findings={findingsData}
          resources={resourcesData.map((r) => ({
            id: r.id,
            name: r.name,
            templateIcon: r.templateIcon,
          }))}
          tags={allTags}
          engagementId={engagementId}
          categoryId={categoryId}
          canEdit={canEdit}
          canComment={canComment}
          commentsMap={Object.fromEntries(
            findingIds.map((id) => [id, serializeComments("finding", id)])
          )}
          mentionMembers={mentionMembers}
          currentUserId={session.userId}
          isOwner={isOwner}
          aiAssistEnabled={aiAssistEnabled}
        />

        {/* Activity Feed */}
        <ActivityTimeline
          events={activityEvents.map((e) => ({
            ...e,
            metadata: e.metadata as Record<string, string | null>,
          }))}
          emptyMessage="No activity recorded for this category yet"
          page={safeActivityPage}
          totalPages={activityTotalPages}
          totalCount={activityTotalCount}
          baseUrl={`/engagements/${engagementId}/categories/${categoryId}`}
          engagementId={engagementId}
          categoryIds={[categoryId]}
        />
      </div>
    </div>
  );
}
