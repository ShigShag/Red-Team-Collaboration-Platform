"use server";

import { redirect } from "next/navigation";
import { readFile, writeFile, mkdir } from "fs/promises";
import { join } from "path";
import { eq, inArray } from "drizzle-orm";
import { db } from "@/db";
import {
  engagements,
  engagementMembers,
  engagementCategories,
  categoryAssignments,
  resources,
  resourceFields,
  resourceFiles,
  categoryActions,
  categoryFindings,
  findingScreenshots,
  actionResources,
  actionTags,
  findingResources,
  findingTags,
  scopeTargets,
  scopeExclusions,
  scopeConstraints,
  contacts,
  scopeDocuments,
} from "@/db/schema";
import { getSession } from "@/lib/auth/session";
import { getEffectiveAccess } from "@/lib/engagement-access";
import { logActivity } from "@/lib/activity-log";
import {
  encryptFieldValue,
  decryptFieldValue,
  encryptFileBuffer,
  decryptFileBuffer,
} from "@/lib/crypto/resource-crypto";

const RESOURCES_DIR = join(process.cwd(), "data", "resources");

export interface DuplicateOptions {
  name: string;
  includeMembers: boolean;
  includeCategories: boolean;
  includeScope: boolean;
  includeResources: boolean;
  includeFindings: boolean;
  includeActions: boolean;
}

export interface DuplicateResult {
  error?: string;
}

