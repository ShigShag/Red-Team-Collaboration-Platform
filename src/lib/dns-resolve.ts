import dns from "dns";

const resolver = new dns.promises.Resolver();
resolver.setServers(["8.8.8.8", "1.1.1.1"]);

// In-memory cache: domain → { ips, error, timestamp }
const DNS_CACHE = new Map<
  string,
  { ips: string[]; error?: string; at: number }
>();
const CACHE_TTL_MS = 5 * 60 * 1000; // 5 minutes

export interface DnsResult {
  domain: string;
  ips: string[];
  error?: string;
}

export async function resolveDomain(domain: string): Promise<DnsResult> {
  const cached = DNS_CACHE.get(domain);
  if (cached && Date.now() - cached.at < CACHE_TTL_MS) {
    return { domain, ips: cached.ips, error: cached.error };
  }

  try {
    const ips = await resolver.resolve4(domain);
    DNS_CACHE.set(domain, { ips, at: Date.now() });
    return { domain, ips };
  } catch (err: unknown) {
    const code =
      err instanceof Error && "code" in err
        ? (err as NodeJS.ErrnoException).code ?? "UNKNOWN"
        : "UNKNOWN";
    DNS_CACHE.set(domain, { ips: [], error: code, at: Date.now() });
    return { domain, ips: [], error: code };
  }
}

export async function resolveDomains(domains: string[]): Promise<DnsResult[]> {
  return Promise.all(
    domains.map((d) =>
      Promise.race([
        resolveDomain(d),
        new Promise<DnsResult>((resolve) =>
          setTimeout(
            () => resolve({ domain: d, ips: [], error: "ETIMEOUT" }),
            5000
          )
        ),
      ])
    )
  );
}
