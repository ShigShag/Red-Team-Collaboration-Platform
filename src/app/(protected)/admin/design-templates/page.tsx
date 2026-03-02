import Link from "next/link";
import { redirect } from "next/navigation";
import { desc, eq } from "drizzle-orm";
import { db } from "@/db";
import { designTemplates } from "@/db/schema";
import { getSession } from "@/lib/auth/session";
import { TemplateList } from "./template-list";

export default async function DesignTemplatesPage() {
  const session = await getSession();
  if (!session || !session.isAdmin) redirect("/dashboard");

  const templates = await db
    .select({
      id: designTemplates.id,
      name: designTemplates.name,
      description: designTemplates.description,
      theme: designTemplates.theme,
      mdxSource: designTemplates.mdxSource,
      logoDiskPath: designTemplates.logoDiskPath,
      logoFilename: designTemplates.logoFilename,
      logoMimeType: designTemplates.logoMimeType,
      logoWidth: designTemplates.logoWidth,
      logoHeight: designTemplates.logoHeight,
      logoPosition: designTemplates.logoPosition,
      isSystem: designTemplates.isSystem,
      isDefault: designTemplates.isDefault,
      createdAt: designTemplates.createdAt,
    })
    .from(designTemplates)
    .orderBy(desc(designTemplates.isDefault), designTemplates.createdAt);

  return (
    <div className="min-h-screen bg-[#0d1117]">
      <div className="mx-auto max-w-5xl px-6 py-8">
        <Link
          href="/admin"
          className="mb-6 inline-flex items-center gap-1.5 text-sm text-neutral-400 hover:text-white transition-colors"
        >
          <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
          </svg>
          Admin
        </Link>

        <div className="mb-8 flex items-center justify-between">
          <div>
            <p className="text-xs font-semibold uppercase tracking-wider text-[#e8735a]">Administration</p>
            <h1 className="mt-1 text-2xl font-bold text-white">Design Templates</h1>
            <p className="mt-1 text-sm text-neutral-400">
              Customize report layout with MDX templates, colors, fonts, and logos.
            </p>
          </div>
        </div>

        <TemplateList templates={templates} />
      </div>
    </div>
  );
}
