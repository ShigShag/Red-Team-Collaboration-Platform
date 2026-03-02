import { eq, and, inArray, desc } from "drizzle-orm";
import { db } from "@/db";
import {
  engagements,
  engagementMembers,
  engagementCategories,
  categoryPresets,
  categoryFindings,
  categoryActions,
  findingScreenshots,
  findingTags,
  findingResources,
  actionTags,
  actionResources,
  resources,
  resourceFields,
  resourceFiles,
  tags,
  users,
  ipGeolocations,
  scopeTargets,
  scopeExclusions,
  scopeConstraints,
  contacts,
  scopeDocuments,
  comments,
  engagementActivityLog,
} from "@/db/schema";
import { decryptFieldValue } from "@/lib/crypto/resource-crypto";

// ── Types ────────────────────────────────────────────────────────

export interface ExportOptions {
  engagementId: string;
  format?: "full" | "simple";
  categoryIds?: string[];
  includeScope: boolean;
  includeIPs: boolean;
  includeAuditLog: boolean;
  includeComments: boolean;
}

export interface ExportData {
  engagement: {
    id: string;
    name: string;
    description: string | null;
    status: string | null;
    startDate: string | null;
    endDate: string | null;
    createdAt: Date;
  };
  members: {
    username: string;
    displayName: string | null;
    role: string;
  }[];
  categories: ExportCategory[];
  scope?: {
    targets: { type: string; value: string; notes: string | null }[];
    exclusions: { type: string; value: string; justification: string }[];
    constraints: { constraint: string }[];
    contacts: {
      name: string;
      title: string | null;
      email: string | null;
      phone: string | null;
      isPrimary: boolean;
    }[];
    documents: {
      id: string;
      documentType: string;
      name: string;
      description: string | null;
      referenceNumber: string | null;
      originalFilename: string;
      diskPath: string;
    }[];
  };
  ipGeolocations?: {
    ip: string;
    countryCode: string | null;
    countryName: string | null;
    isPrivate: boolean;
  }[];
  comments?: {
    id: string;
    targetType: string;
    targetId: string;
    parentId: string | null;
    authorUsername: string;
    authorDisplayName: string | null;
    content: string;
    contentFormat: string;
    createdAt: Date;
  }[];
  auditLog?: {
    eventType: string;
    actorUsername: string;
    actorDisplayName: string | null;
    metadata: unknown;
    createdAt: Date;
  }[];
}

export interface ExportCategory {
  id: string;
  name: string;
  description: string | null;
  color: string | null;
  presetName: string | null;
  presetIcon: string | null;
  children: ExportCategory[];
  findings: ExportFinding[];
  actions: ExportAction[];
  resources: ExportResource[];
}

export interface ExportFinding {
  id: string;
  title: string;
  severity: string;
  cvssScore: string | null;
  cvssVector: string | null;
  overview: string;
  overviewFormat: string;
  impact: string | null;
  impactFormat: string;
  recommendation: string | null;
  recommendationFormat: string;
  tags: { name: string; mitreId: string | null; tactic: string | null }[];
  linkedResources: { name: string; description: string | null }[];
  screenshots: {
    id: string;
    originalFilename: string;
    diskPath: string;
    caption: string | null;
    sortOrder: number;
  }[];
  createdAt: Date;
}

export interface ExportAction {
  id: string;
  title: string;
  content: string;
  contentFormat: string;
  performedAt: Date | null;
  createdByName: string;
  tags: { name: string; mitreId: string | null; tactic: string | null }[];
  linkedResources: { name: string; description: string | null }[];
  createdAt: Date;
}

export interface ExportResource {
  id: string;
  name: string;
  description: string | null;
  fields: {
    key: string;
    label: string;
    type: string;
    language: string | null;
    value: string | null;
  }[];
  files: {
    id: string;
    originalFilename: string;
    diskPath: string;
    mimeType: string;
    sortOrder: number;
  }[];
}

// ── Main collector ───────────────────────────────────────────────

