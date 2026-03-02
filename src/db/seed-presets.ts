process.loadEnvFile();

async function seed() {
  const { eq } = await import("drizzle-orm");
  const { db } = await import("./index");
  const { categoryPresets } = await import("./schema");

  const systemPresets = [
    { name: "AD Domain", icon: "\u{1F3E2}", color: "#3b82f6", description: "Active Directory domain environment" },
    { name: "Website", icon: "\u{1F310}", color: "#8b5cf6", description: "Web application or website target" },
    { name: "Cloud (Azure)", icon: "\u2601\uFE0F", color: "#0ea5e9", description: "Microsoft Azure cloud environment" },
    { name: "Cloud (AWS)", icon: "\u2601\uFE0F", color: "#f97316", description: "Amazon Web Services environment" },
    { name: "Cloud (GCP)", icon: "\u2601\uFE0F", color: "#22c55e", description: "Google Cloud Platform environment" },
    { name: "Network Segment", icon: "\u{1F50C}", color: "#6366f1", description: "Internal network segment or VLAN" },
    { name: "Wireless", icon: "\u{1F4E1}", color: "#14b8a6", description: "Wireless network infrastructure" },
    { name: "Physical", icon: "\u{1F3D7}\uFE0F", color: "#a3a3a3", description: "Physical security assessment" },
    { name: "Social Engineering", icon: "\u{1F3AD}", color: "#ec4899", description: "Social engineering campaign" },
    { name: "Mobile App", icon: "\u{1F4F1}", color: "#84cc16", description: "Mobile application (iOS/Android)" },
    { name: "API / Service", icon: "\u26A1", color: "#eab308", description: "API endpoint or microservice" },
    { name: "Source Code", icon: "\u{1F4BB}", color: "#a78bfa", description: "Source code review" },
  ];

  const existing = await db
    .select({ name: categoryPresets.name })
    .from(categoryPresets)
    .where(eq(categoryPresets.isSystem, true));

  const existingNames = new Set(existing.map((e) => e.name));
  const toInsert = systemPresets.filter((p) => !existingNames.has(p.name));

  if (toInsert.length > 0) {
    await db.insert(categoryPresets).values(
      toInsert.map((p) => ({
        ...p,
        isSystem: true,
        createdBy: null,
      }))
    );
  }

  console.log(
    `Seeded ${toInsert.length} new preset(s). ${existing.length} already existed.`
  );
  process.exit(0);
}

seed().catch((err) => {
  console.error("Seed failed:", err);
  process.exit(1);
});
