import { eq } from "drizzle-orm";
import { redirect } from "next/navigation";
import { db } from "@/db";
import { engagements } from "@/db/schema";
import { getSession } from "@/lib/auth/session";
import { getEffectiveAccess } from "@/lib/engagement-access";
import { getSetting } from "@/lib/platform-settings";
import { ChatFab } from "../../components/ai-chat/chat-fab";

interface Props {
  children: React.ReactNode;
  params: Promise<{ id: string }>;
}

export default async function EngagementLayout({ children, params }: Props) {
  const { id: engagementId } = await params;
  const session = await getSession();
  if (!session) redirect("/login");

  // Check if AI assistant is configured
  const ollamaUrl = await getSetting("ollama_base_url");
  const ollamaModel = await getSetting("ollama_model");
  const aiEnabled = ollamaUrl.length > 0;

  let engagementName = "";
  if (aiEnabled) {
    // Only query engagement name if AI is enabled
    const access = await getEffectiveAccess(engagementId, session.userId, session.isCoordinator);
    if (access) {
      const [eng] = await db
        .select({ name: engagements.name })
        .from(engagements)
        .where(eq(engagements.id, engagementId))
        .limit(1);
      engagementName = eng?.name ?? "Engagement";
    }
  }

  return (
    <>
      {children}
      {aiEnabled && engagementName && (
        <ChatFab
          engagementId={engagementId}
          engagementName={engagementName}
          modelName={ollamaModel}
        />
      )}
    </>
  );
}
