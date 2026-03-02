import { randomUUID } from "crypto";
import { mkdir, writeFile } from "fs/promises";
import { join } from "path";
import { eq, and, inArray, isNull } from "drizzle-orm";
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
  ipGeolocations,
  scopeTargets,
  scopeExclusions,
  scopeConstraints,
  contacts,
  scopeDocuments,
  engagementActivityLog,
} from "@/db/schema";
import {
  encryptFieldValue,
  encryptFileBuffer,
} from "@/lib/crypto/resource-crypto";
import { logActivity } from "@/lib/activity-log";
import type {
  ImportData,
  ImportCategory,
  ImportFinding,
  ImportAction,
  ImportResource,
} from "./zip-parser";

const RESOURCES_DIR = join(process.cwd(), "data", "resources");

// ── Types ────────────────────────────────────────────────────────

export interface ImportOptions {
  name: string;
  includeScope: boolean;
  includeIPs: boolean;
  includeFindings: boolean;
  includeActions: boolean;
  includeResources: boolean;
  includeAuditLog: boolean;
}

export interface ImportResult {
  error?: string;
  engagementId?: string;
  stats?: {
    categories: number;
    findings: number;
    actions: number;
    resources: number;
    files: number;
  };
}

// ── Main import function ─────────────────────────────────────────

export async function importEngagement(
  importData: ImportData,
  options: ImportOptions,
  userId: string
): Promise<ImportResult> {
  const trimmedName = options.name.trim();
  if (!trimmedName || trimmedName.length > 255) {
    return { error: "Name is required (max 255 characters)" };
  }

  // Collect file write operations to perform outside the transaction
  const fileWriteOps: Array<{
    plaintext: Buffer;
    diskFilename: string;
  }> = [];

  const stats = {
    categories: 0,
    findings: 0,
    actions: 0,
    resources: 0,
    files: 0,
  };

  let newEngagementId: string;

  try {
    newEngagementId = await db.transaction(async (tx) => {
      // ── Create engagement ──
      const [newEng] = await tx
        .insert(engagements)
        .values({
          name: trimmedName,
          description: importData.engagement.description,
          status: "scoping",
          startDate: importData.engagement.startDate,
          endDate: importData.engagement.endDate,
        })
        .returning({ id: engagements.id });

      const newId = newEng.id;

      // ── Add importing user as owner ──
      await tx.insert(engagementMembers).values({
        engagementId: newId,
        userId,
        role: "owner",
      });

      // ── Resolve category presets ──
      const presetCache = new Map<string, string>();
      await resolvePresets(tx, importData.categories, presetCache, userId);

      // ── Resolve tags ──
      const allTags = collectAllTags(importData.categories);
      const tagMap = await resolveTagIds(tx, allTags, userId);

      // ── Create categories and contents (DFS) ──
      for (const category of importData.categories) {
        await importCategoryTree(
          tx,
          category,
          newId,
          null, // parentId
          userId,
          presetCache,
          tagMap,
          options,
          stats,
          fileWriteOps
        );
      }

      // ── Import scope data ──
      if (options.includeScope && importData.scope) {
        await importScopeData(
          tx,
          importData.scope,
          newId,
          userId,
          fileWriteOps,
          stats
        );
      }

      // ── Import IP geolocations ──
      if (options.includeIPs && importData.ipGeolocations && importData.ipGeolocations.length > 0) {
        await tx.insert(ipGeolocations).values(
          importData.ipGeolocations.map((ip) => ({
            engagementId: newId,
            ip: ip.ip,
            countryCode: ip.countryCode,
            countryName: ip.countryName,
            isManual: true,
            isPrivate: ip.isPrivate,
          }))
        );
      }

      // ── Import audit log ──
      if (options.includeAuditLog && importData.auditLog && importData.auditLog.length > 0) {
        // Filter to valid event types and insert with the importing user as actor,
        // preserving the original actor info in metadata
        const validEntries = importData.auditLog.filter((e) =>
          (VALID_ACTIVITY_EVENT_TYPES as Set<string>).has(e.eventType)
        );

        if (validEntries.length > 0) {
          for (let i = 0; i < validEntries.length; i += 500) {
            const batch = validEntries.slice(i, i + 500);
            await tx.insert(engagementActivityLog).values(
              batch.map((e) => ({
                engagementId: newId,
                actorId: userId,
                eventType: e.eventType as typeof VALID_ACTIVITY_EVENT_TYPES extends Set<infer T> ? T : never,
                metadata: {
                  ...(e.metadata && typeof e.metadata === "object" ? e.metadata as Record<string, unknown> : {}),
                  _importedFrom: {
                    actorUsername: e.actorUsername,
                    actorDisplayName: e.actorDisplayName,
                    originalTimestamp: e.createdAt,
                  },
                },
                createdAt: new Date(e.createdAt),
              }))
            );
          }
        }
      }

      return newId;
    });
  } catch (error) {
    console.error("Engagement import failed:", error);
    return { error: "Import failed. Please try again." };
  }

  // ── Write files to disk (outside transaction) ──
  if (fileWriteOps.length > 0) {
    await mkdir(RESOURCES_DIR, { recursive: true });

    let writeErrors = 0;
    for (const op of fileWriteOps) {
      try {
        const encrypted = encryptFileBuffer(op.plaintext, newEngagementId);
        await writeFile(join(RESOURCES_DIR, op.diskFilename), encrypted);
      } catch {
        writeErrors++;
      }
    }

    if (writeErrors > 0) {
      console.warn(
        `Engagement import: ${writeErrors}/${fileWriteOps.length} file writes failed`
      );
    }
  }

  // Log activity
  await logActivity({
    engagementId: newEngagementId,
    actorId: userId,
    eventType: "engagement_imported",
    metadata: {
      sourceExporter: importData.manifest.exportedBy,
      sourceExportedAt: importData.manifest.exportedAt,
      categoryCount: String(stats.categories),
      findingCount: String(stats.findings),
      actionCount: String(stats.actions),
      resourceCount: String(stats.resources),
      fileCount: String(stats.files),
    },
  });

  return { engagementId: newEngagementId, stats };
}

