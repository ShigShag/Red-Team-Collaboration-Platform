import { redirect } from "next/navigation";
import Link from "next/link";
import { db } from "@/db";
import { findingTemplates, findingTemplateTags, tags, users, methodologyTemplates } from "@/db/schema";
import { eq, sql } from "drizzle-orm";
import { getSession } from "@/lib/auth/session";
import { TemplateList } from "./template-list";
import { MethodologyTemplateList } from "./methodology-template-list";

export default async function TemplatesPage({
  searchParams,
}: {
  searchParams: Promise<{ tab?: string }>;
}) {
  const session = await getSession();
  if (!session) redirect("/login");

  const { tab } = await searchParams;
  const activeTab = tab === "methodology" ? "methodology" : "finding";

  // Fetch finding templates with creator info
  const templatesData = await db
    .select({
      id: findingTemplates.id,
      title: findingTemplates.title,
      category: findingTemplates.category,
      overview: findingTemplates.overview,
      overviewFormat: findingTemplates.overviewFormat,
      impact: findingTemplates.impact,
      impactFormat: findingTemplates.impactFormat,
      recommendation: findingTemplates.recommendation,
      recommendationFormat: findingTemplates.recommendationFormat,
      severity: findingTemplates.severity,
      cvssScore: findingTemplates.cvssScore,
      cvssVector: findingTemplates.cvssVector,
      isSystem: findingTemplates.isSystem,
      createdBy: findingTemplates.createdBy,
      createdAt: findingTemplates.createdAt,
      creatorName: users.displayName,
      creatorUsername: users.username,
    })
    .from(findingTemplates)
    .leftJoin(users, eq(findingTemplates.createdBy, users.id))
    .orderBy(findingTemplates.title);

  // Fetch tag links for all templates
  const templateIds = templatesData.map((t) => t.id);
  let tagLinks: { templateId: string; tagId: string }[] = [];
  if (templateIds.length > 0) {
    tagLinks = await db
      .select({
        templateId: findingTemplateTags.templateId,
        tagId: findingTemplateTags.tagId,
      })
      .from(findingTemplateTags)
      .where(sql`${findingTemplateTags.templateId} IN ${templateIds}`);
  }

  const tagMap = new Map<string, string[]>();
  for (const link of tagLinks) {
    const existing = tagMap.get(link.templateId) || [];
    existing.push(link.tagId);
    tagMap.set(link.templateId, existing);
  }

  // Fetch all tags for the tag combobox
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
    .orderBy(tags.tactic, tags.name);

  const serializedFindings = templatesData.map((t) => ({
    id: t.id,
    title: t.title,
    category: t.category,
    overview: t.overview,
    overviewFormat: t.overviewFormat,
    impact: t.impact,
    impactFormat: t.impactFormat,
    recommendation: t.recommendation,
    recommendationFormat: t.recommendationFormat,
    severity: t.severity,
    cvssScore: t.cvssScore,
    cvssVector: t.cvssVector,
    isSystem: t.isSystem,
    createdBy: t.createdBy,
    createdAt: t.createdAt.toISOString(),
    creatorName: t.creatorName || t.creatorUsername || "Unknown",
    tagIds: tagMap.get(t.id) || [],
  }));

  // Fetch methodology templates with creator info
  const methodologyData = await db
    .select({
      id: methodologyTemplates.id,
      name: methodologyTemplates.name,
      category: methodologyTemplates.category,
      content: methodologyTemplates.content,
      isSystem: methodologyTemplates.isSystem,
      createdBy: methodologyTemplates.createdBy,
      createdAt: methodologyTemplates.createdAt,
      creatorName: users.displayName,
      creatorUsername: users.username,
    })
    .from(methodologyTemplates)
    .leftJoin(users, eq(methodologyTemplates.createdBy, users.id))
    .orderBy(methodologyTemplates.name);

  const serializedMethodology = methodologyData.map((t) => ({
    id: t.id,
    name: t.name,
    category: t.category,
    content: t.content,
    isSystem: t.isSystem,
    createdBy: t.createdBy,
    createdAt: t.createdAt.toISOString(),
    creatorName: t.creatorName || t.creatorUsername || "Unknown",
  }));

  return (
    <div className="max-w-5xl mx-auto space-y-6 animate-fade-in-up">
      {/* Header */}
      <div>
        <div className="flex items-center gap-2 mb-2">
          <div className="h-px w-8 bg-accent/50" />
          <span className="text-[10px] font-medium text-accent tracking-[0.2em] uppercase">
            Knowledge Base
          </span>
        </div>
        <h1 className="text-2xl font-semibold text-text-primary tracking-tight">
          Templates
        </h1>
        <p className="text-sm text-text-secondary mt-1">
          Reusable knowledge base for engagements
        </p>
      </div>

      {/* Tabs */}
      <div className="flex items-center gap-1 border-b border-border-default">
        <Link
          href="/templates?tab=finding"
          className={`px-4 py-2 text-sm font-medium transition-colors duration-100 border-b-2 -mb-px ${
            activeTab === "finding"
              ? "border-accent text-accent"
              : "border-transparent text-text-secondary hover:text-text-primary"
          }`}
        >
          Finding Templates
        </Link>
        <Link
          href="/templates?tab=methodology"
          className={`px-4 py-2 text-sm font-medium transition-colors duration-100 border-b-2 -mb-px ${
            activeTab === "methodology"
              ? "border-accent text-accent"
              : "border-transparent text-text-secondary hover:text-text-primary"
          }`}
        >
          Methodology Templates
        </Link>
      </div>

      {activeTab === "finding" ? (
        <TemplateList templates={serializedFindings} tags={allTags} />
      ) : (
        <MethodologyTemplateList templates={serializedMethodology} />
      )}
    </div>
  );
}
