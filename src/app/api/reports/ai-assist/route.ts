import { NextRequest, NextResponse } from "next/server";
import { eq, and } from "drizzle-orm";
import { db } from "@/db";
import { engagementMembers } from "@/db/schema";
import { getSession } from "@/lib/auth/session";
import { ollamaChatSync, isOllamaConfigured } from "@/lib/ai/ollama-client";

const FIELD_PROMPTS: Record<string, string> = {
  summary_overview:
    "Write a professional 2-3 sentence engagement overview paragraph for a penetration test report. Mention who performed the test, for whom, what type of testing was done, and the testing period. Use formal, third-person tone.",
  summary_objective:
    "Write a 2-3 sentence paragraph describing the primary objective of the penetration test. Mention evaluating security controls, identifying vulnerabilities, and providing remediation guidance.",
  summary_narrative:
    "Write a 3-4 sentence key findings narrative for the executive summary. Summarize the overall security posture, the most critical findings, and the risk level. Use bold markdown for emphasis on the risk level.",
  summary_detail:
    "Write a 2-3 sentence detailed discussion of the most significant vulnerabilities found. Reference specific finding types and their potential business impact.",
  summary_conclusion:
    "Write a 2-3 sentence conclusion paragraph recommending immediate remediation of critical and high-severity findings. Mention the demonstrated attack chain.",
  methodology:
    "Write a methodology notes paragraph for a penetration test report. Reference industry standards like OWASP Testing Guide v4.2, NIST SP 800-115, PTES, and CVSS v3.1 scoring. Keep it to 2-3 sentences.",
  recommendations:
    'Generate 3-5 strategic security recommendations based on the findings. Return a JSON array where each item has: title (short action), rationale (why it matters), effort (Low/Medium/High). Return ONLY the JSON array, no other text.',
};

export async function POST(request: NextRequest) {
  const session = await getSession();
  if (!session) {
    return new NextResponse(null, { status: 401 });
  }

  const configured = await isOllamaConfigured();
  if (!configured) {
    return NextResponse.json(
      { error: "AI assistant is not configured. Set up Ollama in platform settings." },
      { status: 503 }
    );
  }

  let body: {
    engagementId: string;
    fieldType: string;
    context: Record<string, unknown>;
  };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json(
      { error: "Invalid JSON body" },
      { status: 400 }
    );
  }

  const { engagementId, fieldType, context } = body;

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
    return new NextResponse(null, { status: 403 });
  }

  const systemPrompt = FIELD_PROMPTS[fieldType];
  if (!systemPrompt) {
    return NextResponse.json(
      { error: `Unknown field type: ${fieldType}` },
      { status: 400 }
    );
  }

  // Build context string
  const contextParts: string[] = [];
  if (context.engagementName)
    contextParts.push(`Engagement: ${context.engagementName}`);
  if (context.clientName)
    contextParts.push(`Client: ${context.clientName}`);
  if (context.engagementType)
    contextParts.push(`Type: ${context.engagementType}`);
  if (context.findingsCount)
    contextParts.push(`Total findings: ${context.findingsCount}`);
  if (context.findingsSeverityBreakdown) {
    const breakdown = context.findingsSeverityBreakdown as Record<
      string,
      number
    >;
    const parts = Object.entries(breakdown)
      .filter(([, count]) => count > 0)
      .map(([sev, count]) => `${count} ${sev}`)
      .join(", ");
    if (parts) contextParts.push(`Severity breakdown: ${parts}`);
  }
  if (
    context.findingTitles &&
    Array.isArray(context.findingTitles) &&
    context.findingTitles.length > 0
  ) {
    contextParts.push(
      `Finding titles: ${(context.findingTitles as string[]).join("; ")}`
    );
  }

  try {
    const result = await ollamaChatSync([
      {
        role: "system",
        content: `You are a senior penetration test report writer. ${systemPrompt}`,
      },
      {
        role: "user",
        content: `Context:\n${contextParts.join("\n")}\n\nGenerate the content now.`,
      },
    ]);

    return NextResponse.json({ content: result.content });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "AI generation failed";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
