import { db } from "@/db";
import {
  ipGeolocations,
  ipGeolocationSources,
  domainResolutions,
  domainResolutionSources,
} from "@/db/schema";
import { eq, and, inArray } from "drizzle-orm";
import { extractIPsFromTexts, isPrivateIp } from "./ip-extraction";
import { extractDomainsFromTexts } from "./domain-extraction";
import { resolveDomains, type DnsResult } from "./dns-resolve";
import { lookupIp } from "./geoip";

interface SyncParams {
  engagementId: string;
  sourceType: "resource" | "action" | "finding";
  sourceId: string;
  texts: (string | null | undefined)[];
}

export async function syncIpGeolocations(params: SyncParams): Promise<void> {
  try {
    const { engagementId, sourceType, sourceId, texts } = params;

    // Phase 1: Extract IPs directly from text
    const directIps = extractIPsFromTexts(texts);

    // Phase 2: Extract domains and resolve via DNS
    const domains = extractDomainsFromTexts(texts);
    let dnsResults: DnsResult[] = [];
    let domainIps: string[] = [];

    if (domains.length > 0) {
      dnsResults = await resolveDomains(domains);
      domainIps = dnsResults.flatMap((r) => r.ips);
    }

    // Phase 3: Merge all IPs (direct + domain-resolved), deduplicate
    const allIps = [...new Set([...directIps, ...domainIps])];

    if (allIps.length === 0 && dnsResults.length === 0) return;

    // Phase 4: Process IPs through geolocation pipeline
    if (allIps.length > 0) {
      const existingRows = await db
        .select({
          id: ipGeolocations.id,
          ip: ipGeolocations.ip,
          isManual: ipGeolocations.isManual,
        })
        .from(ipGeolocations)
        .where(
          and(
            eq(ipGeolocations.engagementId, engagementId),
            inArray(ipGeolocations.ip, allIps)
          )
        );

      const existingMap = new Map(existingRows.map((r) => [r.ip, r]));

      for (const ip of allIps) {
        const existing = existingMap.get(ip);

        if (existing) {
          await db
            .insert(ipGeolocationSources)
            .values({ geolocationId: existing.id, sourceType, sourceId })
            .onConflictDoNothing();
        } else {
          const priv = isPrivateIp(ip);
          let countryCode: string | null = null;
          let countryName: string | null = null;

          if (!priv) {
            const geo = await lookupIp(ip);
            countryCode = geo.countryCode;
            countryName = geo.countryName;
          }

          const [newRow] = await db
            .insert(ipGeolocations)
            .values({
              engagementId,
              ip,
              countryCode,
              countryName,
              isManual: false,
              isPrivate: priv,
            })
            .onConflictDoNothing()
            .returning({ id: ipGeolocations.id });

          if (newRow) {
            await db
              .insert(ipGeolocationSources)
              .values({ geolocationId: newRow.id, sourceType, sourceId });
          } else {
            // Race condition: another concurrent request inserted it
            const [existing2] = await db
              .select({ id: ipGeolocations.id })
              .from(ipGeolocations)
              .where(
                and(
                  eq(ipGeolocations.engagementId, engagementId),
                  eq(ipGeolocations.ip, ip)
                )
              )
              .limit(1);
            if (existing2) {
              await db
                .insert(ipGeolocationSources)
                .values({
                  geolocationId: existing2.id,
                  sourceType,
                  sourceId,
                })
                .onConflictDoNothing();
            }
          }
        }
      }
    }

    // Phase 5: Store domain resolution records
    if (dnsResults.length > 0) {
      await storeDomainResolutions({
        engagementId,
        sourceType,
        sourceId,
        dnsResults,
      });
    }
  } catch (error) {
    console.error("[ip-geolocation-sync] Failed to sync IPs:", error);
  }
}

async function storeDomainResolutions(params: {
  engagementId: string;
  sourceType: "resource" | "action" | "finding";
  sourceId: string;
  dnsResults: DnsResult[];
}): Promise<void> {
  const { engagementId, sourceType, sourceId, dnsResults } = params;

  for (const result of dnsResults) {
    if (result.ips.length > 0) {
      // Domain resolved — create a row per resolved IP
      for (const ip of result.ips) {
        // Look up the geolocation row (should exist from phase 4)
        const [geoRow] = await db
          .select({ id: ipGeolocations.id })
          .from(ipGeolocations)
          .where(
            and(
              eq(ipGeolocations.engagementId, engagementId),
              eq(ipGeolocations.ip, ip)
            )
          )
          .limit(1);

        const [resRow] = await db
          .insert(domainResolutions)
          .values({
            engagementId,
            domain: result.domain,
            ip,
            geolocationId: geoRow?.id ?? null,
            resolveError: null,
            resolvedAt: new Date(),
          })
          .onConflictDoUpdate({
            target: [
              domainResolutions.engagementId,
              domainResolutions.domain,
              domainResolutions.ip,
            ],
            set: {
              geolocationId: geoRow?.id ?? null,
              resolvedAt: new Date(),
            },
          })
          .returning({ id: domainResolutions.id });

        if (resRow) {
          await db
            .insert(domainResolutionSources)
            .values({ resolutionId: resRow.id, sourceType, sourceId })
            .onConflictDoNothing();
        }
      }
    } else {
      // Domain failed to resolve — store with error
      const [resRow] = await db
        .insert(domainResolutions)
        .values({
          engagementId,
          domain: result.domain,
          ip: null,
          geolocationId: null,
          resolveError: result.error ?? "ENOTFOUND",
          resolvedAt: new Date(),
        })
        .onConflictDoNothing()
        .returning({ id: domainResolutions.id });

      const resId = resRow?.id;
      if (resId) {
        await db
          .insert(domainResolutionSources)
          .values({ resolutionId: resId, sourceType, sourceId })
          .onConflictDoNothing();
      }
    }
  }
}