// ── Preset resolution ────────────────────────────────────────────

async function resolvePresets(
  tx: Parameters<Parameters<typeof db.transaction>[0]>[0],
  categories: ImportCategory[],
  cache: Map<string, string>,
  userId: string
): Promise<void> {
  // Collect all unique preset names
  const presetNames = new Set<string>();
  function collectPresetNames(cats: ImportCategory[]) {
    for (const cat of cats) {
      if (cat.presetName) presetNames.add(cat.presetName);
      collectPresetNames(cat.children);
    }
  }
  collectPresetNames(categories);

  if (presetNames.size === 0) {
    // No preset info — we'll handle fallback in importCategoryTree
    return;
  }

  // Query existing presets
  const existing = await tx
    .select({ id: categoryPresets.id, name: categoryPresets.name })
    .from(categoryPresets)
    .where(inArray(categoryPresets.name, Array.from(presetNames)));

  for (const p of existing) {
    cache.set(p.name, p.id);
  }

  // Create missing presets
  const missingNames = Array.from(presetNames).filter((n) => !cache.has(n));
  for (const name of missingNames) {
    // Find the icon from the first category using this preset
    const icon = findPresetIcon(categories, name) ?? "📁";
    const [created] = await tx
      .insert(categoryPresets)
      .values({
        name,
        icon,
        isSystem: false,
        createdBy: userId,
      })
      .returning({ id: categoryPresets.id });
    cache.set(name, created.id);
  }
}

function findPresetIcon(categories: ImportCategory[], presetName: string): string | null {
  for (const cat of categories) {
    if (cat.presetName === presetName && cat.presetIcon) return cat.presetIcon;
    const found = findPresetIcon(cat.children, presetName);
    if (found) return found;
  }
  return null;
}

