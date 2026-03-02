import Link from "next/link";

interface ScopeTarget {
  type: string;
  value: string;
}

interface ScopeOverviewProps {
  engagementId: string;
  targets: ScopeTarget[];
  exclusionCount: number;
  constraintCount: number;
  contactCount: number;
  documentCount: number;
}

const TARGET_TYPE_LABELS: Record<string, string> = {
  ip: "IPs",
  cidr: "CIDRs",
  domain: "Domains",
  url: "URLs",
  application: "Applications",
  network: "Networks",
};

const TARGET_TYPE_COLORS: Record<string, string> = {
  ip: "text-blue-400",
  cidr: "text-cyan-400",
  domain: "text-purple-400",
  url: "text-amber-400",
  application: "text-green-400",
  network: "text-red-400",
};

export function ScopeOverview({
  engagementId,
  targets,
  exclusionCount,
  constraintCount,
  contactCount,
  documentCount,
}: ScopeOverviewProps) {
  const hasScope = targets.length > 0 || exclusionCount > 0 || constraintCount > 0 || contactCount > 0 || documentCount > 0;

  // Group targets by type
  const grouped = new Map<string, string[]>();
  for (const t of targets) {
    const list = grouped.get(t.type);
    if (list) list.push(t.value);
    else grouped.set(t.type, [t.value]);
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <h3 className="text-[10px] font-mono font-medium text-text-secondary uppercase tracking-[0.15em]">
          Scope
        </h3>
        <Link
          href={`/engagements/${engagementId}/scope`}
          className="text-[10px] text-accent hover:text-accent-bright transition-colors duration-100"
        >
          View
        </Link>
      </div>

      {!hasScope ? (
        <p className="text-[11px] text-text-muted/50 text-center py-2">
          No scope defined
        </p>
      ) : (
        <div className="space-y-2.5">
          {/* In-scope targets listed by type */}
          {Array.from(grouped.entries()).map(([type, values]) => (
            <div key={type}>
              <span className={`text-[9px] font-medium uppercase tracking-wider ${TARGET_TYPE_COLORS[type] ?? "text-text-muted"}`}>
                {TARGET_TYPE_LABELS[type] ?? type}
              </span>
              <div className="mt-0.5 space-y-px">
                {values.map((value) => (
                  <div key={value} className="text-[11px] font-mono text-text-secondary truncate" title={value}>
                    {value}
                  </div>
                ))}
              </div>
            </div>
          ))}

          {/* Summary counts for other sections */}
          {(exclusionCount > 0 || constraintCount > 0 || contactCount > 0 || documentCount > 0) && (
            <div className="border-t border-border-default/50 pt-2 space-y-1">
              {exclusionCount > 0 && (
                <div className="flex items-center justify-between">
                  <span className="text-[10px] text-text-muted">Exclusions</span>
                  <span className="text-[10px] font-mono text-red-400 font-medium">
                    {exclusionCount}
                  </span>
                </div>
              )}
              {constraintCount > 0 && (
                <div className="flex items-center justify-between">
                  <span className="text-[10px] text-text-muted">Constraints</span>
                  <span className="text-[10px] font-mono text-amber-400 font-medium">
                    {constraintCount}
                  </span>
                </div>
              )}
              {contactCount > 0 && (
                <div className="flex items-center justify-between">
                  <span className="text-[10px] text-text-muted">Contacts</span>
                  <span className="text-[10px] font-mono text-text-secondary font-medium">
                    {contactCount}
                  </span>
                </div>
              )}
              {documentCount > 0 && (
                <div className="flex items-center justify-between">
                  <span className="text-[10px] text-text-muted">Documents</span>
                  <span className="text-[10px] font-mono text-text-secondary font-medium">
                    {documentCount}
                  </span>
                </div>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
