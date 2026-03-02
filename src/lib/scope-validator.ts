export type ScopeStatus = "in_scope" | "out_of_scope" | "excluded" | "unknown";

export interface ScopeCheckResult {
  status: ScopeStatus;
  matchedTarget?: { id: string; type: string; value: string };
  matchedExclusion?: { id: string; value: string; justification: string };
}

interface ScopeEntry {
  id: string;
  type: string;
  value: string;
}

interface ExclusionEntry {
  id: string;
  type: string;
  value: string;
  justification: string;
}

function ipToInt(ip: string): number {
  const parts = ip.split(".");
  if (parts.length !== 4) return 0;
  return parts.reduce((acc, octet) => (acc << 8) + parseInt(octet, 10), 0) >>> 0;
}

export function ipInCidr(ip: string, cidr: string): boolean {
  const [base, prefixStr] = cidr.split("/");
  if (!base || !prefixStr) return false;
  const prefix = parseInt(prefixStr, 10);
  if (prefix < 0 || prefix > 32) return false;
  const mask = prefix === 0 ? 0 : (~0 << (32 - prefix)) >>> 0;
  return (ipToInt(ip) & mask) === (ipToInt(base) & mask);
}

function matchesDomain(needle: string, pattern: string): boolean {
  const n = needle.toLowerCase();
  const p = pattern.toLowerCase();
  if (n === p) return true;
  if (p.startsWith("*.")) {
    const suffix = p.slice(1); // ".example.com"
    return n.endsWith(suffix) || n === p.slice(2);
  }
  return false;
}

export function checkIpScope(
  ip: string,
  targets: ScopeEntry[],
  exclusions: ExclusionEntry[]
): ScopeCheckResult {
  // Check exclusions first (take priority)
  for (const ex of exclusions) {
    if (ex.type === "ip" && ex.value === ip) {
      return { status: "excluded", matchedExclusion: ex };
    }
    if (ex.type === "cidr" && ipInCidr(ip, ex.value)) {
      return { status: "excluded", matchedExclusion: ex };
    }
  }

  // Check targets
  const ipTargets = targets.filter((t) => t.type === "ip" || t.type === "cidr");
  if (ipTargets.length === 0) return { status: "unknown" };

  for (const t of targets) {
    if (t.type === "ip" && t.value === ip) {
      return { status: "in_scope", matchedTarget: t };
    }
    if (t.type === "cidr" && ipInCidr(ip, t.value)) {
      return { status: "in_scope", matchedTarget: t };
    }
  }

  return { status: "out_of_scope" };
}

export function checkDomainScope(
  domain: string,
  targets: ScopeEntry[],
  exclusions: ExclusionEntry[]
): ScopeCheckResult {
  // Check exclusions first
  for (const ex of exclusions) {
    if (ex.type === "domain" && matchesDomain(domain, ex.value)) {
      return { status: "excluded", matchedExclusion: ex };
    }
  }

  // Check targets
  const domainTargets = targets.filter((t) => t.type === "domain");
  if (domainTargets.length === 0) return { status: "unknown" };

  for (const t of targets) {
    if (t.type === "domain" && matchesDomain(domain, t.value)) {
      return { status: "in_scope", matchedTarget: t };
    }
  }

  return { status: "out_of_scope" };
}