async function getOrCreateFallbackPreset(
  tx: Parameters<Parameters<typeof db.transaction>[0]>[0],
  cache: Map<string, string>,
  userId: string
): Promise<string> {
  const fallbackName = "Imported";
  if (cache.has(fallbackName)) return cache.get(fallbackName)!;

  const [existing] = await tx
    .select({ id: categoryPresets.id })
    .from(categoryPresets)
    .where(eq(categoryPresets.name, fallbackName))
    .limit(1);

  if (existing) {
    cache.set(fallbackName, existing.id);
    return existing.id;
  }

  const [created] = await tx
    .insert(categoryPresets)
    .values({
      name: fallbackName,
      icon: "📥",
      isSystem: false,
      createdBy: userId,
    })
    .returning({ id: categoryPresets.id });

  cache.set(fallbackName, created.id);
  return created.id;
}

// ── Tag resolution ───────────────────────────────────────────────

function collectAllTags(
  categories: ImportCategory[]
): { name: string; mitreId: string | null; tactic: string | null }[] {
  const seen = new Map<string, { name: string; mitreId: string | null; tactic: string | null }>();

  function collect(cats: ImportCategory[]) {
    for (const cat of cats) {
      for (const f of cat.findings) {
        for (const t of f.tags) {
          const key = t.mitreId ?? `name:${t.name}`;
          if (!seen.has(key)) seen.set(key, t);
        }
      }
      for (const a of cat.actions) {
        for (const t of a.tags) {
          const key = t.mitreId ?? `name:${t.name}`;
          if (!seen.has(key)) seen.set(key, t);
        }
      }
      collect(cat.children);
    }
  }

  collect(categories);
  return Array.from(seen.values());
}

async function resolveTagIds(
  tx: Parameters<Parameters<typeof db.transaction>[0]>[0],
  allTags: { name: string; mitreId: string | null; tactic: string | null }[],
  userId: string
): Promise<Map<string, string>> {
  const result = new Map<string, string>(); // key -> tagId

  // Split by mitreId vs name-only
  const withMitre = allTags.filter((t) => t.mitreId);
  const nameOnly = allTags.filter((t) => !t.mitreId);

  // Resolve tags with mitreId
  if (withMitre.length > 0) {
    const mitreIds = withMitre.map((t) => t.mitreId!);
    const existing = await tx
      .select({ id: tags.id, mitreId: tags.mitreId })
      .from(tags)
      .where(inArray(tags.mitreId, mitreIds));

    for (const e of existing) {
      result.set(e.mitreId!, e.id);
    }

    const missing = withMitre.filter((t) => !result.has(t.mitreId!));
    if (missing.length > 0) {
      const newTags = await tx
        .insert(tags)
        .values(
          missing.map((t) => ({
            name: t.name,
            mitreId: t.mitreId,
            tactic: t.tactic,
            isSystem: false,
            createdBy: userId,
          }))
        )
        .returning({ id: tags.id, mitreId: tags.mitreId });

      for (const nt of newTags) {
        if (nt.mitreId) result.set(nt.mitreId, nt.id);
      }
    }
  }

  // Resolve name-only tags
  if (nameOnly.length > 0) {
    const names = nameOnly.map((t) => t.name);
    const existing = await tx
      .select({ id: tags.id, name: tags.name })
      .from(tags)
      .where(and(inArray(tags.name, names), isNull(tags.mitreId)));

    for (const e of existing) {
      result.set(`name:${e.name}`, e.id);
    }

    const missing = nameOnly.filter((t) => !result.has(`name:${t.name}`));
    if (missing.length > 0) {
      const newTags = await tx
        .insert(tags)
        .values(
          missing.map((t) => ({
            name: t.name,
            mitreId: null,
            tactic: t.tactic,
            isSystem: false,
            createdBy: userId,
          }))
        )
        .returning({ id: tags.id, name: tags.name });

      for (const nt of newTags) {
        result.set(`name:${nt.name}`, nt.id);
      }
    }
  }

  return result;
}

function resolveTagId(
  tag: { name: string; mitreId: string | null },
  tagMap: Map<string, string>
): string | null {
  if (tag.mitreId && tagMap.has(tag.mitreId)) return tagMap.get(tag.mitreId)!;
  if (tagMap.has(`name:${tag.name}`)) return tagMap.get(`name:${tag.name}`)!;
  return null;
}

