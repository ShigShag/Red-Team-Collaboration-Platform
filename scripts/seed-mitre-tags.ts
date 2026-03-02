process.loadEnvFile();

async function seed() {
  const { eq } = await import("drizzle-orm");
  const { db } = await import("../src/db/index");
  const { tags } = await import("../src/db/schema");
  const { MITRE_TECHNIQUES } = await import("../src/db/mitre-attack-data");

  const existing = await db
    .select({ mitreId: tags.mitreId })
    .from(tags)
    .where(eq(tags.isSystem, true));

  const existingIds = new Set(existing.map((e) => e.mitreId));
  const toInsert = MITRE_TECHNIQUES.filter((t) => !existingIds.has(t.mitreId));

  if (toInsert.length > 0) {
    const BATCH_SIZE = 100;
    for (let i = 0; i < toInsert.length; i += BATCH_SIZE) {
      const batch = toInsert.slice(i, i + BATCH_SIZE);
      await db.insert(tags).values(
        batch.map((t) => ({
          name: t.name,
          mitreId: t.mitreId,
          tactic: t.tactic,
          description: t.description,
          isSystem: true,
          createdBy: null,
        }))
      );
    }
  }

  console.log(
    `Seeded ${toInsert.length} new MITRE tag(s). ${existing.length} already existed.`
  );
  process.exit(0);
}

seed().catch((err) => {
  console.error("Seed failed:", err);
  process.exit(1);
});
