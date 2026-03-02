"use client";

import { useState, useActionState, useRef, useEffect, useCallback, useMemo } from "react";
import { createPortal } from "react-dom";
import { assignCountry, type IpActionState } from "../ip-actions";
import { Modal } from "@/app/(protected)/components/modal";
import { GlobeCard } from "@/app/(protected)/components/globe-card";
import { COUNTRIES } from "@/lib/country-coordinates";
import { getUserColor } from "@/lib/user-colors";
import type { ScopeStatus } from "@/lib/scope-validator";

interface Contributor {
  id: string;
  username: string;
  displayName: string | null;
  hasAvatar: boolean;
}

interface MemberInfo {
  userId: string;
  username: string;
  displayName: string | null;
  hasAvatar: boolean;
}

interface Source {
  sourceType: "resource" | "action" | "finding";
  sourceId: string;
  title: string;
  categoryId: string;
}

interface IpEntry {
  id: string;
  ip: string;
  countryCode: string | null;
  countryName: string | null;
  isManual: boolean;
  isPrivate: boolean;
  createdAt: string;
  sources: Source[];
  domains: string[];
  contributors: Contributor[];
}

interface IpTableProps {
  entries: IpEntry[];
  engagementId: string;
  canWrite: boolean;
  members: MemberInfo[];
  scopeMap: Record<string, ScopeStatus>;
}