// ── Category tree import ─────────────────────────────────────────

async function importCategoryTree(
  tx: Parameters<Parameters<typeof db.transaction>[0]>[0],
  category: ImportCategory,
  engagementId: string,
  parentId: string | null,
  userId: string,
  presetCache: Map<string, string>,
  tagMap: Map<string, string>,
  options: ImportOptions,
  stats: { categories: number; findings: number; actions: number; resources: number; files: number },
  fileWriteOps: Array<{ plaintext: Buffer; diskFilename: string }>
): Promise<void> {
  // Resolve preset ID
  let presetId: string;
  if (category.presetName && presetCache.has(category.presetName)) {
    presetId = presetCache.get(category.presetName)!;
  } else {
    presetId = await getOrCreateFallbackPreset(tx, presetCache, userId);
  }

  // Create category
  const [newCat] = await tx
    .insert(engagementCategories)
    .values({
      engagementId,
      parentId,
      presetId,
      name: category.name,
      color: category.color,
      description: category.description,
      locked: false,
      createdBy: userId,
    })
    .returning({ id: engagementCategories.id });

  stats.categories++;

  // ── Import resources first (needed for linked resource resolution) ──
  const resourceNameToId = new Map<string, string>();

  if (options.includeResources) {
    for (const res of category.resources) {
      const newResourceId = await importResource(
        tx,
        res,
        newCat.id,
        engagementId,
        userId,
        fileWriteOps,
        stats
      );
      resourceNameToId.set(res.name, newResourceId);
    }
  }

  // ── Import findings ──
  if (options.includeFindings) {
    for (const finding of category.findings) {
      await importFinding(
        tx,
        finding,
        newCat.id,
        userId,
        tagMap,
        resourceNameToId,
        fileWriteOps,
        stats
      );
    }
  }

  // ── Import actions ──
  if (options.includeActions) {
    for (const action of category.actions) {
      await importAction(
        tx,
        action,
        newCat.id,
        userId,
        tagMap,
        resourceNameToId,
        stats
      );
    }
  }

  // ── Recurse into children ──
  for (const child of category.children) {
    await importCategoryTree(
      tx,
      child,
      engagementId,
      newCat.id,
      userId,
      presetCache,
      tagMap,
      options,
      stats,
      fileWriteOps
    );
  }
}

// ── Resource import ──────────────────────────────────────────────

async function importResource(
  tx: Parameters<Parameters<typeof db.transaction>[0]>[0],
  res: ImportResource,
  categoryId: string,
  engagementId: string,
  userId: string,
  fileWriteOps: Array<{ plaintext: Buffer; diskFilename: string }>,
  stats: { resources: number; files: number }
): Promise<string> {
  const [newRes] = await tx
    .insert(resources)
    .values({
      categoryId,
      name: res.name,
      description: res.description,
      createdBy: userId,
    })
    .returning({ id: resources.id });

  stats.resources++;

  // Import fields
  if (res.fields.length > 0) {
    await tx.insert(resourceFields).values(
      res.fields.map((f, idx) => {
        let value = f.value;
        let encryptedValue: string | null = null;

        if (f.type === "secret" && f.value) {
          // Re-encrypt the secret for the new engagement
          encryptedValue = encryptFieldValue(f.value, engagementId);
          value = null; // Don't store plaintext
        }

        return {
          resourceId: newRes.id,
          key: f.key,
          label: f.label,
          type: f.type as "text" | "secret" | "url" | "code",
          language: f.language,
          value,
          encryptedValue,
          sortOrder: idx,
        };
      })
    );
  }

  // Queue file writes
  for (const file of res.files) {
    const diskFilename = `${randomUUID()}.enc`;
    fileWriteOps.push({
      plaintext: file.fileBuffer,
      diskFilename,
    });

    await tx.insert(resourceFiles).values({
      resourceId: newRes.id,
      diskPath: diskFilename,
      originalFilename: file.originalFilename,
      mimeType: file.mimeType,
      fileSize: file.fileBuffer.length,
      sortOrder: file.sortOrder,
      createdBy: userId,
    });

    stats.files++;
  }

  return newRes.id;
}

