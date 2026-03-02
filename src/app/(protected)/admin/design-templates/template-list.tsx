"use client";

import { useState, useActionState } from "react";
import { TemplateEditor } from "./template-editor";
import {
  createDesignTemplate,
  updateDesignTemplate,
  deleteDesignTemplate,
  duplicateDesignTemplate,
  setDefaultTemplate,
  type DesignTemplateState,
} from "./actions";
import { DEFAULT_THEME } from "@/lib/report-theme";
// MDX templates removed — report generation now uses the Python engine.
const REFERENCE_MDX_TEMPLATE = "";

interface TemplateRow {
  id: string;
  name: string;
  description: string | null;
  theme: unknown;
  mdxSource: string | null;
  logoDiskPath: string | null;
  logoFilename: string | null;
  logoMimeType: string | null;
  logoWidth: number | null;
  logoHeight: number | null;
  logoPosition: string | null;
  isSystem: boolean;
  isDefault: boolean;
  createdAt: Date;
}

export function TemplateList({ templates }: { templates: TemplateRow[] }) {
  const [editing, setEditing] = useState<TemplateRow | "new" | null>(null);
  const [deleteState, deleteAction, deletePending] = useActionState(deleteDesignTemplate, {});
  const [dupState, dupAction, dupPending] = useActionState(duplicateDesignTemplate, {});
  const [defaultState, defaultAction, defaultPending] = useActionState(setDefaultTemplate, {});

  if (editing) {
    return (
      <TemplateEditor
        template={editing === "new" ? null : editing}
        onClose={() => setEditing(null)}
      />
    );
  }

  return (
    <div>
      {/* Status messages */}
      {(deleteState.success || dupState.success || defaultState.success) && (
        <div className="mb-4 rounded-lg border border-green-800/40 bg-green-900/20 px-4 py-3 text-sm text-green-400">
          {deleteState.success || dupState.success || defaultState.success}
        </div>
      )}
      {(deleteState.error || dupState.error || defaultState.error) && (
        <div className="mb-4 rounded-lg border border-red-800/40 bg-red-900/20 px-4 py-3 text-sm text-red-400">
          {deleteState.error || dupState.error || defaultState.error}
        </div>
      )}

      <div className="mb-6 flex items-center gap-3">
        <button
          onClick={() => setEditing("new")}
          className="rounded-lg bg-[#e8735a] px-4 py-2.5 text-sm font-medium text-white hover:bg-[#d4654e] transition-colors"
        >
          Create Template
        </button>
        <button
          onClick={() => {
            const blob = new Blob([REFERENCE_MDX_TEMPLATE], { type: "text/plain" });
            const url = URL.createObjectURL(blob);
            const a = document.createElement("a");
            a.href = url;
            a.download = "report-template-reference.mdx";
            a.click();
            URL.revokeObjectURL(url);
          }}
          className="rounded-lg border border-neutral-700 bg-neutral-800 px-4 py-2.5 text-sm font-medium text-neutral-300 hover:border-neutral-600 hover:text-white transition-colors"
        >
          Download Reference Template
        </button>
      </div>

      <div className="grid gap-4">
        {templates.map((t) => {
          const theme = t.theme as Record<string, unknown>;
          const colors = (theme?.colors ?? {}) as Record<string, string>;

          return (
            <div
              key={t.id}
              className="rounded-xl border border-neutral-800 bg-[#161b24] p-5 hover:border-neutral-700 transition-colors"
            >
              <div className="flex items-start justify-between gap-4">
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <h3 className="text-base font-semibold text-white truncate">{t.name}</h3>
                    {t.isDefault && (
                      <span className="shrink-0 rounded bg-[#e8735a]/20 px-2 py-0.5 text-xs font-medium text-[#e8735a]">
                        Default
                      </span>
                    )}
                    {t.isSystem && (
                      <span className="shrink-0 rounded bg-neutral-700/50 px-2 py-0.5 text-xs font-medium text-neutral-400">
                        System
                      </span>
                    )}
                    {t.mdxSource && (
                      <span className="shrink-0 rounded bg-blue-900/30 px-2 py-0.5 text-xs font-medium text-blue-400">
                        MDX
                      </span>
                    )}
                  </div>
                  {t.description && (
                    <p className="mt-1 text-sm text-neutral-400 line-clamp-2">{t.description}</p>
                  )}

                  {/* Color swatches */}
                  <div className="mt-3 flex items-center gap-1.5">
                    {["accent", "primary", "surface", "textPrimary", "tableHeaderBg", "linkColor"].map((key) => (
                      <div
                        key={key}
                        className="h-5 w-5 rounded border border-neutral-700"
                        style={{ backgroundColor: colors[key] || "#333" }}
                        title={key}
                      />
                    ))}
                    {t.logoDiskPath && (
                      <span className="ml-2 text-xs text-neutral-500">+ logo</span>
                    )}
                  </div>
                </div>

                <div className="flex shrink-0 items-center gap-2">
                  {!t.isSystem && (
                    <button
                      onClick={() => setEditing(t)}
                      className="rounded-lg border border-neutral-700 bg-neutral-800 px-3 py-1.5 text-xs font-medium text-neutral-300 hover:border-neutral-600 hover:text-white transition-colors"
                    >
                      Edit
                    </button>
                  )}

                  <form action={dupAction}>
                    <input type="hidden" name="templateId" value={t.id} />
                    <button
                      type="submit"
                      disabled={dupPending}
                      className="rounded-lg border border-neutral-700 bg-neutral-800 px-3 py-1.5 text-xs font-medium text-neutral-300 hover:border-neutral-600 hover:text-white transition-colors disabled:opacity-50"
                    >
                      Duplicate
                    </button>
                  </form>

                  {!t.isDefault && (
                    <form action={defaultAction}>
                      <input type="hidden" name="templateId" value={t.id} />
                      <button
                        type="submit"
                        disabled={defaultPending}
                        className="rounded-lg border border-neutral-700 bg-neutral-800 px-3 py-1.5 text-xs font-medium text-neutral-300 hover:border-neutral-600 hover:text-white transition-colors disabled:opacity-50"
                      >
                        Set Default
                      </button>
                    </form>
                  )}

                  {!t.isSystem && (
                    <form
                      action={deleteAction}
                      onSubmit={(e) => {
                        if (!confirm(`Delete template "${t.name}"?`)) {
                          e.preventDefault();
                        }
                      }}
                    >
                      <input type="hidden" name="templateId" value={t.id} />
                      <button
                        type="submit"
                        disabled={deletePending}
                        className="rounded-lg border border-red-900/40 bg-red-900/20 px-3 py-1.5 text-xs font-medium text-red-400 hover:bg-red-900/30 transition-colors disabled:opacity-50"
                      >
                        Delete
                      </button>
                    </form>
                  )}
                </div>
              </div>
            </div>
          );
        })}

        {templates.length === 0 && (
          <div className="rounded-xl border border-neutral-800 bg-[#161b24] p-8 text-center">
            <p className="text-neutral-400">No design templates yet. Create one to get started.</p>
          </div>
        )}
      </div>
    </div>
  );
}
