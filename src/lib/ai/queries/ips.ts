import { eq, and } from "drizzle-orm";
import { db } from "@/db";
import { ipGeolocations } from "@/db/schema";

export async function listIpGeolocations(
  engagementId: string,
  args: { countryCode?: string }
): Promise<string> {
  const conditions = [eq(ipGeolocations.engagementId, engagementId)];
  if (args.countryCode) {
    conditions.push(
      eq(ipGeolocations.countryCode, args.countryCode.toUpperCase())
    );
  }

  const ips = await db
    .select({
      ip: ipGeolocations.ip,
      countryCode: ipGeolocations.countryCode,
      countryName: ipGeolocations.countryName,
      isPrivate: ipGeolocations.isPrivate,
    })
    .from(ipGeolocations)
    .where(and(...conditions))
    .orderBy(ipGeolocations.ip)
    .limit(100);

  if (ips.length === 0) return "No IP geolocations recorded.";

  const lines = ips.map(
    (ip) =>
      `- ${ip.ip} — ${ip.isPrivate ? "Private" : `${ip.countryName ?? ip.countryCode ?? "Unknown"}`}`
  );

  // Group summary by country
  const byCountry = new Map<string, number>();
  for (const ip of ips) {
    const key = ip.countryName ?? ip.countryCode ?? (ip.isPrivate ? "Private" : "Unknown");
    byCountry.set(key, (byCountry.get(key) ?? 0) + 1);
  }

  const summary = Array.from(byCountry.entries())
    .sort((a, b) => b[1] - a[1])
    .map(([country, count]) => `  ${country}: ${count}`)
    .join("\n");

  return `${ips.length} IP(s):\n\nBy country:\n${summary}\n\nAll IPs:\n${lines.join("\n")}`;
}