// ── Finding import ───────────────────────────────────────────────

async function importFinding(
  tx: Parameters<Parameters<typeof db.transaction>[0]>[0],
  finding: ImportFinding,
  categoryId: string,
  userId: string,
  tagMap: Map<string, string>,
  resourceNameToId: Map<string, string>,
  fileWriteOps: Array<{ plaintext: Buffer; diskFilename: string }>,
  stats: { findings: number; files: number }
): Promise<void> {
  const [newFinding] = await tx
    .insert(categoryFindings)
    .values({
      categoryId,
      title: finding.title,
      severity: finding.severity as "critical" | "high" | "medium" | "low" | "info" | "fixed",
      cvssScore: finding.cvssScore,
      cvssVector: finding.cvssVector,
      overview: finding.overview,
      overviewFormat: finding.overviewFormat,
      impact: finding.impact,
      impactFormat: finding.impactFormat,
      recommendation: finding.recommendation,
      recommendationFormat: finding.recommendationFormat,
      createdBy: userId,
    })
    .returning({ id: categoryFindings.id });

  stats.findings++;

  // Tag junctions
  const tagInserts: { findingId: string; tagId: string }[] = [];
  for (const t of finding.tags) {
    const tagId = resolveTagId(t, tagMap);
    if (tagId) tagInserts.push({ findingId: newFinding.id, tagId });
  }
  if (tagInserts.length > 0) {
    await tx.insert(findingTags).values(tagInserts);
  }

  // Linked resource junctions
  const resInserts: { findingId: string; resourceId: string }[] = [];
  for (const lr of finding.linkedResources) {
    const resourceId = resourceNameToId.get(lr.name);
    if (resourceId) resInserts.push({ findingId: newFinding.id, resourceId });
  }
  if (resInserts.length > 0) {
    await tx.insert(findingResources).values(resInserts);
  }

  // Screenshots
  for (const ss of finding.screenshots) {
    const diskFilename = `${randomUUID()}.enc`;
    fileWriteOps.push({
      plaintext: ss.fileBuffer,
      diskFilename,
    });

    await tx.insert(findingScreenshots).values({
      findingId: newFinding.id,
      diskPath: diskFilename,
      originalFilename: ss.originalFilename,
      mimeType: guessMimeType(ss.originalFilename),
      fileSize: ss.fileBuffer.length,
      caption: ss.caption,
      sortOrder: ss.sortOrder,
      createdBy: userId,
    });

    stats.files++;
  }
}

// ── Action import ────────────────────────────────────────────────

async function importAction(
  tx: Parameters<Parameters<typeof db.transaction>[0]>[0],
  action: ImportAction,
  categoryId: string,
  userId: string,
  tagMap: Map<string, string>,
  resourceNameToId: Map<string, string>,
  stats: { actions: number }
): Promise<void> {
  const [newAction] = await tx
    .insert(categoryActions)
    .values({
      categoryId,
      title: action.title,
      content: action.content,
      contentFormat: action.contentFormat,
      performedAt: action.performedAt ? new Date(action.performedAt) : undefined,
      createdBy: userId,
    })
    .returning({ id: categoryActions.id });

  stats.actions++;

  // Tag junctions
  const tagInserts: { actionId: string; tagId: string }[] = [];
  for (const t of action.tags) {
    const tagId = resolveTagId(t, tagMap);
    if (tagId) tagInserts.push({ actionId: newAction.id, tagId });
  }
  if (tagInserts.length > 0) {
    await tx.insert(actionTags).values(tagInserts);
  }

  // Linked resource junctions
  const resInserts: { actionId: string; resourceId: string }[] = [];
  for (const lr of action.linkedResources) {
    const resourceId = resourceNameToId.get(lr.name);
    if (resourceId) resInserts.push({ actionId: newAction.id, resourceId });
  }
  if (resInserts.length > 0) {
    await tx.insert(actionResources).values(resInserts);
  }
}

