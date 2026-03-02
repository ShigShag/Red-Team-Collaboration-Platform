import { redirect, notFound } from "next/navigation";
import { BackLink } from "../back-link";
import { eq, and } from "drizzle-orm";
import { db } from "@/db";
import {
  engagements,
  engagementMembers,
  scopeTargets,
  scopeExclusions,
  scopeConstraints,
  contacts as contactsTable,
  scopeDocuments,
} from "@/db/schema";
import { getSession } from "@/lib/auth/session";
import {
  isContentLocked,
  type EngagementStatus,
} from "@/lib/engagement-status";
import { ScopeTargetsCard } from "./scope-targets-card";
import { ScopeExclusionsCard } from "./scope-exclusions-card";
import { ScopeConstraintsCard } from "./scope-constraints-card";
import { ContactsCard } from "./contacts-card";
import { ScopeDocumentsCard } from "./scope-documents-card";

interface Props {
  params: Promise<{ id: string }>;
}

export default async function ScopePage({ params }: Props) {
  const { id: engagementId } = await params;
  const session = await getSession();
  if (!session) redirect("/login");

  const [engagement] = await db
    .select({
      id: engagements.id,
      name: engagements.name,
      status: engagements.status,
    })
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

  const status = (engagement.status ?? "scoping") as EngagementStatus;
  const isOwner = member.role === "owner";
  const readOnly = isContentLocked(status, isOwner);
  const canWrite = !readOnly && member.role !== "read";

  // Fetch all scope data in parallel
  const [targets, exclusions, constraints, contacts, documents] =
    await Promise.all([
      db
        .select()
        .from(scopeTargets)
        .where(eq(scopeTargets.engagementId, engagementId))
        .orderBy(scopeTargets.createdAt),
      db
        .select()
        .from(scopeExclusions)
        .where(eq(scopeExclusions.engagementId, engagementId))
        .orderBy(scopeExclusions.createdAt),
      db
        .select()
        .from(scopeConstraints)
        .where(eq(scopeConstraints.engagementId, engagementId))
        .orderBy(scopeConstraints.createdAt),
      db
        .select()
        .from(contactsTable)
        .where(eq(contactsTable.engagementId, engagementId))
        .orderBy(contactsTable.sortOrder),
      db
        .select()
        .from(scopeDocuments)
        .where(eq(scopeDocuments.engagementId, engagementId))
        .orderBy(scopeDocuments.createdAt),
    ]);

  return (
    <div className="animate-fade-in-up">
      <div className="mb-6">
        <BackLink
          href={`/engagements/${engagementId}`}
          label={`Back to ${engagement.name}`}
        />
      </div>

      <div className="mb-8">
        <div className="flex items-center gap-2 mb-2">
          <div className="h-px w-8 bg-accent/50" />
          <span className="text-[10px] font-medium text-accent tracking-[0.2em] uppercase">
            Scope & Rules of Engagement
          </span>
        </div>
        <h1 className="text-2xl font-semibold text-text-primary tracking-tight">
          Scope Definition
        </h1>
        <p className="text-sm text-text-secondary mt-1">
          Define in-scope targets, exclusions, authorized techniques, emergency
          contacts and legal authorization documents.
          {!canWrite && " You have read-only access."}
        </p>
      </div>

      <div className="max-w-4xl space-y-6">
        <ScopeTargetsCard
          targets={targets.map((t) => ({
            id: t.id,
            type: t.type,
            value: t.value,
            notes: t.notes,
            createdAt: t.createdAt.toISOString(),
          }))}
          engagementId={engagementId}
          canWrite={canWrite}
        />

        <ScopeExclusionsCard
          exclusions={exclusions.map((e) => ({
            id: e.id,
            type: e.type,
            value: e.value,
            justification: e.justification,
            createdAt: e.createdAt.toISOString(),
          }))}
          engagementId={engagementId}
          canWrite={canWrite}
        />

        <ScopeConstraintsCard
          constraints={constraints.map((c) => ({
            id: c.id,
            constraint: c.constraint,
            createdAt: c.createdAt.toISOString(),
          }))}
          engagementId={engagementId}
          canWrite={canWrite}
        />

        <ContactsCard
          contacts={contacts.map((c) => ({
            id: c.id,
            name: c.name,
            title: c.title,
            email: c.email,
            hasPhone: !!c.encryptedPhone,
            encryptedPhone: c.encryptedPhone,
            isPrimary: c.isPrimary,
            createdAt: c.createdAt.toISOString(),
          }))}
          engagementId={engagementId}
          canWrite={canWrite}
        />

        <ScopeDocumentsCard
          documents={documents.map((d) => ({
            id: d.id,
            documentType: d.documentType,
            name: d.name,
            description: d.description,
            referenceNumber: d.referenceNumber,
            originalFilename: d.originalFilename,
            fileSize: d.fileSize,
            createdAt: d.createdAt.toISOString(),
          }))}
          engagementId={engagementId}
          canWrite={canWrite}
        />
      </div>
    </div>
  );
}