export async function duplicateEngagement(
  sourceEngagementId: string,
  options: DuplicateOptions,
): Promise<DuplicateResult> {
  const session = await getSession();
  if (!session) redirect("/login");

  // Verify membership (any role or coordinator can duplicate — creates a new independent engagement)
  const access = await getEffectiveAccess(sourceEngagementId, session.userId, session.isCoordinator);
  if (!access) {
    return { error: "You are not a member of this engagement" };
  }

  const trimmedName = options.name.trim();
  if (!trimmedName || trimmedName.length > 255) {
    return { error: "Name is required (max 255 characters)" };
  }

  // Collect file copy operations to perform outside the transaction
  const fileCopyOps: Array<{
    sourceDiskPath: string;
    newDiskFilename: string;
  }> = [];

  let newEngagementId: string;
  let fileCopyWarning = false;

  try {
    newEngagementId = await db.transaction(async (tx) => {
      // ── Create new engagement ──
      const [newEng] = await tx
        .insert(engagements)
        .values({
          name: trimmedName,
          description: null,
          status: "scoping",
        })
        .returning({ id: engagements.id });

      const newId = newEng.id;

      // ── Always make current user the owner ──
      await tx.insert(engagementMembers).values({
        engagementId: newId,
        userId: session.userId,
        role: "owner",
      });

      // ── Copy members ──
      const copiedMemberUserIds = new Set<string>([session.userId]);

      if (options.includeMembers) {
        const sourceMembers = await tx
          .select({
            userId: engagementMembers.userId,
            role: engagementMembers.role,
          })
          .from(engagementMembers)
          .where(eq(engagementMembers.engagementId, sourceEngagementId));

        const othersToInsert = sourceMembers.filter(
          (m) => m.userId !== session.userId,
        );

        if (othersToInsert.length > 0) {
          await tx.insert(engagementMembers).values(
            othersToInsert.map((m) => ({
              engagementId: newId,
              userId: m.userId,
              role: m.role,
            })),
          );
          for (const m of othersToInsert) {
            copiedMemberUserIds.add(m.userId);
          }
        }
      }

      // ── Copy categories (with hierarchy remapping) ──
      const categoryIdMap = new Map<string, string>();
      const resourceIdMap = new Map<string, string>();
      const findingIdMap = new Map<string, string>();
      const actionIdMap = new Map<string, string>();

      if (options.includeCategories) {
        const sourceCategories = await tx
          .select()
          .from(engagementCategories)
          .where(eq(engagementCategories.engagementId, sourceEngagementId));

        // Topological sort: parents before children
        const sorted = topologicalSort(sourceCategories);

        for (const cat of sorted) {
          const [newCat] = await tx
            .insert(engagementCategories)
            .values({
              engagementId: newId,
              parentId: cat.parentId
                ? (categoryIdMap.get(cat.parentId) ?? null)
                : null,
              presetId: cat.presetId,
              name: cat.name,
              color: cat.color,
              description: cat.description,
              locked: false,
              createdBy: session.userId,
            })
            .returning({ id: engagementCategories.id });
          categoryIdMap.set(cat.id, newCat.id);
        }

        // ── Copy category assignments (only for copied members) ──
        if (categoryIdMap.size > 0) {
          const sourceCategoryIds = Array.from(categoryIdMap.keys());
          const sourceAssignments = await tx
            .select()
            .from(categoryAssignments)
            .where(inArray(categoryAssignments.categoryId, sourceCategoryIds));

          const assignmentsToInsert = sourceAssignments
            .filter((a) => copiedMemberUserIds.has(a.userId))
            .map((a) => ({
              categoryId: categoryIdMap.get(a.categoryId)!,
              userId: a.userId,
              assignedBy: session.userId,
            }));

          if (assignmentsToInsert.length > 0) {
            await tx.insert(categoryAssignments).values(assignmentsToInsert);
          }
        }

        // ── Copy resources ──
        if (options.includeResources && categoryIdMap.size > 0) {
          const sourceCategoryIds = Array.from(categoryIdMap.keys());
          const sourceResources = await tx
            .select()
            .from(resources)
            .where(inArray(resources.categoryId, sourceCategoryIds));

          for (const res of sourceResources) {
            const [newRes] = await tx
              .insert(resources)
              .values({
                categoryId: categoryIdMap.get(res.categoryId)!,
                templateId: res.templateId,
                name: res.name,
                description: res.description,
                createdBy: session.userId,
              })
              .returning({ id: resources.id });
            resourceIdMap.set(res.id, newRes.id);
          }

          // Copy resource fields (re-encrypt secrets for new engagement)
          if (resourceIdMap.size > 0) {
            const sourceResourceIds = Array.from(resourceIdMap.keys());
            const sourceFields = await tx
              .select()
              .from(resourceFields)
              .where(inArray(resourceFields.resourceId, sourceResourceIds));

            if (sourceFields.length > 0) {
              await tx.insert(resourceFields).values(
                sourceFields.map((f) => {
                  let newEncryptedValue: string | null = null;
                  if (f.type === "secret" && f.encryptedValue) {
                    try {
                      const plaintext = decryptFieldValue(
                        f.encryptedValue,
                        sourceEngagementId,
                      );
                      newEncryptedValue = encryptFieldValue(plaintext, newId);
                    } catch {
                      newEncryptedValue = null;
                    }
                  }

                  return {
                    resourceId: resourceIdMap.get(f.resourceId)!,
                    key: f.key,
                    label: f.label,
                    type: f.type,
                    language: f.language,
                    value: f.value,
                    encryptedValue: newEncryptedValue,
                    sortOrder: f.sortOrder,
                  };
                }),
              );
            }

            // Queue resource file copy operations
            const sourceResourceFiles = await tx
              .select()
              .from(resourceFiles)
              .where(inArray(resourceFiles.resourceId, sourceResourceIds));

            for (const rf of sourceResourceFiles) {
              const newDiskFilename = `${crypto.randomUUID()}.enc`;
              fileCopyOps.push({
                sourceDiskPath: rf.diskPath,
                newDiskFilename,
              });

              await tx.insert(resourceFiles).values({
                resourceId: resourceIdMap.get(rf.resourceId)!,
                diskPath: newDiskFilename,
                originalFilename: rf.originalFilename,
                mimeType: rf.mimeType,
                fileSize: rf.fileSize,
                sortOrder: rf.sortOrder,
                createdBy: session.userId,
              });
            }
          }
        }

        // ── Copy findings ──
        if (options.includeFindings && categoryIdMap.size > 0) {
          const sourceCategoryIds = Array.from(categoryIdMap.keys());
          const sourceFindings = await tx
            .select()
            .from(categoryFindings)
            .where(inArray(categoryFindings.categoryId, sourceCategoryIds));

          for (const f of sourceFindings) {
            const [newFinding] = await tx
              .insert(categoryFindings)
              .values({
                categoryId: categoryIdMap.get(f.categoryId)!,
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
                createdBy: session.userId,
              })
              .returning({ id: categoryFindings.id });
            findingIdMap.set(f.id, newFinding.id);
          }

          if (findingIdMap.size > 0) {
            const sourceFindingIds = Array.from(findingIdMap.keys());

            // Copy finding screenshots (queue file copies)
            const sourceScreenshots = await tx
              .select()
              .from(findingScreenshots)
              .where(inArray(findingScreenshots.findingId, sourceFindingIds));

            for (const ss of sourceScreenshots) {
              const newDiskFilename = `${crypto.randomUUID()}.enc`;
              fileCopyOps.push({
                sourceDiskPath: ss.diskPath,
                newDiskFilename,
              });

              await tx.insert(findingScreenshots).values({
                findingId: findingIdMap.get(ss.findingId)!,
                diskPath: newDiskFilename,
                originalFilename: ss.originalFilename,
                mimeType: ss.mimeType,
                fileSize: ss.fileSize,
                caption: ss.caption,
                sortOrder: ss.sortOrder,
                createdBy: session.userId,
              });
            }

            // Copy finding-tag junctions
            const sourceFindingTags = await tx
              .select()
              .from(findingTags)
              .where(inArray(findingTags.findingId, sourceFindingIds));

            if (sourceFindingTags.length > 0) {
              await tx.insert(findingTags).values(
                sourceFindingTags.map((ft) => ({
                  findingId: findingIdMap.get(ft.findingId)!,
                  tagId: ft.tagId,
                })),
              );
            }

            // Copy finding-resource junctions (only if resources were also copied)
            if (options.includeResources && resourceIdMap.size > 0) {
              const sourceFindingResources = await tx
                .select()
                .from(findingResources)
                .where(inArray(findingResources.findingId, sourceFindingIds));

              const validFindingResources = sourceFindingResources.filter(
                (fr) => resourceIdMap.has(fr.resourceId),
              );

              if (validFindingResources.length > 0) {
                await tx.insert(findingResources).values(
                  validFindingResources.map((fr) => ({
                    findingId: findingIdMap.get(fr.findingId)!,
                    resourceId: resourceIdMap.get(fr.resourceId)!,
                  })),
                );
              }
            }
          }
        }

        // ── Copy actions ──
        if (options.includeActions && categoryIdMap.size > 0) {
          const sourceCategoryIds = Array.from(categoryIdMap.keys());
          const sourceActions = await tx
            .select()
            .from(categoryActions)
            .where(inArray(categoryActions.categoryId, sourceCategoryIds));

          for (const a of sourceActions) {
            const [newAction] = await tx
              .insert(categoryActions)
              .values({
                categoryId: categoryIdMap.get(a.categoryId)!,
                title: a.title,
                content: a.content,
                contentFormat: a.contentFormat,
                performedAt: a.performedAt,
                createdBy: session.userId,
              })
              .returning({ id: categoryActions.id });
            actionIdMap.set(a.id, newAction.id);
          }

          if (actionIdMap.size > 0) {
            const sourceActionIds = Array.from(actionIdMap.keys());

            // Copy action-tag junctions
            const sourceActionTags = await tx
              .select()
              .from(actionTags)
              .where(inArray(actionTags.actionId, sourceActionIds));

            if (sourceActionTags.length > 0) {
              await tx.insert(actionTags).values(
                sourceActionTags.map((at) => ({
                  actionId: actionIdMap.get(at.actionId)!,
                  tagId: at.tagId,
                })),
              );
            }

            // Copy action-resource junctions (only if resources were also copied)
            if (options.includeResources && resourceIdMap.size > 0) {
              const sourceActionResources = await tx
                .select()
                .from(actionResources)
                .where(inArray(actionResources.actionId, sourceActionIds));

              const validActionResources = sourceActionResources.filter((ar) =>
                resourceIdMap.has(ar.resourceId),
              );

              if (validActionResources.length > 0) {
                await tx.insert(actionResources).values(
                  validActionResources.map((ar) => ({
                    actionId: actionIdMap.get(ar.actionId)!,
                    resourceId: resourceIdMap.get(ar.resourceId)!,
                  })),
                );
              }
            }
          }
        }
      }

      // ── Copy scope data ──
      if (options.includeScope) {
        const sourceTargets = await tx
          .select()
          .from(scopeTargets)
          .where(eq(scopeTargets.engagementId, sourceEngagementId));

        if (sourceTargets.length > 0) {
          await tx.insert(scopeTargets).values(
            sourceTargets.map((t) => ({
              engagementId: newId,
              type: t.type,
              value: t.value,
              notes: t.notes,
              createdBy: session.userId,
            })),
          );
        }

        const sourceExclusions = await tx
          .select()
          .from(scopeExclusions)
          .where(eq(scopeExclusions.engagementId, sourceEngagementId));

        if (sourceExclusions.length > 0) {
          await tx.insert(scopeExclusions).values(
            sourceExclusions.map((e) => ({
              engagementId: newId,
              type: e.type,
              value: e.value,
              justification: e.justification,
              createdBy: session.userId,
            })),
          );
        }

        const sourceConstraints = await tx
          .select()
          .from(scopeConstraints)
          .where(eq(scopeConstraints.engagementId, sourceEngagementId));

        if (sourceConstraints.length > 0) {
          await tx.insert(scopeConstraints).values(
            sourceConstraints.map((c) => ({
              engagementId: newId,
              constraint: c.constraint,
              createdBy: session.userId,
            })),
          );
        }

        // Contacts (re-encrypt phone numbers)
        const sourceContacts = await tx
          .select()
          .from(contacts)
          .where(eq(contacts.engagementId, sourceEngagementId));

        if (sourceContacts.length > 0) {
          await tx.insert(contacts).values(
            sourceContacts.map((c) => {
              let newEncryptedPhone: string | null = null;
              if (c.encryptedPhone) {
                try {
                  const plainPhone = decryptFieldValue(
                    c.encryptedPhone,
                    sourceEngagementId,
                  );
                  newEncryptedPhone = encryptFieldValue(plainPhone, newId);
                } catch {
                  newEncryptedPhone = null;
                }
              }
              return {
                engagementId: newId,
                name: c.name,
                title: c.title,
                email: c.email,
                encryptedPhone: newEncryptedPhone,
                isPrimary: c.isPrimary,
                sortOrder: c.sortOrder,
                createdBy: session.userId,
              };
            }),
          );
        }

        // Scope documents (queue file copies)
        const sourceDocs = await tx
          .select()
          .from(scopeDocuments)
          .where(eq(scopeDocuments.engagementId, sourceEngagementId));

        for (const doc of sourceDocs) {
          const newDiskFilename = `${crypto.randomUUID()}.enc`;
          fileCopyOps.push({
            sourceDiskPath: doc.diskPath,
            newDiskFilename,
          });

          await tx.insert(scopeDocuments).values({
            engagementId: newId,
            documentType: doc.documentType,
            name: doc.name,
            description: doc.description,
            referenceNumber: doc.referenceNumber,
            diskPath: newDiskFilename,
            originalFilename: doc.originalFilename,
            mimeType: doc.mimeType,
            fileSize: doc.fileSize,
            createdBy: session.userId,
          });
        }
      }

      return newId;
    });
  } catch (error) {
    console.error("Engagement duplication failed:", error);
    return { error: "Duplication failed. Please try again." };
  }

  // ── File copy operations (outside transaction) ──
  // Decrypt with source engagement key, re-encrypt with new engagement key
  if (fileCopyOps.length > 0) {
    await mkdir(RESOURCES_DIR, { recursive: true });

    let copyErrors = 0;
    for (const op of fileCopyOps) {
      try {
        const sourceFilename = op.sourceDiskPath.split("/").pop()!;
        const sourcePath = join(RESOURCES_DIR, sourceFilename);
        const encrypted = await readFile(sourcePath);
        const plaintext = decryptFileBuffer(encrypted, sourceEngagementId);
        const reEncrypted = encryptFileBuffer(plaintext, newEngagementId);
        await writeFile(join(RESOURCES_DIR, op.newDiskFilename), reEncrypted);
      } catch (err) {
        console.error(
          `File copy failed: ${op.sourceDiskPath} → ${op.newDiskFilename}`,
          err,
        );
        copyErrors++;
      }
    }

    if (copyErrors > 0) {
      console.warn(
        `Engagement duplication: ${copyErrors}/${fileCopyOps.length} file copies failed`,
      );
      fileCopyWarning = true;
    }
  }

  // Log activity on the new engagement
  await logActivity({
    engagementId: newEngagementId,
    actorId: session.userId,
    eventType: "engagement_duplicated",
    metadata: {
      sourceEngagementId,
      options: JSON.stringify({
        includeMembers: options.includeMembers,
        includeCategories: options.includeCategories,
        includeScope: options.includeScope,
        includeResources: options.includeResources,
        includeFindings: options.includeFindings,
        includeActions: options.includeActions,
      }),
    },
  });

  const redirectUrl = fileCopyWarning
    ? `/engagements/${newEngagementId}?warning=file_copy_failed`
    : `/engagements/${newEngagementId}`;
  redirect(redirectUrl);
}

/** Topological sort: parents before children for hierarchical category insertion */
function topologicalSort<T extends { id: string; parentId: string | null }>(
  items: T[],
): T[] {
  const result: T[] = [];
  const visited = new Set<string>();
  const itemMap = new Map(items.map((i) => [i.id, i]));

  function visit(item: T) {
    if (visited.has(item.id)) return;
    if (
      item.parentId &&
      itemMap.has(item.parentId) &&
      !visited.has(item.parentId)
    ) {
      visit(itemMap.get(item.parentId)!);
    }
    visited.add(item.id);
    result.push(item);
  }

  for (const item of items) visit(item);
  return result;
}
