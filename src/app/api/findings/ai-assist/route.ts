import { NextRequest, NextResponse } from "next/server";
import { eq, and, inArray } from "drizzle-orm";
import { db } from "@/db";
import {
  engagementMembers,
  engagementCategories,
  categoryFindings,
  findingResources,
  resources,
  resourceFields,
} from "@/db/schema";
import { getSession } from "@/lib/auth/session";
import { chatLimiter } from "@/lib/rate-limit";
import {
  ollamaChat,
  parseOllamaStream,
  isOllamaConfigured,
  getFindingModel,
} from "@/lib/ai/ollama-client";
import { buildFindingAssistPrompt } from "@/lib/ai/system-prompt";

const MAX_PROMPT_LENGTH = 500;
const VALID_FIELDS = new Set(["overview", "impact", "recommendation"]);

export async function POST(request: NextRequest) {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  if (!(await isOllamaConfigured())) {
    return NextResponse.json(
      { error: "AI assistant is not configured" },
      { status: 503 }
    );
  }

  const rl = chatLimiter.consume(session.userId);
  if (!rl.allowed) {
    return NextResponse.json(
      { error: "Too many requests. Please wait." },
      { status: 429 }
    );
  }

  interface InlineContext {
    title: string;
    severity: string;
    cvssScore: string | null;
    overview: string;
    overviewFormat: string;
    impact: string;
    impactFormat: string;
    recommendation: string;
    recommendationFormat: string;
    linkedResourceIds?: string[];
  }

  const body = (await request.json()) as {
    engagementId?: string;
    findingId?: string;
    context?: InlineContext;
    field?: string;
    prompt?: string;
  };

  const { engagementId, findingId, context, field, prompt } = body;

  if (!engagementId || !field || !prompt) {
    return NextResponse.json(
      { error: "engagementId, field, and prompt are required" },
      { status: 400 }
    );
  }

  if (!findingId && !context) {
    return NextResponse.json(
      { error: "Either findingId or context is required" },
      { status: 400 }
    );
  }

  if (!VALID_FIELDS.has(field)) {
    return NextResponse.json(
      { error: "field must be overview, impact, or recommendation" },
      { status: 400 }
    );
  }

  const cleanPrompt = prompt
    .slice(0, MAX_PROMPT_LENGTH)
    .replace(/[\x00-\x08\x0B\x0C\x0E-\x1F]/g, "")
    .trim();

  if (!cleanPrompt) {
    return NextResponse.json(
      { error: "Prompt cannot be empty" },
      { status: 400 }
    );
  }

  // Verify membership
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

  if (!member) {
    return NextResponse.json({ error: "Not a member" }, { status: 403 });
  }

  // Build finding context — either from DB or from the request body
  let findingData: {
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
    linkedResources?: { name: string; description: string | null; fields: { label: string; value: string }[] }[];
  };

  if (findingId) {
    // Existing finding — load from DB with engagement verification
    const [finding] = await db
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
      })
      .from(categoryFindings)
      .innerJoin(
        engagementCategories,
        eq(categoryFindings.categoryId, engagementCategories.id)
      )
      .where(
        and(
          eq(categoryFindings.id, findingId),
          eq(engagementCategories.engagementId, engagementId)
        )
      )
      .limit(1);

    if (!finding) {
      return NextResponse.json(
        { error: "Finding not found" },
        { status: 404 }
      );
    }

    // Load linked resources with their fields (exclude secrets)
    const linkedRows = await db
      .select({
        resourceId: resources.id,
        name: resources.name,
        description: resources.description,
      })
      .from(findingResources)
      .innerJoin(resources, eq(findingResources.resourceId, resources.id))
      .where(eq(findingResources.findingId, findingId));

    let linkedResources: typeof findingData.linkedResources;
    if (linkedRows.length > 0) {
      const resourceIds = linkedRows.map((r) => r.resourceId);
      const allFields = await db
        .select({
          resourceId: resourceFields.resourceId,
          label: resourceFields.label,
          type: resourceFields.type,
          value: resourceFields.value,
        })
        .from(resourceFields)
        .where(inArray(resourceFields.resourceId, resourceIds));

      // Build a map of resource fields (exclude secrets and empty values)
      const fieldsByResource = new Map<string, { label: string; value: string }[]>();
      for (const f of allFields) {
        if (f.type === "secret" || !f.value) continue;
        const list = fieldsByResource.get(f.resourceId) ?? [];
        list.push({ label: f.label, value: f.value.slice(0, 2000) });
        fieldsByResource.set(f.resourceId, list);
      }

      linkedResources = linkedRows.map((r) => ({
        name: r.name,
        description: r.description,
        fields: fieldsByResource.get(r.resourceId) ?? [],
      }));
    }

    findingData = {
      ...finding,
      linkedResources,
    };
  } else {
    // New finding — use inline context from the form
    const ctx = context!;
    const resourceIds = (ctx.linkedResourceIds || []).slice(0, 50);

    let newLinkedResources: typeof findingData.linkedResources;
    if (resourceIds.length > 0) {
      const resRows = await db
        .select({ id: resources.id, name: resources.name, description: resources.description })
        .from(resources)
        .where(inArray(resources.id, resourceIds));

      if (resRows.length > 0) {
        const allFields = await db
          .select({
            resourceId: resourceFields.resourceId,
            label: resourceFields.label,
            type: resourceFields.type,
            value: resourceFields.value,
          })
          .from(resourceFields)
          .where(inArray(resourceFields.resourceId, resRows.map((r) => r.id)));

        const fieldsByResource = new Map<string, { label: string; value: string }[]>();
        for (const f of allFields) {
          if (f.type === "secret" || !f.value) continue;
          const list = fieldsByResource.get(f.resourceId) ?? [];
          list.push({ label: f.label, value: f.value.slice(0, 2000) });
          fieldsByResource.set(f.resourceId, list);
        }

        newLinkedResources = resRows.map((r) => ({
          name: r.name,
          description: r.description,
          fields: fieldsByResource.get(r.id) ?? [],
        }));
      }
    }

    findingData = {
      title: (ctx.title || "").slice(0, 500),
      severity: ctx.severity || "medium",
      cvssScore: ctx.cvssScore,
      cvssVector: null,
      overview: (ctx.overview || "").slice(0, 10000),
      overviewFormat: ctx.overviewFormat || "text",
      impact: (ctx.impact || "").slice(0, 10000) || null,
      impactFormat: ctx.impactFormat || "text",
      recommendation: (ctx.recommendation || "").slice(0, 10000) || null,
      recommendationFormat: ctx.recommendationFormat || "text",
      linkedResources: newLinkedResources,
    };
  }

  // Determine the format of the target field
  const fieldFormatKey = `${field}Format` as keyof typeof findingData;
  const fieldFormat = (findingData[fieldFormatKey] as string) || "text";

  const systemPrompt = buildFindingAssistPrompt(
    findingData,
    field as "overview" | "impact" | "recommendation",
    fieldFormat,
    cleanPrompt
  );

  const messages = [
    { role: "system" as const, content: systemPrompt },
    { role: "user" as const, content: cleanPrompt },
  ];

  // Stream response via SSE (no tools)
  const encoder = new TextEncoder();

  const stream = new ReadableStream({
    async start(controller) {
      let closed = false;
      function send(data: Record<string, unknown>) {
        if (closed) return;
        try {
          controller.enqueue(
            encoder.encode(`data: ${JSON.stringify(data)}\n\n`)
          );
        } catch {
          closed = true;
        }
      }

      try {
        const findingModel = await getFindingModel();
        send({ type: "meta", model: findingModel });
        const ollamaStream = await ollamaChat(messages, undefined, findingModel);

        for await (const chunk of parseOllamaStream(ollamaStream)) {
          if (chunk.message?.content) {
            send({ type: "token", content: chunk.message.content });
          }
        }

        send({ type: "done" });
        closed = true;
        controller.close();
      } catch (error) {
        if (!closed) {
          console.error("AI assist stream error:", error);
          send({
            type: "error",
            message:
              error instanceof Error
                ? error.message
                : "An error occurred",
          });
          closed = true;
          controller.close();
        }
      }
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache",
      Connection: "keep-alive",
    },
  });
}
