// IPv4 regex with word boundaries to avoid partial matches
const IPV4_REGEX =
  /\b(?:(?:25[0-5]|2[0-4]\d|1\d{2}|[1-9]?\d)\.){3}(?:25[0-5]|2[0-4]\d|1\d{2}|[1-9]?\d)\b/g;

export function extractIPv4Addresses(text: string): string[] {
  const matches = text.match(IPV4_REGEX) ?? [];
  return [...new Set(matches)];
}

export function isPrivateIp(ip: string): boolean {
  const parts = ip.split(".").map(Number);
  if (parts.length !== 4) return false;

  // 10.0.0.0/8
  if (parts[0] === 10) return true;
  // 172.16.0.0/12
  if (parts[0] === 172 && parts[1] >= 16 && parts[1] <= 31) return true;
  // 192.168.0.0/16
  if (parts[0] === 192 && parts[1] === 168) return true;
  // 127.0.0.0/8 (loopback)
  if (parts[0] === 127) return true;
  // 0.0.0.0
  if (parts.every((p) => p === 0)) return true;
  // 169.254.0.0/16 (link-local)
  if (parts[0] === 169 && parts[1] === 254) return true;

  return false;
}

export function extractIPsFromTexts(
  texts: (string | null | undefined)[]
): string[] {
  const allIps = new Set<string>();
  for (const text of texts) {
    if (!text) continue;
    for (const ip of extractIPv4Addresses(text)) {
      allIps.add(ip);
    }
  }
  return Array.from(allIps);
}
