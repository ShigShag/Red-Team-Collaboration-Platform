// Known TLDs — common + red-team-relevant
const COMMON_TLDS = new Set([
  // Generic
  "com", "net", "org", "io", "dev", "app", "co", "me", "info", "biz",
  "xyz", "online", "site", "top", "club", "tech", "store", "cloud",
  // Government / Education / Military
  "edu", "gov", "mil", "int",
  // Country codes (major)
  "us", "uk", "de", "fr", "ru", "cn", "jp", "au", "ca", "nl", "br",
  "in", "it", "es", "ch", "se", "no", "fi", "pl", "cz", "at", "be",
  "pt", "dk", "ie", "nz", "za", "kr", "tw", "sg", "hk", "mx", "ar",
  "cl", "pe", "il", "ua", "ro", "hu", "bg", "hr", "sk", "lt", "lv",
  "ee", "si", "is", "lu", "mt", "cy",
  // Commonly abused in attacks
  "tk", "ml", "ga", "cf", "gq", "ws", "cc", "pw", "su",
  // Other popular
  "tv", "fm", "am", "gg", "ly", "to", "sh", "ac", "la",
]);

// Match FQDNs: 2+ labels ending in 2-63 char TLD
// Negative lookbehind for @ (emails), / (url paths), and word chars
const DOMAIN_REGEX =
  /(?<![/@\w.])(?:[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?\.)+([a-zA-Z]{2,63})(?![.\w])/g;

export function extractDomains(text: string): string[] {
  const matches: string[] = [];
  // Reset lastIndex since we're reusing the global regex
  DOMAIN_REGEX.lastIndex = 0;
  let match: RegExpExecArray | null;

  while ((match = DOMAIN_REGEX.exec(text)) !== null) {
    const domain = match[0].toLowerCase();
    const tld = match[1].toLowerCase();

    if (!COMMON_TLDS.has(tld)) continue;
    if (domain.split(".").length < 2) continue;
    if (isVersionNumber(domain)) continue;

    matches.push(domain);
  }

  return [...new Set(matches)];
}

function isVersionNumber(s: string): boolean {
  // e.g. "1.2.3", "v2.0.1"
  return /^v?\d+\.\d+/.test(s);
}

export function extractDomainsFromTexts(
  texts: (string | null | undefined)[]
): string[] {
  const all = new Set<string>();
  for (const text of texts) {
    if (!text) continue;
    for (const domain of extractDomains(text)) {
      all.add(domain);
    }
  }
  return Array.from(all);
}