export async function collectExportData(
  options: ExportOptions
): Promise<ExportData> {
  const { engagementId } = options;

  // Fetch engagement
  const [engagement] = await db
    .select({
      id: engagements.id,
      name: engagements.name,
      description: engagements.description,
      status: engagements.status,
      startDate: engagements.startDate,
      endDate: engagements.endDate,
      createdAt: engagements.createdAt,
    })
    .from(engagements)
    .where(eq(engagements.id, engagementId))
    .limit(1);

  if (!engagement) throw new Error("Engagement not found");

  // Parallel fetch: members, categories, and optional sections
  const [memberRows, allCategoryRows] = await Promise.all([
    db
      .select({
        username: users.username,
        displayName: users.displayName,
        role: engagementMembers.role,
      })
      .from(engagementMembers)
      .innerJoin(users, eq(engagementMembers.userId, users.id))
      .where(eq(engagementMembers.engagementId, engagementId))
      .orderBy(engagementMembers.createdAt),
    db
      .select({
        id: engagementCategories.id,
        parentId: engagementCategories.parentId,
        name: engagementCategories.name,
        description: engagementCategories.description,
        color: engagementCategories.color,
        presetName: categoryPresets.name,
        presetIcon: categoryPresets.icon,
      })
      .from(engagementCategories)
      .innerJoin(categoryPresets, eq(engagementCategories.presetId, categoryPresets.id))
      .where(eq(engagementCategories.engagementId, engagementId))
      .orderBy(engagementCategories.createdAt),
  ]);

  // Filter categories if specific IDs requested
  const filteredCatIds =
    options.categoryIds && options.categoryIds.length > 0
      ? expandCategoryIds(options.categoryIds, allCategoryRows)
      : allCategoryRows.map((c) => c.id);

  // Fetch category contents + optional sections in parallel
  const [findingRows, actionRows, resourceRows, scopeData, ipRows, commentRows, auditRows] =
    await Promise.all([
      filteredCatIds.length > 0 ? fetchFindings(filteredCatIds) : Promise.resolve([]),
      filteredCatIds.length > 0 ? fetchActions(filteredCatIds) : Promise.resolve([]),
      filteredCatIds.length > 0 ? fetchResources(filteredCatIds, engagementId) : Promise.resolve([]),
      options.includeScope ? fetchScope(engagementId) : Promise.resolve(undefined),
      options.includeIPs ? fetchIPs(engagementId) : Promise.resolve(undefined),
      options.includeComments ? fetchComments(engagementId) : Promise.resolve(undefined),
      options.includeAuditLog ? fetchAuditLog(engagementId) : Promise.resolve(undefined),
    ]);

  // Build category tree with contents
  const filteredCats = allCategoryRows.filter((c) => filteredCatIds.includes(c.id));
  const categories = buildCategoryTree(filteredCats, findingRows, actionRows, resourceRows);

  return {
    engagement,
    members: memberRows,
    categories,
    scope: scopeData,
    ipGeolocations: ipRows,
    comments: commentRows,
    auditLog: auditRows,
  };
}

// ── Helpers ──────────────────────────────────────────────────────

/**
 * When user selects top-level categories, automatically include their children.
 */
function expandCategoryIds(
  selectedIds: string[],
  allCats: { id: string; parentId: string | null }[]
): string[] {
  const result = new Set(selectedIds);
  let changed = true;
  while (changed) {
    changed = false;
    for (const cat of allCats) {
      if (cat.parentId && result.has(cat.parentId) && !result.has(cat.id)) {
        result.add(cat.id);
        changed = true;
      }
    }
  }
  return Array.from(result);
}