// ── Scope import ─────────────────────────────────────────────────

async function importScopeData(
  tx: Parameters<Parameters<typeof db.transaction>[0]>[0],
  scope: NonNullable<ImportData["scope"]>,
  engagementId: string,
  userId: string,
  fileWriteOps: Array<{ plaintext: Buffer; diskFilename: string }>,
  stats: { files: number }
): Promise<void> {
  // Targets
  if (scope.targets.length > 0) {
    await tx.insert(scopeTargets).values(
      scope.targets.map((t) => ({
        engagementId,
        type: t.type as "ip" | "cidr" | "domain" | "url" | "application" | "network",
        value: t.value,
        notes: t.notes,
        createdBy: userId,
      }))
    );
  }

  // Exclusions
  if (scope.exclusions.length > 0) {
    await tx.insert(scopeExclusions).values(
      scope.exclusions.map((e) => ({
        engagementId,
        type: e.type as "ip" | "cidr" | "domain" | "url" | "application" | "network",
        value: e.value,
        justification: e.justification,
        createdBy: userId,
      }))
    );
  }

  // Constraints
  if (scope.constraints.length > 0) {
    await tx.insert(scopeConstraints).values(
      scope.constraints.map((c) => ({
        engagementId,
        constraint: c.constraint,
        createdBy: userId,
      }))
    );
  }

  // Contacts (re-encrypt phone)
  if (scope.contacts.length > 0) {
    await tx.insert(contacts).values(
      scope.contacts.map((c, idx) => {
        let encryptedPhone: string | null = null;
        if (c.phone) {
          encryptedPhone = encryptFieldValue(c.phone, engagementId);
        }
        return {
          engagementId,
          name: c.name,
          title: c.title,
          email: c.email,
          encryptedPhone,
          isPrimary: c.isPrimary,
          sortOrder: idx,
          createdBy: userId,
        };
      })
    );
  }

  // Scope documents (re-encrypt files)
  for (const doc of scope.documents) {
    const diskFilename = `${randomUUID()}.enc`;
    fileWriteOps.push({
      plaintext: doc.fileBuffer,
      diskFilename,
    });

    await tx.insert(scopeDocuments).values({
      engagementId,
      documentType: doc.documentType as "authorization_letter" | "msa" | "sow" | "nda" | "other",
      name: doc.name,
      description: doc.description,
      referenceNumber: doc.referenceNumber,
      diskPath: diskFilename,
      originalFilename: doc.originalFilename,
      mimeType: guessMimeType(doc.originalFilename),
      fileSize: doc.fileBuffer.length,
      createdBy: userId,
    });

    stats.files++;
  }
}

// ── Constants ────────────────────────────────────────────────────

const VALID_ACTIVITY_EVENT_TYPES = new Set([
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
  "engagement_status_changed",
  "comment_created",
  "scope_target_added",
  "scope_target_removed",
  "scope_exclusion_added",
  "scope_exclusion_removed",
  "scope_constraint_added",
  "scope_constraint_removed",
  "contact_added",
  "contact_removed",
  "scope_document_uploaded",
  "scope_document_removed",
  "ai_chat_message",
  "engagement_exported",
  "engagement_duplicated",
  "engagement_imported",
] as const);

// ── Utilities ────────────────────────────────────────────────────

function guessMimeType(filename: string): string {
  const ext = filename.split(".").pop()?.toLowerCase();
  const mimeTypes: Record<string, string> = {
    png: "image/png",
    jpg: "image/jpeg",
    jpeg: "image/jpeg",
    gif: "image/gif",
    webp: "image/webp",
    svg: "image/svg+xml",
    pdf: "application/pdf",
    doc: "application/msword",
    docx: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    xls: "application/vnd.ms-excel",
    xlsx: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    txt: "text/plain",
    csv: "text/csv",
    json: "application/json",
    xml: "application/xml",
    zip: "application/zip",
  };
  return mimeTypes[ext ?? ""] ?? "application/octet-stream";
}
