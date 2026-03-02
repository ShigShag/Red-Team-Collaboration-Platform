import { redirect, notFound } from "next/navigation";
import { BackLink } from "../back-link";
import { eq, and, inArray, sql } from "drizzle-orm";
import { db } from "@/db";
import {
  engagements,
  engagementMembers,
  engagementCategories,
  categoryPresets,
  resources,
  resourceFields,
} from "@/db/schema";
import { getSession } from "@/lib/auth/session";
import { CredentialsList } from "../credentials-list";

interface Props {
  params: Promise<{ id: string }>;
}

export default async function CredentialsPage({ params }: Props) {
  const { id: engagementId } = await params;
  const session = await getSession();
  if (!session) redirect("/login");

  const [engagement] = await db
    .select({ id: engagements.id, name: engagements.name })
    .from(engagements)
    .where(eq(engagements.id, engagementId))
    .limit(1);

  if (!engagement) notFound();

  const [member] = await db
    .select({ role: engagementMembers.role })
    .from(engagementMembers)
    .where(
      and(
        eq(engagementMembers.engagementId, engagementId),
        eq(engagementMembers.userId, session.userId)
      )
    )
    .limit(1);

  if (!member) notFound();

  // Fetch all categories for this engagement
  const allCategories = await db
    .select({
      id: engagementCategories.id,
      parentId: engagementCategories.parentId,
      name: engagementCategories.name,
      icon: categoryPresets.icon,
      color: engagementCategories.color,
    })
    .from(engagementCategories)
    .innerJoin(categoryPresets, eq(engagementCategories.presetId, categoryPresets.id))
    .where(eq(engagementCategories.engagementId, engagementId))
    .orderBy(engagementCategories.createdAt);

  const categoryIds = allCategories.map((c) => c.id);

  // Fetch all fields for resources that contain at least one secret field
  let credentialResourceFields: Array<{
    fieldId: string;
    fieldLabel: string;
    fieldType: string;
    fieldValue: string | null;
    hasEncryptedValue: boolean;
    resourceId: string;
    resourceName: string;
    categoryId: string;
    categoryName: string;
    categoryIcon: string;
    categoryColor: string | null;
  }> = [];

  if (categoryIds.length > 0) {
    credentialResourceFields = await db
      .select({
        fieldId: resourceFields.id,
        fieldLabel: resourceFields.label,
        fieldType: resourceFields.type,
        fieldValue: resourceFields.value,
        hasEncryptedValue: sql<boolean>`${resourceFields.encryptedValue} IS NOT NULL`,
        resourceId: resources.id,
        resourceName: resources.name,
        categoryId: engagementCategories.id,
        categoryName: engagementCategories.name,
        categoryIcon: categoryPresets.icon,
        categoryColor: engagementCategories.color,
      })
      .from(resourceFields)
      .innerJoin(resources, eq(resourceFields.resourceId, resources.id))
      .innerJoin(engagementCategories, eq(resources.categoryId, engagementCategories.id))
      .innerJoin(categoryPresets, eq(engagementCategories.presetId, categoryPresets.id))
      .where(
        and(
          inArray(resources.categoryId, categoryIds),
          sql`${resources.id} IN (
            SELECT DISTINCT ${resourceFields.resourceId} FROM ${resourceFields}
            WHERE ${resourceFields.type} = 'secret'
          )`
        )
      )
      .orderBy(engagementCategories.name, resources.name, resourceFields.sortOrder);
  }

  // Build category path lookup for breadcrumbs
  const categoryLookup = new Map(allCategories.map((c) => [c.id, c]));
  function getCategoryPath(catId: string) {
    const path: { id: string; name: string; icon: string; color: string | null }[] = [];
    let current = categoryLookup.get(catId);
    while (current) {
      path.unshift({ id: current.id, name: current.name, icon: current.icon, color: current.color });
      current = current.parentId ? categoryLookup.get(current.parentId) : undefined;
    }
    return path;
  }

  // Group credential fields by category → resource
  const credentialCategoryMap = new Map<string, {
    categoryId: string;
    categoryPath: { id: string; name: string; icon: string; color: string | null }[];
    resources: Map<string, {
      resourceId: string;
      resourceName: string;
      fields: { fieldId: string; fieldLabel: string; fieldType: string; value: string | null; hasValue: boolean }[];
    }>;
  }>();

  for (const cf of credentialResourceFields) {
    if (!credentialCategoryMap.has(cf.categoryId)) {
      credentialCategoryMap.set(cf.categoryId, {
        categoryId: cf.categoryId,
        categoryPath: getCategoryPath(cf.categoryId),
        resources: new Map(),
      });
    }
    const cat = credentialCategoryMap.get(cf.categoryId)!;
    if (!cat.resources.has(cf.resourceId)) {
      cat.resources.set(cf.resourceId, {
        resourceId: cf.resourceId,
        resourceName: cf.resourceName,
        fields: [],
      });
    }
    cat.resources.get(cf.resourceId)!.fields.push({
      fieldId: cf.fieldId,
      fieldLabel: cf.fieldLabel,
      fieldType: cf.fieldType,
      value: cf.fieldType === "secret" ? null : cf.fieldValue,
      hasValue: cf.fieldType === "secret" ? cf.hasEncryptedValue : !!cf.fieldValue,
    });
  }

  const credentialCategories = Array.from(credentialCategoryMap.values()).map((cat) => ({
    ...cat,
    resources: Array.from(cat.resources.values()),
  }));

  return (
    <div className="animate-fade-in-up">
      {/* Back link */}
      <div className="mb-6">
        <BackLink href={`/engagements/${engagementId}`} label={`Back to ${engagement.name}`} />
      </div>

      {/* Header */}
      <div className="mb-8">
        <div className="flex items-center gap-2 mb-2">
          <div className="h-px w-8 bg-accent/50" />
          <span className="text-[10px] font-medium text-accent tracking-[0.2em] uppercase">
            Credentials
          </span>
        </div>
        <h1 className="text-2xl font-semibold text-text-primary tracking-tight">
          Credential Management
        </h1>
        <p className="text-sm text-text-secondary mt-1">
          Secrets and credentials from resources across all categories.
        </p>
      </div>

      <CredentialsList
        categories={credentialCategories}
        engagementId={engagementId}
        defaultExpanded
      />
    </div>
  );
}