async function fetchFindings(
  categoryIds: string[]
): Promise<(ExportFinding & { categoryId: string })[]> {
  const findingRows = await db
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
      categoryId: categoryFindings.categoryId,
      createdAt: categoryFindings.createdAt,
    })
    .from(categoryFindings)
    .where(inArray(categoryFindings.categoryId, categoryIds))
    .orderBy(categoryFindings.createdAt);

  if (findingRows.length === 0) return [];

  const findingIds = findingRows.map((f) => f.id);

  // Fetch related data in parallel
  const [tagLinks, resLinks, screenshotRows] = await Promise.all([
    db
      .select({
        findingId: findingTags.findingId,
        name: tags.name,
        mitreId: tags.mitreId,
        tactic: tags.tactic,
      })
      .from(findingTags)
      .innerJoin(tags, eq(findingTags.tagId, tags.id))
      .where(inArray(findingTags.findingId, findingIds)),
    db
      .select({
        findingId: findingResources.findingId,
        name: resources.name,
        description: resources.description,
      })
      .from(findingResources)
      .innerJoin(resources, eq(findingResources.resourceId, resources.id))
      .where(inArray(findingResources.findingId, findingIds)),
    db
      .select({
        id: findingScreenshots.id,
        findingId: findingScreenshots.findingId,
        originalFilename: findingScreenshots.originalFilename,
        diskPath: findingScreenshots.diskPath,
        caption: findingScreenshots.caption,
        sortOrder: findingScreenshots.sortOrder,
      })
      .from(findingScreenshots)
      .where(inArray(findingScreenshots.findingId, findingIds))
      .orderBy(findingScreenshots.sortOrder),
  ]);

  // Group by finding
  const tagsByFinding = groupBy(tagLinks, "findingId");
  const resByFinding = groupBy(resLinks, "findingId");
  const screensByFinding = groupBy(screenshotRows, "findingId");

  return findingRows.map((f) => ({
    id: f.id,
    title: f.title,
    severity: f.severity,
    cvssScore: f.cvssScore,
    cvssVector: f.cvssVector,
    overview: f.overview,
    overviewFormat: f.overviewFormat,
    impact: f.impact,
    impactFormat: f.impactFormat,
    recommendation: f.recommendation,
    recommendationFormat: f.recommendationFormat,
    categoryId: f.categoryId,
    createdAt: f.createdAt,
    tags: (tagsByFinding.get(f.id) ?? []).map((t) => ({
      name: t.name,
      mitreId: t.mitreId,
      tactic: t.tactic,
    })),
    linkedResources: (resByFinding.get(f.id) ?? []).map((r) => ({
      name: r.name,
      description: r.description,
    })),
    screenshots: (screensByFinding.get(f.id) ?? []).map((s) => ({
      id: s.id,
      originalFilename: s.originalFilename,
      diskPath: s.diskPath,
      caption: s.caption,
      sortOrder: s.sortOrder,
    })),
  }));
}

async function fetchActions(
  categoryIds: string[]
): Promise<(ExportAction & { categoryId: string })[]> {
  const actionRows = await db
    .select({
      id: categoryActions.id,
      title: categoryActions.title,
      content: categoryActions.content,
      contentFormat: categoryActions.contentFormat,
      performedAt: categoryActions.performedAt,
      categoryId: categoryActions.categoryId,
      createdByName: users.displayName,
      createdByUsername: users.username,
      createdAt: categoryActions.createdAt,
    })
    .from(categoryActions)
    .innerJoin(users, eq(categoryActions.createdBy, users.id))
    .where(inArray(categoryActions.categoryId, categoryIds))
    .orderBy(categoryActions.createdAt);

  if (actionRows.length === 0) return [];

  const actionIds = actionRows.map((a) => a.id);

  const [aTagLinks, aResLinks] = await Promise.all([
    db
      .select({
        actionId: actionTags.actionId,
        name: tags.name,
        mitreId: tags.mitreId,
        tactic: tags.tactic,
      })
      .from(actionTags)
      .innerJoin(tags, eq(actionTags.tagId, tags.id))
      .where(inArray(actionTags.actionId, actionIds)),
    db
      .select({
        actionId: actionResources.actionId,
        name: resources.name,
        description: resources.description,
      })
      .from(actionResources)
      .innerJoin(resources, eq(actionResources.resourceId, resources.id))
      .where(inArray(actionResources.actionId, actionIds)),
  ]);

  const tagsByAction = groupBy(aTagLinks, "actionId");
  const resByAction = groupBy(aResLinks, "actionId");

  return actionRows.map((a) => ({
    id: a.id,
    title: a.title,
    content: a.content,
    contentFormat: a.contentFormat,
    performedAt: a.performedAt,
    createdByName: a.createdByName ?? a.createdByUsername,
    categoryId: a.categoryId,
    createdAt: a.createdAt,
    tags: (tagsByAction.get(a.id) ?? []).map((t) => ({
      name: t.name,
      mitreId: t.mitreId,
      tactic: t.tactic,
    })),
    linkedResources: (resByAction.get(a.id) ?? []).map((r) => ({
      name: r.name,
      description: r.description,
    })),
  }));
}