export function IpTable({ entries, engagementId, canWrite, members, scopeMap }: IpTableProps) {
  const [assignTarget, setAssignTarget] = useState<IpEntry | null>(null);
  const [showGlobe, setShowGlobe] = useState(false);

  const memberIds = useMemo(() => members.map((m) => m.userId), [members]);

  if (entries.length === 0) {
    return (
      <div className="bg-bg-surface/80 border border-border-default rounded-lg p-8 text-center">
        <svg
          className="w-8 h-8 text-text-muted/30 mx-auto mb-2"
          fill="none"
          viewBox="0 0 24 24"
          strokeWidth={1}
          stroke="currentColor"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            d="M12 21a9.004 9.004 0 008.716-6.747M12 21a9.004 9.004 0 01-8.716-6.747M12 21c2.485 0 4.5-4.03 4.5-9S14.485 3 12 3m0 18c-2.485 0-4.5-4.03-4.5-9S9.515 3 12 3m0 0a8.997 8.997 0 017.843 4.582M12 3a8.997 8.997 0 00-7.843 4.582m15.686 0A11.953 11.953 0 0112 10.5c-2.998 0-5.74-1.1-7.843-2.918m15.686 0A8.959 8.959 0 0121 12c0 .778-.099 1.533-.284 2.253m0 0A17.919 17.919 0 0112 16.5c-3.162 0-6.133-.815-8.716-2.247m0 0A9.015 9.015 0 013 12c0-1.605.42-3.113 1.157-4.418"
          />
        </svg>
        <p className="text-sm text-text-muted">No IP addresses found yet</p>
        <p className="text-[10px] text-text-muted/50 mt-1">
          Add resources or actions containing IPv4 addresses to see them here
        </p>
      </div>
    );
  }

  const resolvedCount = entries.filter((e) => e.countryCode).length;
  const unresolvedCount = entries.length - resolvedCount;
  const privateCount = entries.filter((e) => e.isPrivate).length;
  const inScopeCount = entries.filter((e) => scopeMap[e.id] === "in_scope").length;
  const outOfScopeCount = entries.filter((e) => scopeMap[e.id] === "out_of_scope" || scopeMap[e.id] === "excluded").length;

  return (
    <>
      {/* Stats bar + Globe button */}
      <div className="flex items-center justify-between mb-4">
      <div className="flex items-center gap-4">
        <span className="text-[10px] text-text-muted">
          <span className="font-mono text-text-primary font-medium">
            {entries.length}
          </span>{" "}
          total
        </span>
        <span className="text-[10px] text-text-muted">
          <span className="font-mono text-accent font-medium">
            {resolvedCount}
          </span>{" "}
          resolved
        </span>
        {unresolvedCount > 0 && (
          <span className="text-[10px] text-text-muted">
            <span className="font-mono text-amber-400 font-medium">
              {unresolvedCount}
            </span>{" "}
            unresolved
          </span>
        )}
        {privateCount > 0 && (
          <span className="text-[10px] text-text-muted">
            <span className="font-mono text-blue-400 font-medium">
              {privateCount}
            </span>{" "}
            private
          </span>
        )}
        {inScopeCount > 0 && (
          <span className="text-[10px] text-text-muted">
            <span className="font-mono text-green-400 font-medium">
              {inScopeCount}
            </span>{" "}
            in scope
          </span>
        )}
        {outOfScopeCount > 0 && (
          <span className="text-[10px] text-text-muted">
            <span className="font-mono text-red-400 font-medium">
              {outOfScopeCount}
            </span>{" "}
            out of scope
          </span>
        )}
      </div>

      {resolvedCount > 0 && (
        <button
          onClick={() => setShowGlobe(true)}
          className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-accent hover:text-accent-bright border border-accent/30 hover:border-accent/60 rounded transition-all duration-100 hover:bg-accent/5"
        >
          <svg
            className="w-4 h-4"
            fill="none"
            viewBox="0 0 24 24"
            strokeWidth={1.5}
            stroke="currentColor"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              d="M12 21a9.004 9.004 0 008.716-6.747M12 21a9.004 9.004 0 01-8.716-6.747M12 21c2.485 0 4.5-4.03 4.5-9S14.485 3 12 3m0 18c-2.485 0-4.5-4.03-4.5-9S9.515 3 12 3m0 0a8.997 8.997 0 017.843 4.582M12 3a8.997 8.997 0 00-7.843 4.582m15.686 0A11.953 11.953 0 0112 10.5c-2.998 0-5.74-1.1-7.843-2.918m15.686 0A8.959 8.959 0 0121 12c0 .778-.099 1.533-.284 2.253m0 0A17.919 17.919 0 0112 16.5c-3.162 0-6.133-.815-8.716-2.247m0 0A9.015 9.015 0 013 12c0-1.605.42-3.113 1.157-4.418"
            />
          </svg>
          Operations Globe
        </button>
      )}
      </div>

      {/* Table */}
      <div className="bg-bg-surface/80 border border-border-default rounded-lg overflow-hidden">
        <div className="absolute top-0 left-5 right-5 h-px bg-gradient-to-r from-transparent via-border-default to-transparent" />

        <table className="w-full">
          <thead>
            <tr className="border-b border-border-default">
              <th className="text-left text-[10px] font-medium text-text-muted uppercase tracking-wider px-4 py-2.5">
                IP Address
              </th>
              <th className="text-left text-[10px] font-medium text-text-muted uppercase tracking-wider px-4 py-2.5">
                Domain
              </th>
              <th className="text-left text-[10px] font-medium text-text-muted uppercase tracking-wider px-4 py-2.5">
                Country
              </th>
              <th className="text-left text-[10px] font-medium text-text-muted uppercase tracking-wider px-4 py-2.5">
                Status
              </th>
              <th className="text-left text-[10px] font-medium text-text-muted uppercase tracking-wider px-4 py-2.5">
                Scope
              </th>
              <th className="text-left text-[10px] font-medium text-text-muted uppercase tracking-wider px-4 py-2.5">
                Contributors
              </th>
              <th className="text-left text-[10px] font-medium text-text-muted uppercase tracking-wider px-4 py-2.5">
                Sources
              </th>
              {canWrite && (
                <th className="text-right text-[10px] font-medium text-text-muted uppercase tracking-wider px-4 py-2.5">
                  Actions
                </th>
              )}
            </tr>
          </thead>
          <tbody>
            {entries.map((entry) => (
              <tr
                key={entry.id}
                className="border-b border-border-default/50 last:border-0 hover:bg-bg-elevated/30 transition-colors duration-75"
              >
                <td className="px-4 py-2.5">
                  <span className="text-sm font-mono text-text-primary">
                    {entry.ip}
                  </span>
                </td>
                <td className="px-4 py-2.5">
                  {entry.domains.length > 0 ? (
                    <div className="flex flex-col gap-0.5">
                      {entry.domains.map((d) => (
                        <span
                          key={d}
                          className="text-xs font-mono text-text-secondary"
                        >
                          {d}
                        </span>
                      ))}
                    </div>
                  ) : (
                    <span className="text-xs text-text-muted/40">—</span>
                  )}
                </td>
                <td className="px-4 py-2.5">
                  {entry.countryCode ? (
                    <span className="text-sm text-text-secondary">
                      <span className="font-mono text-text-muted text-xs mr-1.5">
                        {entry.countryCode}
                      </span>
                      {entry.countryName}
                    </span>
                  ) : (
                    <span className="text-sm text-text-muted italic">
                      Unknown
                    </span>
                  )}
                </td>
                <td className="px-4 py-2.5">
                  <StatusBadge entry={entry} />
                </td>
                <td className="px-4 py-2.5">
                  <ScopeBadge status={scopeMap[entry.id] ?? "unknown"} />
                </td>
                <td className="px-4 py-2.5">
                  <ContributorAvatars
                    contributors={entry.contributors}
                    memberIds={memberIds}
                  />
                </td>
                <td className="px-4 py-2.5">
                  <SourceLinks
                    sources={entry.sources}
                    engagementId={engagementId}
                  />
                </td>
                {canWrite && (
                  <td className="px-4 py-2.5 text-right">
                    {(!entry.countryCode || entry.isPrivate || entry.isManual) && (
                      <button
                        onClick={() => setAssignTarget(entry)}
                        className="text-[10px] font-medium text-accent hover:text-accent-bright transition-colors duration-100"
                      >
                        {entry.countryCode ? "Reassign" : "Assign Country"}
                      </button>
                    )}
                  </td>
                )}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Assign country modal */}
      {assignTarget && (
        <AssignCountryModal
          entry={assignTarget}
          engagementId={engagementId}
          onClose={() => setAssignTarget(null)}
        />
      )}

      {/* Globe modal */}
      {showGlobe && (
        <GlobeModal
          engagementId={engagementId}
          members={members}
          onClose={() => setShowGlobe(false)}
        />
      )}
    </>
  );
}

function ContributorAvatars({
  contributors,
  memberIds,
}: {
  contributors: Contributor[];
  memberIds: string[];
}) {
  if (contributors.length === 0) {
    return <span className="text-xs text-text-muted/40">—</span>;
  }

  return (
    <div className="flex items-center -space-x-1.5">
      {contributors.slice(0, 4).map((c) => {
        const name = c.displayName || c.username;
        const color = getUserColor(c.id, memberIds);
        return c.hasAvatar ? (
          <img
            key={c.id}
            src={`/api/avatar/${c.id}`}
            alt={name}
            title={name}
            className="w-5 h-5 rounded-full object-cover border border-bg-surface"
          />
        ) : (
          <div
            key={c.id}
            title={name}
            className="w-5 h-5 rounded-full flex items-center justify-center border"
            style={{
              backgroundColor: `${color}20`,
              borderColor: `${color}40`,
            }}
          >
            <span className="text-[8px] font-medium" style={{ color }}>
              {name[0]?.toUpperCase() ?? "?"}
            </span>
          </div>
        );
      })}
      {contributors.length > 4 && (
        <div className="w-5 h-5 rounded-full bg-bg-elevated border border-border-default flex items-center justify-center">
          <span className="text-[8px] text-text-muted">
            +{contributors.length - 4}
          </span>
        </div>
      )}
    </div>
  );
}

const SOURCE_TYPE_CONFIG = {
  resource: { label: "R", color: "text-blue-400 bg-blue-400/10 border-blue-400/20" },
  action: { label: "A", color: "text-amber-400 bg-amber-400/10 border-amber-400/20" },
  finding: { label: "F", color: "text-red-400 bg-red-400/10 border-red-400/20" },
} as const;

function SourceLinks({
  sources,
  engagementId,
}: {
  sources: Source[];
  engagementId: string;
}) {
  if (sources.length === 0) {
    return <span className="text-xs text-text-muted/40">—</span>;
  }

  return (
    <div className="flex flex-col gap-0.5">
      {sources.map((s) => {
        const config = SOURCE_TYPE_CONFIG[s.sourceType];
        return (
          <a
            key={`${s.sourceType}-${s.sourceId}`}
            href={`/engagements/${engagementId}/categories/${s.categoryId}`}
            className="inline-flex items-center gap-1.5 group max-w-[200px]"
          >
            <span
              className={`shrink-0 text-[9px] font-bold w-3.5 h-3.5 rounded flex items-center justify-center border ${config.color}`}
            >
              {config.label}
            </span>
            <span className="text-xs text-text-muted group-hover:text-text-secondary transition-colors duration-100 truncate">
              {s.title}
            </span>
          </a>
        );
      })}
    </div>
  );
}

function StatusBadge({ entry }: { entry: IpEntry }) {
  if (entry.isPrivate && !entry.countryCode) {
    return (
      <span className="inline-flex items-center gap-1 text-[10px] font-medium text-blue-400">
        <span className="w-1.5 h-1.5 rounded-full bg-blue-400" />
        Private
      </span>
    );
  }
  if (entry.isPrivate && entry.countryCode) {
    return (
      <span className="inline-flex items-center gap-1 text-[10px] font-medium text-blue-400">
        <span className="w-1.5 h-1.5 rounded-full bg-blue-400" />
        Private (manual)
      </span>
    );
  }
  if (entry.isManual) {
    return (
      <span className="inline-flex items-center gap-1 text-[10px] font-medium text-amber-400">
        <span className="w-1.5 h-1.5 rounded-full bg-amber-400" />
        Manual
      </span>
    );
  }
  if (entry.countryCode) {
    return (
      <span className="inline-flex items-center gap-1 text-[10px] font-medium text-green-400">
        <span className="w-1.5 h-1.5 rounded-full bg-green-400" />
        Resolved
      </span>
    );
  }
  return (
    <span className="inline-flex items-center gap-1 text-[10px] font-medium text-amber-400">
      <span className="w-1.5 h-1.5 rounded-full bg-amber-400" />
      Unknown
    </span>
  );
}

const SCOPE_CONFIG: Record<ScopeStatus, { label: string; dotColor: string; textColor: string }> = {
  in_scope: { label: "In Scope", dotColor: "bg-green-400", textColor: "text-green-400" },
  out_of_scope: { label: "Out of Scope", dotColor: "bg-red-400", textColor: "text-red-400" },
  excluded: { label: "Excluded", dotColor: "bg-amber-400", textColor: "text-amber-400" },
  unknown: { label: "No Scope", dotColor: "bg-text-muted/30", textColor: "text-text-muted/50" },
};

function ScopeBadge({ status }: { status: ScopeStatus }) {
  const cfg = SCOPE_CONFIG[status];
  return (
    <span className={`inline-flex items-center gap-1 text-[10px] font-medium ${cfg.textColor}`}>
      <span className={`w-1.5 h-1.5 rounded-full ${cfg.dotColor}`} />
      {cfg.label}
    </span>
  );
}

function AssignCountryModal({
  entry,
  engagementId,
  onClose,
}: {
  entry: IpEntry;
  engagementId: string;
  onClose: () => void;
}) {
  const [state, formAction, isPending] = useActionState(assignCountry, {});
  const [search, setSearch] = useState("");
  const [selected, setSelected] = useState<{
    code: string;
    name: string;
  } | null>(
    entry.countryCode && entry.countryName
      ? { code: entry.countryCode, name: entry.countryName }
      : null
  );
  const formRef = useRef<HTMLFormElement>(null);

  const filtered = search
    ? COUNTRIES.filter(
        (c) =>
          c.name.toLowerCase().includes(search.toLowerCase()) ||
          c.code.toLowerCase().includes(search.toLowerCase())
      )
    : COUNTRIES;

  useEffect(() => {
    if (state.success) {
      onClose();
    }
  }, [state.success, onClose]);

  return (
    <Modal isOpen onClose={onClose} title={`Assign Country — ${entry.ip}`}>
      <form ref={formRef} action={formAction}>
        <input type="hidden" name="engagementId" value={engagementId} />
        <input type="hidden" name="geolocationId" value={entry.id} />
        <input
          type="hidden"
          name="countryCode"
          value={selected?.code ?? ""}
        />
        <input
          type="hidden"
          name="countryName"
          value={selected?.name ?? ""}
        />

        <div className="space-y-4">
          {/* Current info */}
          <div className="text-xs text-text-muted">
            {entry.isPrivate && (
              <span className="inline-flex items-center gap-1 text-blue-400 mr-3">
                <span className="w-1.5 h-1.5 rounded-full bg-blue-400" />
                Private IP
              </span>
            )}
            {entry.countryCode && (
              <span>
                Currently:{" "}
                <span className="text-text-secondary">
                  {entry.countryCode} — {entry.countryName}
                </span>
              </span>
            )}
          </div>

          {/* Search */}
          <input
            type="text"
            placeholder="Search countries..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full px-3 py-2 text-sm bg-bg-primary border border-border-default rounded focus:outline-none focus:border-accent/50 text-text-primary placeholder:text-text-muted/40"
            autoFocus
          />

          {/* Country list */}
          <div className="max-h-60 overflow-y-auto border border-border-default rounded bg-bg-primary">
            {filtered.length === 0 ? (
              <p className="text-xs text-text-muted p-3 text-center">
                No countries match
              </p>
            ) : (
              filtered.map((c) => (
                <button
                  key={c.code}
                  type="button"
                  onClick={() => setSelected(c)}
                  className={`w-full flex items-center gap-2 px-3 py-1.5 text-left text-sm transition-colors duration-75 ${
                    selected?.code === c.code
                      ? "bg-accent/10 text-accent"
                      : "text-text-secondary hover:bg-bg-elevated/50"
                  }`}
                >
                  <span className="font-mono text-[10px] text-text-muted w-6">
                    {c.code}
                  </span>
                  <span>{c.name}</span>
                  {selected?.code === c.code && (
                    <svg
                      className="w-3.5 h-3.5 ml-auto text-accent"
                      fill="none"
                      viewBox="0 0 24 24"
                      strokeWidth={2}
                      stroke="currentColor"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        d="M4.5 12.75l6 6 9-13.5"
                      />
                    </svg>
                  )}
                </button>
              ))
            )}
          </div>

          {state.error && (
            <p className="text-xs text-red-400">{state.error}</p>
          )}

          {/* Actions */}
          <div className="flex items-center justify-end gap-2 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="px-3 py-1.5 text-xs text-text-muted hover:text-text-primary border border-border-default rounded transition-colors duration-100"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={!selected || isPending}
              className="px-3 py-1.5 text-xs font-medium text-white bg-accent hover:bg-accent-bright disabled:opacity-40 rounded transition-colors duration-100"
            >
              {isPending ? "Saving..." : "Assign"}
            </button>
          </div>
        </div>
      </form>
    </Modal>
  );
}

interface GeoContributor {
  userId: string;
  username: string;
  displayName: string | null;
  hasAvatar: boolean;
  ipCount: number;
}

interface GeoEntry {
  countryCode: string | null;
  countryName: string | null;
  ipCount: number;
  contributors: GeoContributor[];
}

const SIDEBAR_WIDTH = 280;

function GlobeModal({
  engagementId,
  members,
  onClose,
}: {
  engagementId: string;
  members: MemberInfo[];
  onClose: () => void;
}) {
  const [size, setSize] = useState({ w: 0, h: 0 });
  const [geoData, setGeoData] = useState<GeoEntry[]>([]);
  const handleKeyDown = useCallback(
    (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    },
    [onClose]
  );

  const memberIds = useMemo(() => members.map((m) => m.userId), [members]);

  useEffect(() => {
    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [handleKeyDown]);

  useEffect(() => {
    let rafId: number;
    const update = () => {
      cancelAnimationFrame(rafId);
      rafId = requestAnimationFrame(() => {
        setSize({ w: window.innerWidth, h: window.innerHeight });
      });
    };
    update();
    window.addEventListener("resize", update);
    return () => {
      window.removeEventListener("resize", update);
      cancelAnimationFrame(rafId);
    };
  }, []);

  useEffect(() => {
    fetch(`/api/engagements/${engagementId}/ip-geolocations`)
      .then((r) => r.json())
      .then(setGeoData)
      .catch(() => {});
  }, [engagementId]);

  // Globe uses remaining space after sidebar — full rectangle, not square
  const globeWidth = size.w - SIDEBAR_WIDTH;
  const globeHeight = size.h;

  const resolved = geoData.filter(
    (d): d is GeoEntry & { countryCode: string } => !!d.countryCode
  );
  const totalIps = geoData.reduce((sum, d) => sum + d.ipCount, 0);
  const countries = resolved.length;

  // Collect unique contributors across all countries
  const activeContributorIds = new Set<string>();
  for (const d of resolved) {
    for (const c of d.contributors) {
      activeContributorIds.add(c.userId);
    }
  }
  const activeMembers = members.filter((m) =>
    activeContributorIds.has(m.userId)
  );

  return createPortal(
    <div className="fixed inset-0 z-[60] bg-[#06080d] flex">
      {/* Left sidebar */}
      <div
        className="h-full flex flex-col border-r border-border-default/30 bg-bg-surface/40 backdrop-blur-sm shrink-0"
        style={{ width: SIDEBAR_WIDTH }}
      >
        <div className="p-4 border-b border-border-default/20">
          <h3 className="text-xs font-semibold text-text-secondary uppercase tracking-wider mb-2">
            Operations Globe
          </h3>
          <div className="flex items-center gap-4">
            <span className="text-xs text-text-muted">
              <span className="text-accent font-mono font-semibold">
                {totalIps}
              </span>{" "}
              IP{totalIps !== 1 && "s"}
            </span>
            <span className="text-xs text-text-muted">
              <span className="text-accent font-mono font-semibold">
                {countries}
              </span>{" "}
              countr{countries !== 1 ? "ies" : "y"}
            </span>
          </div>
        </div>

        {/* User color legend */}
        {activeMembers.length > 0 && (
          <div className="px-4 py-3 border-b border-border-default/20">
            <h4 className="text-[9px] font-mono text-text-muted uppercase tracking-wider mb-2">
              Contributors
            </h4>
            <div className="flex flex-wrap gap-x-3 gap-y-1">
              {activeMembers.map((m) => {
                const color = getUserColor(m.userId, memberIds);
                const name = m.displayName || m.username;
                return (
                  <div key={m.userId} className="flex items-center gap-1.5">
                    <span
                      className="w-2 h-2 rounded-full"
                      style={{ backgroundColor: color }}
                    />
                    <span className="text-[10px] text-text-secondary">
                      {name}
                    </span>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        <div className="flex-1 overflow-y-auto p-3">
          {resolved.length > 0 ? (
            <div className="grid gap-1">
              {resolved
                .sort((a, b) => b.ipCount - a.ipCount)
                .map((d) => (
                  <div
                    key={d.countryCode}
                    className="px-3 py-1.5 rounded bg-bg-elevated/30"
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <div className="flex -space-x-0.5">
                          {(d.contributors.length > 0
                            ? d.contributors.slice(0, 3)
                            : [null]
                          ).map((c, i) => (
                            <span
                              key={c?.userId ?? i}
                              className="w-2 h-2 rounded-full border border-bg-surface"
                              style={{
                                backgroundColor: c
                                  ? getUserColor(c.userId, memberIds)
                                  : "#e8735a",
                              }}
                            />
                          ))}
                        </div>
                        <span className="text-xs text-text-secondary">
                          {d.countryName ?? d.countryCode}
                        </span>
                        <span className="text-[10px] text-text-muted font-mono">
                          {d.countryCode}
                        </span>
                      </div>
                      <span className="text-xs font-mono text-text-muted ml-4">
                        {d.ipCount} IP{d.ipCount !== 1 && "s"}
                      </span>
                    </div>
                    {d.contributors.length > 1 && (
                      <div className="ml-5 mt-1 space-y-0.5">
                        {d.contributors.map((c) => (
                          <div
                            key={c.userId}
                            className="flex items-center justify-between"
                          >
                            <div className="flex items-center gap-1.5">
                              <span
                                className="w-1.5 h-1.5 rounded-full"
                                style={{
                                  backgroundColor: getUserColor(
                                    c.userId,
                                    memberIds
                                  ),
                                }}
                              />
                              <span className="text-[10px] text-text-muted">
                                {c.displayName || c.username}
                              </span>
                            </div>
                            <span className="text-[10px] font-mono text-text-muted">
                              {c.ipCount}
                            </span>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                ))}
            </div>
          ) : (
            <div className="text-center py-8">
              <p className="text-xs text-text-muted">No geolocated IPs yet</p>
              <p className="text-[11px] text-text-muted/50 mt-1">
                IPs are extracted from resources and actions
              </p>
            </div>
          )}
        </div>
      </div>

      {/* Globe area */}
      <div className="flex-1 relative flex items-center justify-center overflow-hidden">
        {/* Close button */}
        <button
          onClick={onClose}
          className="absolute top-4 right-4 z-10 p-2 text-text-muted hover:text-text-primary bg-bg-surface/60 border border-border-default/50 rounded-lg backdrop-blur-sm transition-colors duration-100"
        >
          <svg
            className="w-5 h-5"
            fill="none"
            viewBox="0 0 24 24"
            strokeWidth={1.5}
            stroke="currentColor"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              d="M6 18L18 6M6 6l12 12"
            />
          </svg>
        </button>

        {globeWidth > 0 && globeHeight > 0 && (
          <GlobeCard
            engagementId={engagementId}
            globeWidth={globeWidth}
            globeHeight={globeHeight}
            memberIds={memberIds}
          />
        )}
      </div>
    </div>,
    document.body
  );
}
