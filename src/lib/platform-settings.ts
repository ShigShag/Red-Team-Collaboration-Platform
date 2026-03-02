import { db } from "@/db";
import { platformSettings } from "@/db/schema";
import { eq } from "drizzle-orm";

const ENV_DEFAULTS: Record<string, () => string> = {
  registration_mode: () => process.env.REGISTRATION_MODE ?? "open",
  session_ttl_hours: () => "24",
  require_2fa: () => "false",
  ollama_base_url: () => process.env.OLLAMA_BASE_URL ?? "",
  ollama_model: () => process.env.OLLAMA_MODEL ?? "llama3.1:70b",
  ollama_finding_model: () => "",
};

export async function getSetting(key: string): Promise<string> {
  const [row] = await db
    .select({ value: platformSettings.value })
    .from(platformSettings)
    .where(eq(platformSettings.key, key))
    .limit(1);
  if (row) return row.value;
  const fallback = ENV_DEFAULTS[key];
  return fallback ? fallback() : "";
}

export async function getAllSettings(): Promise<Record<string, string>> {
  const rows = await db.select().from(platformSettings);
  const settings: Record<string, string> = {};
  for (const [key, fallback] of Object.entries(ENV_DEFAULTS)) {
    settings[key] = fallback();
  }
  for (const row of rows) {
    settings[row.key] = row.value;
  }
  return settings;
}

export async function updateSetting(
  key: string,
  value: string,
  updatedBy: string
): Promise<void> {
  await db
    .insert(platformSettings)
    .values({ key, value, updatedBy, updatedAt: new Date() })
    .onConflictDoUpdate({
      target: platformSettings.key,
      set: { value, updatedBy, updatedAt: new Date() },
    });
}