async function fetchResources(
  categoryIds: string[],
  engagementId: string
): Promise<(ExportResource & { categoryId: string })[]> {
  const resourceRows = await db
    .select({
      id: resources.id,
      name: resources.name,
      description: resources.description,
      categoryId: resources.categoryId,
    })
    .from(resources)
    .where(inArray(resources.categoryId, categoryIds))
    .orderBy(resources.createdAt);

  if (resourceRows.length === 0) return [];

  const resourceIds = resourceRows.map((r) => r.id);

  const [fieldRows, fileRows] = await Promise.all([
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
        diskPath: resourceFiles.diskPath,
        mimeType: resourceFiles.mimeType,
        sortOrder: resourceFiles.sortOrder,
      })
      .from(resourceFiles)
      .where(inArray(resourceFiles.resourceId, resourceIds))
      .orderBy(resourceFiles.sortOrder),
  ]);

  const fieldsByResource = groupBy(fieldRows, "resourceId");
  const filesByResource = groupBy(fileRows, "resourceId");

  return resourceRows.map((r) => ({
    id: r.id,
    name: r.name,
    description: r.description,
    categoryId: r.categoryId,
    fields: (fieldsByResource.get(r.id) ?? []).map((f) => {
      let value = f.value;
      if (f.type === "secret" && f.encryptedValue) {
        try {
          value = decryptFieldValue(f.encryptedValue, engagementId);
        } catch {
          value = "[decryption failed]";
        }
      }
      return {
        key: f.key,
        label: f.label,
        type: f.type,
        language: f.language,
        value,
      };
    }),
    files: (filesByResource.get(r.id) ?? []).map((f) => ({
      id: f.id,
      originalFilename: f.originalFilename,
      diskPath: f.diskPath,
      mimeType: f.mimeType,
      sortOrder: f.sortOrder,
    })),
  }));
}

async function fetchScope(engagementId: string) {
  const [targetRows, exclusionRows, constraintRows, contactRows, documentRows] =
    await Promise.all([
      db
        .select({
          type: scopeTargets.type,
          value: scopeTargets.value,
          notes: scopeTargets.notes,
        })
        .from(scopeTargets)
        .where(eq(scopeTargets.engagementId, engagementId))
        .orderBy(scopeTargets.type, scopeTargets.createdAt),
      db
        .select({
          type: scopeExclusions.type,
          value: scopeExclusions.value,
          justification: scopeExclusions.justification,
        })
        .from(scopeExclusions)
        .where(eq(scopeExclusions.engagementId, engagementId))
        .orderBy(scopeExclusions.createdAt),
      db
        .select({ constraint: scopeConstraints.constraint })
        .from(scopeConstraints)
        .where(eq(scopeConstraints.engagementId, engagementId))
        .orderBy(scopeConstraints.createdAt),
      db
        .select({
          name: contacts.name,
          title: contacts.title,
          email: contacts.email,
          encryptedPhone: contacts.encryptedPhone,
          isPrimary: contacts.isPrimary,
        })
        .from(contacts)
        .where(eq(contacts.engagementId, engagementId))
        .orderBy(contacts.sortOrder),
      db
        .select({
          id: scopeDocuments.id,
          documentType: scopeDocuments.documentType,
          name: scopeDocuments.name,
          description: scopeDocuments.description,
          referenceNumber: scopeDocuments.referenceNumber,
          originalFilename: scopeDocuments.originalFilename,
          diskPath: scopeDocuments.diskPath,
        })
        .from(scopeDocuments)
        .where(eq(scopeDocuments.engagementId, engagementId))
        .orderBy(scopeDocuments.createdAt),
    ]);

  return {
    targets: targetRows,
    exclusions: exclusionRows,
    constraints: constraintRows,
    contacts: contactRows.map((c) => {
      let phone: string | null = null;
      if (c.encryptedPhone) {
        try {
          phone = decryptFieldValue(c.encryptedPhone, engagementId);
        } catch {
          phone = "[decryption failed]";
        }
      }
      return {
        name: c.name,
        title: c.title,
        email: c.email,
        phone,
        isPrimary: c.isPrimary,
      };
    }),
    documents: documentRows,
  };
}

