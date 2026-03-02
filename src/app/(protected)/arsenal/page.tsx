import { redirect } from "next/navigation";
import Link from "next/link";
import { db } from "@/db";
import {
  arsenalTools,
  arsenalTactics,
  arsenalToolTactics,
  arsenalTacticTags,
  tags,
  users,
} from "@/db/schema";
import { eq, sql } from "drizzle-orm";
import { getSession } from "@/lib/auth/session";
import { ToolList } from "./tool-list";
import { TacticList } from "./tactic-list";

export default async function ArsenalPage({
  searchParams,
}: {
  searchParams: Promise<{ tab?: string }>;
}) {
  const session = await getSession();
  if (!session) redirect("/login");

  const { tab } = await searchParams;
  const activeTab = tab === "tactics" ? "tactics" : "tools";

  // Fetch tools with creator info
  const toolsData = await db
    .select({
      id: arsenalTools.id,
      name: arsenalTools.name,
      description: arsenalTools.description,
      url: arsenalTools.url,
      category: arsenalTools.category,
      notes: arsenalTools.notes,
      notesFormat: arsenalTools.notesFormat,
      createdBy: arsenalTools.createdBy,
      createdAt: arsenalTools.createdAt,
      creatorName: users.displayName,
      creatorUsername: users.username,
    })
    .from(arsenalTools)
    .leftJoin(users, eq(arsenalTools.createdBy, users.id))
    .orderBy(arsenalTools.name);

  // Fetch tool-tactic links
  const toolIds = toolsData.map((t) => t.id);
  let toolTacticLinks: { toolId: string; tacticId: string }[] = [];
  if (toolIds.length > 0) {
    toolTacticLinks = await db
      .select({
        toolId: arsenalToolTactics.toolId,
        tacticId: arsenalToolTactics.tacticId,
      })
      .from(arsenalToolTactics)
      .where(sql`${arsenalToolTactics.toolId} IN ${toolIds}`);
  }

  const toolTacticMap = new Map<string, string[]>();
  for (const link of toolTacticLinks) {
    const existing = toolTacticMap.get(link.toolId) || [];
    existing.push(link.tacticId);
    toolTacticMap.set(link.toolId, existing);
  }

  // Fetch tactics with creator info
  const tacticsData = await db
    .select({
      id: arsenalTactics.id,
      name: arsenalTactics.name,
      description: arsenalTactics.description,
      content: arsenalTactics.content,
      contentFormat: arsenalTactics.contentFormat,
      category: arsenalTactics.category,
      createdBy: arsenalTactics.createdBy,
      createdAt: arsenalTactics.createdAt,
      creatorName: users.displayName,
      creatorUsername: users.username,
    })
    .from(arsenalTactics)
    .leftJoin(users, eq(arsenalTactics.createdBy, users.id))
    .orderBy(arsenalTactics.name);

  // Fetch tactic-tag links
  const tacticIds = tacticsData.map((t) => t.id);
  let tacticTagLinks: { tacticId: string; tagId: string }[] = [];
  if (tacticIds.length > 0) {
    tacticTagLinks = await db
      .select({
        tacticId: arsenalTacticTags.tacticId,
        tagId: arsenalTacticTags.tagId,
      })
      .from(arsenalTacticTags)
      .where(sql`${arsenalTacticTags.tacticId} IN ${tacticIds}`);
  }

  const tacticTagMap = new Map<string, string[]>();
  for (const link of tacticTagLinks) {
    const existing = tacticTagMap.get(link.tacticId) || [];
    existing.push(link.tagId);
    tacticTagMap.set(link.tacticId, existing);
  }

  // Fetch tactic-tool links (reverse direction)
  let tacticToolLinks: { tacticId: string; toolId: string }[] = [];
  if (tacticIds.length > 0) {
    tacticToolLinks = await db
      .select({
        tacticId: arsenalToolTactics.tacticId,
        toolId: arsenalToolTactics.toolId,
      })
      .from(arsenalToolTactics)
      .where(sql`${arsenalToolTactics.tacticId} IN ${tacticIds}`);
  }

  const tacticToolMap = new Map<string, string[]>();
  for (const link of tacticToolLinks) {
    const existing = tacticToolMap.get(link.tacticId) || [];
    existing.push(link.toolId);
    tacticToolMap.set(link.tacticId, existing);
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

  // Serialize for client
  const serializedTools = toolsData.map((t) => ({
    id: t.id,
    name: t.name,
    description: t.description,
    url: t.url,
    category: t.category,
    notes: t.notes,
    notesFormat: t.notesFormat,
    createdBy: t.createdBy,
    createdAt: t.createdAt.toISOString(),
    creatorName: t.creatorName || t.creatorUsername || "Unknown",
    tacticIds: toolTacticMap.get(t.id) || [],
  }));

  const serializedTactics = tacticsData.map((t) => ({
    id: t.id,
    name: t.name,
    description: t.description,
    content: t.content,
    contentFormat: t.contentFormat,
    category: t.category,
    createdBy: t.createdBy,
    createdAt: t.createdAt.toISOString(),
    creatorName: t.creatorName || t.creatorUsername || "Unknown",
    tagIds: tacticTagMap.get(t.id) || [],
    toolIds: tacticToolMap.get(t.id) || [],
  }));

  // Simple option arrays for cross-linking in modals
  const tacticOptions = tacticsData.map((t) => ({ id: t.id, name: t.name }));
  const toolOptions = toolsData.map((t) => ({ id: t.id, name: t.name }));

  return (
    <div className="max-w-5xl mx-auto space-y-6 animate-fade-in-up">
      {/* Header */}
      <div>
        <div className="flex items-center gap-2 mb-2">
          <div className="h-px w-8 bg-accent/50" />
          <span className="text-[10px] font-medium text-accent tracking-[0.2em] uppercase">
            Armory
          </span>
        </div>
        <h1 className="text-2xl font-semibold text-text-primary tracking-tight">
          Arsenal
        </h1>
        <p className="text-sm text-text-secondary mt-1">
          Shared tools, techniques, and tactical playbooks
        </p>
      </div>

      {/* Tabs */}
      <div className="flex items-center gap-1 border-b border-border-default">
        <Link
          href="/arsenal?tab=tools"
          className={`px-4 py-2 text-sm font-medium transition-colors duration-100 border-b-2 -mb-px ${
            activeTab === "tools"
              ? "border-accent text-accent"
              : "border-transparent text-text-secondary hover:text-text-primary"
          }`}
        >
          Tools
        </Link>
        <Link
          href="/arsenal?tab=tactics"
          className={`px-4 py-2 text-sm font-medium transition-colors duration-100 border-b-2 -mb-px ${
            activeTab === "tactics"
              ? "border-accent text-accent"
              : "border-transparent text-text-secondary hover:text-text-primary"
          }`}
        >
          Tactics
        </Link>
      </div>

      {activeTab === "tools" ? (
        <ToolList
          tools={serializedTools}
          allTactics={tacticOptions}
          currentUserId={session.userId}
          isAdmin={session.isAdmin}
        />
      ) : (
        <TacticList
          tactics={serializedTactics}
          allTags={allTags}
          allTools={toolOptions}
          currentUserId={session.userId}
          isAdmin={session.isAdmin}
        />
      )}
    </div>
  );
}
