import maxmind from "maxmind";
import { join } from "path";
import { COUNTRIES } from "./country-coordinates";

// The @ip-location-db/geolite2-country-mmdb package returns a flat structure:
// { country_code: "US" } instead of the official MaxMind nested format
interface IpLocationDbResult {
  country_code?: string;
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
let readerPromise: Promise<any> | null = null;

// Build a code → name lookup from our static country list
const countryNameMap = new Map(COUNTRIES.map((c) => [c.code, c.name]));

function getMmdbPath(): string {
  // Turbopack virtualizes require.resolve() to "[project]/..." paths,
  // so we use process.cwd() to build the real filesystem path instead
  return join(
    process.cwd(),
    "node_modules",
    "@ip-location-db",
    "geolite2-country-mmdb",
    "geolite2-country.mmdb"
  );
}

function getReader() {
  if (!readerPromise) {
    readerPromise = maxmind.open(getMmdbPath());
  }
  return readerPromise;
}

export interface GeoLookupResult {
  countryCode: string | null;
  countryName: string | null;
}

export async function lookupIp(ip: string): Promise<GeoLookupResult> {
  const reader = await getReader();
  const result = reader.get(ip) as IpLocationDbResult | null;
  const code = result?.country_code ?? null;
  if (code) {
    return {
      countryCode: code,
      countryName: countryNameMap.get(code) ?? code,
    };
  }
  return { countryCode: null, countryName: null };
}