async function fetchIPs(engagementId: string) {
  return db
    .select({
      ip: ipGeolocations.ip,
      countryCode: ipGeolocations.countryCode,
      countryName: ipGeolocations.countryName,
      isPrivate: ipGeolocations.isPrivate,
    })
    .from(ipGeolocations)
    .where(eq(ipGeolocations.engagementId, engagementId))
    .orderBy(ipGeolocations.ip);
}

async function fetchComments(engagementId: string) {
  return db
    .select({
      id: comments.id,
      targetType: comments.targetType,
      targetId: comments.targetId,
      parentId: comments.parentId,
      authorUsername: users.username,
      authorDisplayName: users.displayName,
      content: comments.content,
      contentFormat: comments.contentFormat,
      createdAt: comments.createdAt,
    })
    .from(comments)
    .innerJoin(users, eq(comments.authorId, users.id))
    .where(
      and(
        eq(comments.engagementId, engagementId),
        // Exclude soft-deleted comments
      )
    )
    .orderBy(comments.createdAt);
}

async function fetchAuditLog(engagementId: string) {
  return db
    .select({
      eventType: engagementActivityLog.eventType,
      actorUsername: users.username,
      actorDisplayName: users.displayName,
      metadata: engagementActivityLog.metadata,
      createdAt: engagementActivityLog.createdAt,
    })
    .from(engagementActivityLog)
    .innerJoin(users, eq(engagementActivityLog.actorId, users.id))
    .where(eq(engagementActivityLog.engagementId, engagementId))
    .orderBy(desc(engagementActivityLog.createdAt));
}

// ── Tree builder ─────────────────────────────────────────────────

function buildCategoryTree(
  cats: { id: string; parentId: string | null; name: string; description: string | null; color: string | null; presetName: string | null; presetIcon: string | null }[],
  findings: (ExportFinding & { categoryId: string })[],
  actions: (ExportAction & { categoryId: string })[],
  resourceList: (ExportResource & { categoryId: string })[]
): ExportCategory[] {
  const findingsByCat = groupBy(findings, "categoryId");
  const actionsByCat = groupBy(actions, "categoryId");
  const resourcesByCat = groupBy(resourceList, "categoryId");

  const nodeMap = new Map<string, ExportCategory>();
  for (const c of cats) {
    nodeMap.set(c.id, {
      id: c.id,
      name: c.name,
      description: c.description,
      color: c.color,
      presetName: c.presetName,
      presetIcon: c.presetIcon,
      children: [],
      findings: findingsByCat.get(c.id) ?? [],
      actions: actionsByCat.get(c.id) ?? [],
      resources: resourcesByCat.get(c.id) ?? [],
    });
  }

  const roots: ExportCategory[] = [];
  for (const c of cats) {
    const node = nodeMap.get(c.id)!;
    if (c.parentId && nodeMap.has(c.parentId)) {
      nodeMap.get(c.parentId)!.children.push(node);
    } else if (!c.parentId) {
      roots.push(node);
    }
  }

  return roots;
}

// ── Utility ──────────────────────────────────────────────────────

function groupBy<T, K extends keyof T>(
  items: T[],
  key: K
): Map<string, T[]> {
  const map = new Map<string, T[]>();
  for (const item of items) {
    const k = item[key] as string;
    const arr = map.get(k) ?? [];
    arr.push(item);
    map.set(k, arr);
  }
  return map;
}
