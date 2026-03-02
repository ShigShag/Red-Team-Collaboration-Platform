"use client";

import { useActionState, startTransition } from "react";
import { deleteGeneratedReport, type ReportState } from "./actions";

interface Report {
  id: string;
  format: string;
  status: string;
  fileSize: number | null;
  errorMessage: string | null;
  generatedAt: string;
  generatedByUsername: string;
  generatedByDisplayName: string | null;
}

interface Props {
  engagementId: string;
  reports: Report[];
  canDelete: boolean;
}

function formatFileSize(bytes: number | null): string {
  if (!bytes) return "—";
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function formatRelativeTime(isoStr: string): string {
  const now = Date.now();
  const then = new Date(isoStr).getTime();
  const diffMs = now - then;
  const diffMin = Math.floor(diffMs / 60000);
  if (diffMin < 1) return "just now";
  if (diffMin < 60) return `${diffMin}m ago`;
  const diffHr = Math.floor(diffMin / 60);
  if (diffHr < 24) return `${diffHr}h ago`;
  const diffDay = Math.floor(diffHr / 24);
  if (diffDay < 7) return `${diffDay}d ago`;
  return new Date(isoStr).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
  });
}

export function ReportHistory({ engagementId, reports, canDelete }: Props) {
  const [deleteState, deleteAction] = useActionState<ReportState, FormData>(
    deleteGeneratedReport,
    {}
  );

  if (reports.length === 0) {
    return (
      <div className="bg-bg-surface/80 border border-border-default rounded-lg p-6">
        <h3 className="text-sm font-semibold text-text-primary mb-1">Generated Reports</h3>
        <p className="text-xs text-text-muted">No reports have been generated yet.</p>
      </div>
    );
  }

  return (
    <div className="bg-bg-surface/80 border border-border-default rounded-lg overflow-hidden">
      <div className="px-4 py-3 border-b border-border-default">
        <h3 className="text-sm font-semibold text-text-primary">Generated Reports</h3>
      </div>

      {deleteState.error && (
        <div className="mx-4 mt-3 bg-red-500/10 border border-red-500/30 text-red-400 text-xs px-3 py-2 rounded">
          {deleteState.error}
        </div>
      )}

      <div className="divide-y divide-border-default">
        {reports.map((report) => (
          <div key={report.id} className="flex items-center gap-4 px-4 py-3">
            {/* Format icon */}
            <div
              className={`flex items-center justify-center w-8 h-8 rounded text-xs font-bold ${
                report.format === "pdf"
                  ? "bg-red-500/10 text-red-400 border border-red-500/20"
                  : "bg-blue-500/10 text-blue-400 border border-blue-500/20"
              }`}
            >
              {report.format.toUpperCase()}
            </div>

            {/* Info */}
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2">
                <span className="text-sm text-text-primary">
                  {report.generatedByDisplayName ?? report.generatedByUsername}
                </span>
                <span
                  className={`inline-flex items-center px-1.5 py-0.5 text-[10px] font-medium rounded ${
                    report.status === "completed"
                      ? "bg-emerald-500/10 text-emerald-400"
                      : report.status === "failed"
                        ? "bg-red-500/10 text-red-400"
                        : "bg-yellow-500/10 text-yellow-400"
                  }`}
                >
                  {report.status}
                </span>
              </div>
              <div className="text-xs text-text-muted">
                {formatRelativeTime(report.generatedAt)}
                {report.fileSize ? ` · ${formatFileSize(report.fileSize)}` : ""}
              </div>
              {report.errorMessage && (
                <div className="text-xs text-red-400 mt-1 truncate">
                  {report.errorMessage}
                </div>
              )}
            </div>

            {/* Actions */}
            <div className="flex items-center gap-2">
              {report.status === "completed" && (
                <a
                  href={`/api/reports/${report.id}`}
                  download
                  className="inline-flex items-center gap-1 px-2.5 py-1.5 text-xs text-accent border border-accent/30 rounded hover:bg-accent/10 transition-colors"
                >
                  <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M3 16.5v2.25A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75V16.5M16.5 12L12 16.5m0 0L7.5 12m4.5 4.5V3" />
                  </svg>
                  Download
                </a>
              )}
              {canDelete && (
                <button
                  type="button"
                  onClick={() => {
                    const fd = new FormData();
                    fd.set("engagementId", engagementId);
                    fd.set("reportId", report.id);
                    startTransition(() => deleteAction(fd));
                  }}
                  className="p-1.5 text-text-muted hover:text-red-400 transition-colors"
                  title="Delete report"
                >
                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M14.74 9l-.346 9m-4.788 0L9.26 9m9.968-3.21c.342.052.682.107 1.022.166m-1.022-.165L18.16 19.673a2.25 2.25 0 01-2.244 2.077H8.084a2.25 2.25 0 01-2.244-2.077L4.772 5.79m14.456 0a48.108 48.108 0 00-3.478-.397m-12 .562c.34-.059.68-.114 1.022-.165m0 0a48.11 48.11 0 013.478-.397m7.5 0v-.916c0-1.18-.91-2.164-2.09-2.201a51.964 51.964 0 00-3.32 0c-1.18.037-2.09 1.022-2.09 2.201v.916m7.5 0a48.667 48.667 0 00-7.5 0" />
                  </svg>
                </button>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
