import { NextRequest, NextResponse } from "next/server";
import { eq, and, inArray, ilike, or, sql, ne } from "drizzle-orm";
import { getSession } from "@/lib/auth/session";
import { db } from "@/db";
import {
  engagements,
  engagementMembers,
  engagementCategories,
  categoryFindings,
  categoryActions,
  resources,
  resourceFields,
  scopeTargets,
} from "@/db/schema";
import { globalSearchSchema } from "@/lib/validations";

export interface SearchResult {
  id: string;
  type: "engagement" | "finding" | "action" | "resource" | "scope_target";
  title: string;
  snippet: string;
  engagementId: string;
  engagementName: string;
  categoryId?: string;
  categoryName?: string;
  severity?: string;
  scopeType?: string;
  rank: number;
}

interface SearchResponse {
  results: {
    engagements: SearchResult[];
    findings: SearchResult[];
    actions: SearchResult[];
    resources: SearchResult[];
    scope: SearchResult[];
  };
  query: string;
  totalCount: number;
}

const emptyResults: SearchResponse["results"] = {
  engagements: [],
  findings: [],
  actions: [],
  resources: [],
  scope: [],
};

export async function GET(request: NextRequest) {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  // Parse and validate query params
  const params = Object.fromEntries(request.nextUrl.searchParams.entries());
  const parsed = globalSearchSchema.safeParse(params);
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.flatten() },
      { status: 400 }
    );
  }

  const { q: query, type: searchType, limit } = parsed.data;

  // Get all engagement IDs the user has access to
  const accessible = await db
    .select({
      id: engagementMembers.engagementId,
      name: engagements.name,
    })
    .from(engagementMembers)
    .innerJoin(engagements, eq(engagementMembers.engagementId, engagements.id))
    .where(eq(engagementMembers.userId, session.userId));

  if (accessible.length === 0) {
    return NextResponse.json({
      results: emptyResults,
      query,
      totalCount: 0,
    } satisfies SearchResponse);
  }

  const engagementIds = accessible.map((e) => e.id);
  const engagementNameMap = new Map(accessible.map((e) => [e.id, e.name]));

  // Also build a category → engagement map for joined queries
  const categories =
    searchType === "engagements"
      ? []
      : await db
          .select({
            id: engagementCategories.id,
            name: engagementCategories.name,
            engagementId: engagementCategories.engagementId,
          })
          .from(engagementCategories)
          .where(inArray(engagementCategories.engagementId, engagementIds));

  const catIds = categories.map((c) => c.id);
  const catMap = new Map(
    categories.map((c) => [c.id, { name: c.name, engagementId: c.engagementId }])
  );

  // Determine if FTS tsquery will work for this query.
  // websearch_to_tsquery handles quoted phrases, OR, -, etc.
  // For very short queries or queries that produce empty tsquery, fall back to ILIKE.
  const ilikePat = `%${query}%`;

  // Build FTS condition helpers.
  // The expression MUST match the GIN index expression exactly.
  function ftsMatch(tsvecExpr: ReturnType<typeof sql>, q: string) {
    return sql`${tsvecExpr} @@ websearch_to_tsquery('english', ${q})`;
  }

  function ftsRank(tsvecExpr: ReturnType<typeof sql>, q: string) {
    return sql<number>`ts_rank(${tsvecExpr}, websearch_to_tsquery('english', ${q}))`;
  }

  function ftsHeadline(col: ReturnType<typeof sql>, q: string) {
    return sql<string>`ts_headline('english', coalesce(${col}::text, ''), websearch_to_tsquery('english', ${q}), 'MaxFragments=1,MaxWords=15,MinWords=5,StartSel="",StopSel=""')`;
  }

  // Run queries in parallel
  const promises: Record<string, Promise<SearchResult[]>> = {};

  // --- Engagements ---
  if (searchType === "all" || searchType === "engagements") {
    const tsvec = sql`to_tsvector('english', coalesce(${engagements.name}, '') || ' ' || coalesce(${engagements.description}, ''))`;

    promises.engagements = db
      .select({
        id: engagements.id,
        name: engagements.name,
        description: engagements.description,
        rank: ftsRank(tsvec, query),
        headline: ftsHeadline(sql`coalesce(${engagements.name}, '') || ' ' || coalesce(${engagements.description}, '')`, query),
      })
      .from(engagements)
      .where(
        and(
          inArray(engagements.id, engagementIds),
          or(
            ftsMatch(tsvec, query),
            ilike(engagements.name, ilikePat),
            ilike(engagements.description, ilikePat)
          )
        )
      )
      .orderBy(sql`${ftsRank(tsvec, query)} DESC`)
      .limit(limit)
      .then((rows) =>
        rows.map((r) => ({
          id: r.id,
          type: "engagement" as const,
          title: r.name,
          snippet: r.headline || extractSnippet(query, (r.name ?? "") + " " + (r.description ?? "")),
          engagementId: r.id,
          engagementName: r.name,
          rank: r.rank ?? 0,
        }))
      );
  }

  // --- Findings ---
  if ((searchType === "all" || searchType === "findings") && catIds.length > 0) {
    const tsvec = sql`to_tsvector('english', coalesce(${categoryFindings.title}, '') || ' ' || coalesce(${categoryFindings.overview}, '') || ' ' || coalesce(${categoryFindings.impact}, '') || ' ' || coalesce(${categoryFindings.recommendation}, ''))`;

    promises.findings = db
      .select({
        id: categoryFindings.id,
        title: categoryFindings.title,
        overview: categoryFindings.overview,
        severity: categoryFindings.severity,
        categoryId: categoryFindings.categoryId,
        rank: ftsRank(tsvec, query),
        headline: ftsHeadline(
          sql`coalesce(${categoryFindings.title}, '') || ' ' || coalesce(${categoryFindings.overview}, '')`,
          query
        ),
      })
      .from(categoryFindings)
      .where(
        and(
          inArray(categoryFindings.categoryId, catIds),
          or(
            ftsMatch(tsvec, query),
            ilike(categoryFindings.title, ilikePat),
            ilike(categoryFindings.overview, ilikePat),
            ilike(categoryFindings.impact, ilikePat),
            ilike(categoryFindings.recommendation, ilikePat)
          )
        )
      )
      .orderBy(sql`${ftsRank(tsvec, query)} DESC`)
      .limit(limit)
      .then((rows) =>
        rows.map((r) => {
          const cat = catMap.get(r.categoryId);
          return {
            id: r.id,
            type: "finding" as const,
            title: r.title,
            snippet: r.headline || extractSnippet(query, (r.title ?? "") + " " + (r.overview ?? "")),
            engagementId: cat?.engagementId ?? "",
            engagementName: engagementNameMap.get(cat?.engagementId ?? "") ?? "",
            categoryId: r.categoryId,
            categoryName: cat?.name ?? "",
            severity: r.severity,
            rank: r.rank ?? 0,
          };
        })
      );
  }

  // --- Actions ---
  if ((searchType === "all" || searchType === "actions") && catIds.length > 0) {
    const tsvec = sql`to_tsvector('english', coalesce(${categoryActions.title}, '') || ' ' || coalesce(${categoryActions.content}, ''))`;

    promises.actions = db
      .select({
        id: categoryActions.id,
        title: categoryActions.title,
        content: categoryActions.content,
        categoryId: categoryActions.categoryId,
        rank: ftsRank(tsvec, query),
        headline: ftsHeadline(
          sql`coalesce(${categoryActions.title}, '') || ' ' || coalesce(${categoryActions.content}, '')`,
          query
        ),
      })
      .from(categoryActions)
      .where(
        and(
          inArray(categoryActions.categoryId, catIds),
          or(
            ftsMatch(tsvec, query),
            ilike(categoryActions.title, ilikePat),
            ilike(categoryActions.content, ilikePat)
          )
        )
      )
      .orderBy(sql`${ftsRank(tsvec, query)} DESC`)
      .limit(limit)
      .then((rows) =>
        rows.map((r) => {
          const cat = catMap.get(r.categoryId);
          return {
            id: r.id,
            type: "action" as const,
            title: r.title,
            snippet: r.headline || extractSnippet(query, (r.title ?? "") + " " + (r.content ?? "")),
            engagementId: cat?.engagementId ?? "",
            engagementName: engagementNameMap.get(cat?.engagementId ?? "") ?? "",
            categoryId: r.categoryId,
            categoryName: cat?.name ?? "",
            rank: r.rank ?? 0,
          };
        })
      );
  }

  // --- Resources (name/description + non-secret field values) ---
  if ((searchType === "all" || searchType === "resources") && catIds.length > 0) {
    const tsvec = sql`to_tsvector('english', coalesce(${resources.name}, '') || ' ' || coalesce(${resources.description}, ''))`;

    // Search resource names/descriptions with FTS
    const resourceNameSearch = db
      .select({
        id: resources.id,
        name: resources.name,
        description: resources.description,
        categoryId: resources.categoryId,
        rank: ftsRank(tsvec, query),
        headline: ftsHeadline(
          sql`coalesce(${resources.name}, '') || ' ' || coalesce(${resources.description}, '')`,
          query
        ),
      })
      .from(resources)
      .where(
        and(
          inArray(resources.categoryId, catIds),
          or(
            ftsMatch(tsvec, query),
            ilike(resources.name, ilikePat),
            ilike(resources.description, ilikePat)
          )
        )
      )
      .orderBy(sql`${ftsRank(tsvec, query)} DESC`)
      .limit(limit);

    // Search non-secret resource field values with ILIKE
    const resourceFieldSearch = db
      .select({
        resourceId: resourceFields.resourceId,
        label: resourceFields.label,
        value: resourceFields.value,
        resourceName: resources.name,
        categoryId: resources.categoryId,
      })
      .from(resourceFields)
      .innerJoin(resources, eq(resourceFields.resourceId, resources.id))
      .where(
        and(
          inArray(resources.categoryId, catIds),
          ne(resourceFields.type, "secret"),
          ilike(resourceFields.value, ilikePat)
        )
      )
      .limit(limit);

    promises.resources = Promise.all([resourceNameSearch, resourceFieldSearch]).then(
      ([nameRows, fieldRows]) => {
        const results: SearchResult[] = [];
        const seen = new Set<string>();

        // Add resource name matches
        for (const r of nameRows) {
          const cat = catMap.get(r.categoryId);
          seen.add(r.id);
          results.push({
            id: r.id,
            type: "resource",
            title: r.name,
            snippet: r.headline || extractSnippet(query, (r.name ?? "") + " " + (r.description ?? "")),
            engagementId: cat?.engagementId ?? "",
            engagementName: engagementNameMap.get(cat?.engagementId ?? "") ?? "",
            categoryId: r.categoryId,
            categoryName: cat?.name ?? "",
            rank: r.rank ?? 0,
          });
        }

        // Add resource field matches (deduplicate by resource)
        for (const f of fieldRows) {
          if (seen.has(f.resourceId)) continue;
          seen.add(f.resourceId);
          const cat = catMap.get(f.categoryId);
          results.push({
            id: f.resourceId,
            type: "resource",
            title: f.resourceName,
            snippet: `${f.label}: ${extractSnippet(query, f.value ?? "")}`,
            engagementId: cat?.engagementId ?? "",
            engagementName: engagementNameMap.get(cat?.engagementId ?? "") ?? "",
            categoryId: f.categoryId,
            categoryName: cat?.name ?? "",
            rank: 0,
          });
        }

        return results.slice(0, limit);
      }
    );
  }

  // --- Scope Targets ---
  if (searchType === "all" || searchType === "scope") {
    const tsvec = sql`to_tsvector('english', coalesce(${scopeTargets.value}, '') || ' ' || coalesce(${scopeTargets.notes}, ''))`;

    promises.scope = db
      .select({
        id: scopeTargets.id,
        value: scopeTargets.value,
        notes: scopeTargets.notes,
        type: scopeTargets.type,
        engagementId: scopeTargets.engagementId,
        rank: ftsRank(tsvec, query),
      })
      .from(scopeTargets)
      .where(
        and(
          inArray(scopeTargets.engagementId, engagementIds),
          or(
            ftsMatch(tsvec, query),
            ilike(scopeTargets.value, ilikePat),
            ilike(scopeTargets.notes, ilikePat)
          )
        )
      )
      .orderBy(sql`${ftsRank(tsvec, query)} DESC`)
      .limit(limit)
      .then((rows) =>
        rows.map((r) => ({
          id: r.id,
          type: "scope_target" as const,
          title: r.value,
          snippet: r.notes ? extractSnippet(query, r.notes) : r.value,
          engagementId: r.engagementId,
          engagementName: engagementNameMap.get(r.engagementId) ?? "",
          scopeType: r.type,
          rank: r.rank ?? 0,
        }))
      );
  }

  // Await all in parallel
  const keys = Object.keys(promises) as (keyof typeof emptyResults)[];
  const values = await Promise.all(keys.map((k) => promises[k]));

  const results: SearchResponse["results"] = { ...emptyResults };
  keys.forEach((key, i) => {
    results[key] = values[i];
  });

  const totalCount = Object.values(results).reduce(
    (sum, arr) => sum + arr.length,
    0
  );

  return NextResponse.json({
    results,
    query,
    totalCount,
  } satisfies SearchResponse);
}

function extractSnippet(query: string, text: string): string {
  const lower = text.toLowerCase();
  const idx = lower.indexOf(query.toLowerCase());
  if (idx === -1) return text.slice(0, 120).replace(/\n/g, " ");
  const start = Math.max(0, idx - 50);
  const end = Math.min(text.length, idx + query.length + 70);
  return text.slice(start, end).replace(/\n/g, " ");
}
