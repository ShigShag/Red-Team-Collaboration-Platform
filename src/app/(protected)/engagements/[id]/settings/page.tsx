import { redirect, notFound } from "next/navigation";
import { BackLink } from "../back-link";

import { eq, and } from "drizzle-orm";
import { db } from "@/db";
import { users, engagements, engagementMembers } from "@/db/schema";
import { getSession } from "@/lib/auth/session";
import { EngagementDetailsForm } from "./engagement-details-form";
import { MemberList } from "../member-list";
import { AddMemberForm } from "../add-member-form";
import { TimespanForm } from "../timespan-form";
import { EngagementDangerZone } from "../engagement-danger-zone";
import { EngagementStatusForm } from "../engagement-status-form";
import {
  isMemberManagementLocked,
  isSettingsLocked,
  type EngagementStatus,
} from "@/lib/engagement-status";

interface Props {
  params: Promise<{ id: string }>;
}

export default async function EngagementSettingsPage({ params }: Props) {
  const { id: engagementId } = await params;
  const session = await getSession();
  if (!session) redirect("/login");

  // Fetch engagement
  const [engagement] = await db
    .select()
    .from(engagements)
    .where(eq(engagements.id, engagementId))
    .limit(1);

  if (!engagement) notFound();

  // Verify ownership
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

  const isOwner = currentMember.role === "owner";

  // Non-owners can't access settings
  if (!isOwner) redirect(`/engagements/${engagementId}`);

  const status = engagement.status as EngagementStatus;
  const settingsLocked = isSettingsLocked(status);
  const membersLocked = isMemberManagementLocked(status);

  // Fetch all members
  const members = await db
    .select({
      memberId: engagementMembers.id,
      userId: engagementMembers.userId,
      role: engagementMembers.role,
      joinedAt: engagementMembers.createdAt,
      username: users.username,
      displayName: users.displayName,
      avatarPath: users.avatarPath,
    })
    .from(engagementMembers)
    .innerJoin(users, eq(engagementMembers.userId, users.id))
    .where(eq(engagementMembers.engagementId, engagementId))
    .orderBy(engagementMembers.createdAt);

  const ownerCount = members.filter((m) => m.role === "owner").length;

  return (
    <div className="space-y-8 animate-fade-in-up">
      {/* Back link + header */}
      <div>
        <div className="mb-4">
          <BackLink href={`/engagements/${engagementId}`} label="Back to Engagement" />
        </div>

        <div className="flex items-center gap-2 mb-2">
          <div className="h-px w-8 bg-accent/50" />
          <span className="text-[10px] font-medium text-accent tracking-[0.2em] uppercase">
            Settings
          </span>
        </div>
        <h1 className="text-2xl font-semibold text-text-primary tracking-tight">
          {engagement.name}
        </h1>
        <p className="text-sm text-text-secondary mt-1">
          Manage engagement details, members, and configuration
        </p>
      </div>

      <div className="max-w-3xl space-y-6">
        {/* Status card */}
        <div className="relative bg-bg-surface/80 border border-border-default rounded-lg p-5">
          <div className="absolute top-0 left-5 right-5 h-px bg-gradient-to-r from-transparent via-border-default to-transparent" />
          <h2 className="text-xs font-medium text-text-secondary uppercase tracking-wider mb-4">
            Engagement Status
          </h2>
          <EngagementStatusForm
            engagementId={engagementId}
            currentStatus={status}
          />
        </div>

        {/* Details card */}
        <div className={`relative bg-bg-surface/80 border border-border-default rounded-lg p-5 ${settingsLocked ? "opacity-60 pointer-events-none" : ""}`}>
          <div className="absolute top-0 left-5 right-5 h-px bg-gradient-to-r from-transparent via-border-default to-transparent" />
          <h2 className="text-xs font-medium text-text-secondary uppercase tracking-wider mb-4">
            Details
            {settingsLocked && (
              <span className="ml-2 text-text-muted font-normal normal-case tracking-normal">
                (locked)
              </span>
            )}
          </h2>
          <EngagementDetailsForm
            engagementId={engagementId}
            name={engagement.name}
            description={engagement.description}
          />
        </div>

        {/* Timespan card */}
        <div className={`relative bg-bg-surface/80 border border-border-default rounded-lg p-5 ${settingsLocked ? "opacity-60 pointer-events-none" : ""}`}>
          <div className="absolute top-0 left-5 right-5 h-px bg-gradient-to-r from-transparent via-border-default to-transparent" />
          <h2 className="text-xs font-medium text-text-secondary uppercase tracking-wider mb-4">
            Timespan
            {settingsLocked && (
              <span className="ml-2 text-text-muted font-normal normal-case tracking-normal">
                (locked)
              </span>
            )}
          </h2>
          <TimespanForm
            engagementId={engagementId}
            startDate={engagement.startDate}
            endDate={engagement.endDate}
            isOwner={true}
          />
        </div>

        {/* Members card */}
        <div className={`relative bg-bg-surface/80 border border-border-default rounded-lg p-5 ${membersLocked ? "opacity-60 pointer-events-none" : ""}`}>
          <div className="absolute top-0 left-5 right-5 h-px bg-gradient-to-r from-transparent via-border-default to-transparent" />
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-xs font-medium text-text-secondary uppercase tracking-wider">
              Members
              {membersLocked && (
                <span className="ml-2 text-text-muted font-normal normal-case tracking-normal">
                  (locked)
                </span>
              )}
            </h2>
            <span className="text-[10px] font-mono text-text-muted">
              {members.length} {members.length === 1 ? "member" : "members"}
            </span>
          </div>

          <MemberList
            members={members.map((m) => ({
              memberId: m.memberId,
              userId: m.userId,
              username: m.username,
              displayName: m.displayName,
              avatarUrl: m.avatarPath
                ? `/api/avatar/${m.userId}`
                : null,
              role: m.role,
              joinedAt: m.joinedAt.toISOString(),
            }))}
            engagementId={engagementId}
            isOwner={!membersLocked}
            currentUserId={session.userId}
            ownerCount={ownerCount}
          />
        </div>

        {/* Add member */}
        {!membersLocked && (
          <div className="relative bg-bg-surface/80 border border-border-default rounded-lg p-5">
            <div className="absolute top-0 left-5 right-5 h-px bg-gradient-to-r from-transparent via-border-default to-transparent" />
            <h2 className="text-xs font-medium text-text-secondary uppercase tracking-wider mb-4">
              Add Member
            </h2>
            <AddMemberForm engagementId={engagementId} />
          </div>
        )}

        {/* Danger zone */}
        <EngagementDangerZone
          engagementId={engagementId}
          engagementName={engagement.name}
        />
      </div>
    </div>
  );
}
