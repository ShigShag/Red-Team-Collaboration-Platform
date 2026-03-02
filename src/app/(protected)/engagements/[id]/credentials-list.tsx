"use client";

import { useState } from "react";
import Link from "next/link";
import { SecretField } from "@/app/(protected)/components/secret-field";

interface FieldEntry {
  fieldId: string;
  fieldLabel: string;
  fieldType: string;
  value: string | null;
  hasValue: boolean;
}

interface CredentialResource {
  resourceId: string;
  resourceName: string;
  fields: FieldEntry[];
}

interface CategoryPathSegment {
  id: string;
  name: string;
  icon: string;
  color: string | null;
}

interface CredentialCategory {
  categoryId: string;
  categoryPath: CategoryPathSegment[];
  resources: CredentialResource[];
}

interface CredentialsListProps {
  categories: CredentialCategory[];
  engagementId: string;
  defaultExpanded?: boolean;
}

export function CredentialsList({ categories, engagementId, defaultExpanded = false }: CredentialsListProps) {
  const [isExpanded, setIsExpanded] = useState(defaultExpanded);

  const totalResources = categories.reduce(
    (sum, cat) => sum + cat.resources.length, 0
  );

  return (
    <div>
      {/* Section header */}
      <button
        type="button"
        onClick={() => setIsExpanded(!isExpanded)}
        className="flex items-center gap-2 mb-4 w-full group"
      >
        <div className="h-px w-8 bg-accent/50" />
        <span className="text-[10px] font-medium text-accent tracking-[0.2em] uppercase">
          Credentials
        </span>
        {totalResources > 0 && (
          <span className="text-[10px] font-medium text-text-muted bg-bg-elevated px-1.5 py-0.5 rounded-full">
            {totalResources}
          </span>
        )}
        <div className="h-px flex-1 bg-border-subtle" />
        <svg
          className={`w-3.5 h-3.5 text-text-muted transition-transform duration-150 ${
            isExpanded ? "rotate-180" : ""
          }`}
          fill="none"
          viewBox="0 0 24 24"
          strokeWidth={1.5}
          stroke="currentColor"
        >
          <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 8.25l-7.5 7.5-7.5-7.5" />
        </svg>
      </button>

      {isExpanded && (
        <>
          {totalResources === 0 ? (
            <div className="border border-border-subtle border-dashed rounded-lg p-4 text-center">
              <p className="text-xs text-text-muted">No credentials in this engagement</p>
              <p className="text-[10px] text-text-muted/60 mt-0.5">
                Credentials appear here when you add resources with secret-type fields
              </p>
            </div>
          ) : (
            <div className="space-y-4">
              {categories.map((cat) => (
                <div key={cat.categoryId}>
                  {/* Category breadcrumb path */}
                  <div className="flex items-center gap-1 mb-2">
                    {cat.categoryPath.map((seg, i) => (
                      <span key={seg.id} className="flex items-center gap-1">
                        {i > 0 && (
                          <svg className="w-3 h-3 text-text-muted/40 shrink-0" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" d="M8.25 4.5l7.5 7.5-7.5 7.5" />
                          </svg>
                        )}
                        <span
                          className="text-sm shrink-0"
                          style={seg.color ? { filter: `drop-shadow(0 0 4px ${seg.color})` } : undefined}
                        >
                          {seg.icon}
                        </span>
                        <Link
                          href={`/engagements/${engagementId}/categories/${seg.id}`}
                          className="text-xs font-medium text-text-secondary hover:text-text-primary transition-colors duration-100"
                        >
                          {seg.name}
                        </Link>
                      </span>
                    ))}
                  </div>

                  {/* Resources within category */}
                  <div className="ml-6 space-y-2">
                    {cat.resources.map((res) => (
                      <div
                        key={res.resourceId}
                        className="bg-bg-surface/60 border border-border-subtle rounded p-3"
                      >
                        <div className="text-[11px] font-medium text-text-primary mb-1.5">
                          {res.resourceName}
                        </div>
                        <div className="space-y-1">
                          {res.fields.map((field) => (
                            <div
                              key={field.fieldId}
                              className="flex items-center justify-between gap-4"
                            >
                              <span className="text-[11px] text-text-muted shrink-0">
                                {field.fieldLabel}
                              </span>
                              {field.fieldType === "secret" ? (
                                <SecretField
                                  fieldId={field.fieldId}
                                  engagementId={engagementId}
                                  hasValue={field.hasValue}
                                />
                              ) : field.fieldType === "url" && field.value ? (
                                <a
                                  href={field.value}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="font-mono text-[11px] text-accent hover:underline truncate max-w-[200px]"
                                >
                                  {field.value}
                                </a>
                              ) : (
                                <span className={`font-mono text-[11px] truncate max-w-[200px] ${field.value ? "text-text-secondary" : "text-text-muted/50 italic"}`}>
                                  {field.value || "empty"}
                                </span>
                              )}
                            </div>
                          ))}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          )}
        </>
      )}
    </div>
  );
}
