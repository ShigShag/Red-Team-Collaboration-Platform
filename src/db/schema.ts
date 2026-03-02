import { sql } from "drizzle-orm";
import {
  pgTable,
  pgEnum,
  uuid,
  varchar,
  boolean,
  timestamp,
  date,
  text,
  integer,
  bigint,
  jsonb,
  numeric,
  index,
  uniqueIndex,
  type AnyPgColumn,
} from "drizzle-orm/pg-core";

export const users = pgTable("users", {
  id: uuid("id").defaultRandom().primaryKey(),
  username: varchar("username", { length: 100 }).notNull().unique(),
  displayName: varchar("display_name", { length: 100 }),
  avatarPath: varchar("avatar_path", { length: 255 }),
  passwordHash: text("password_hash").notNull(),
  totpSecret: text("totp_secret"),
  totpKeySalt: text("totp_key_salt"),
  totpEnabled: boolean("totp_enabled").notNull().default(false),
  isAdmin: boolean("is_admin").notNull().default(false),
  isCoordinator: boolean("is_coordinator").notNull().default(false),
  disabledAt: timestamp("disabled_at", { withTimezone: true }),
  passwordResetRequired: boolean("password_reset_required")
    .notNull()
    .default(false),
  onboardingDismissedAt: timestamp("onboarding_dismissed_at", { withTimezone: true }),
  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
});

export const sessions = pgTable(
  "sessions",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    token: varchar("token", { length: 128 }).notNull().unique(),
    expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    ipAddress: varchar("ip_address", { length: 45 }),
    userAgent: text("user_agent"),
  },
  (table) => [index("sessions_token_idx").on(table.token)]
);

export const pending2fa = pgTable(
  "pending_2fa",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    wrappedKey: text("wrapped_key").notNull(),
    attempts: integer("attempts").notNull().default(0),
    expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [index("pending_2fa_user_idx").on(table.userId)]
);

// Recovery Codes (Argon2id-hashed backup codes for 2FA)

export const recoveryCodes = pgTable(
  "recovery_codes",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    codeHash: text("code_hash").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [index("recovery_codes_user_idx").on(table.userId)]
);

// Engagements

export const engagementRoleEnum = pgEnum("engagement_role", [
  "read",
  "write",
  "owner",
]);

export const engagementStatusEnum = pgEnum("engagement_status", [
  "scoping",
  "active",
  "reporting",
  "closed",
  "archived",
]);

export const engagements = pgTable("engagements", {
  id: uuid("id").defaultRandom().primaryKey(),
  name: varchar("name", { length: 255 }).notNull(),
  description: text("description"),
  status: engagementStatusEnum("status").notNull().default("scoping"),
  excludeCoordinators: boolean("exclude_coordinators").notNull().default(false),
  startDate: date("start_date"),
  endDate: date("end_date"),
  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
});

export const engagementMembers = pgTable(
  "engagement_members",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    engagementId: uuid("engagement_id")
      .notNull()
      .references(() => engagements.id, { onDelete: "cascade" }),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    role: engagementRoleEnum("role").notNull().default("read"),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    uniqueIndex("engagement_members_unique_idx").on(
      table.engagementId,
      table.userId
    ),
    index("engagement_members_user_idx").on(table.userId),
  ]
);

// Coordinator Exclusions (per-engagement coordinator access revocations)

export const coordinatorExclusions = pgTable(
  "coordinator_exclusions",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    engagementId: uuid("engagement_id")
      .notNull()
      .references(() => engagements.id, { onDelete: "cascade" }),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    uniqueIndex("coordinator_exclusions_unique_idx").on(
      table.engagementId,
      table.userId
    ),
    index("coordinator_exclusions_user_idx").on(table.userId),
  ]
);

// Category Presets (global reusable templates)

export const categoryPresets = pgTable("category_presets", {
  id: uuid("id").defaultRandom().primaryKey(),
  name: varchar("name", { length: 100 }).notNull(),
  icon: varchar("icon", { length: 50 }).notNull(),
  color: varchar("color", { length: 7 }),
  description: text("description"),
  isSystem: boolean("is_system").notNull().default(false),
  createdBy: uuid("created_by").references(() => users.id, {
    onDelete: "set null",
  }),
  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
});

// Engagement Categories (instances within an engagement)

export const engagementCategories = pgTable(
  "engagement_categories",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    engagementId: uuid("engagement_id")
      .notNull()
      .references(() => engagements.id, { onDelete: "cascade" }),
    parentId: uuid("parent_id").references(
      (): AnyPgColumn => engagementCategories.id,
      { onDelete: "cascade" }
    ),
    presetId: uuid("preset_id")
      .notNull()
      .references(() => categoryPresets.id, { onDelete: "restrict" }),
    name: varchar("name", { length: 150 }).notNull(),
    color: varchar("color", { length: 7 }),
    description: text("description"),
    locked: boolean("locked").notNull().default(false),
    createdBy: uuid("created_by")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    index("engagement_categories_engagement_idx").on(table.engagementId),
    index("engagement_categories_parent_idx").on(table.parentId),
  ]
);

// Category Assignments (who is tackling what)

export const categoryAssignments = pgTable(
  "category_assignments",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    categoryId: uuid("category_id")
      .notNull()
      .references(() => engagementCategories.id, { onDelete: "cascade" }),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    assignedBy: uuid("assigned_by")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    uniqueIndex("category_assignments_unique_idx").on(
      table.categoryId,
      table.userId
    ),
    index("category_assignments_category_idx").on(table.categoryId),
  ]
);

// Resource Templates (reusable field definitions, like category presets)

export const resourceTemplates = pgTable("resource_templates", {
  id: uuid("id").defaultRandom().primaryKey(),
  name: varchar("name", { length: 100 }).notNull(),
  icon: varchar("icon", { length: 50 }).notNull(),
  color: varchar("color", { length: 7 }),
  description: text("description"),
  fields: jsonb("fields").notNull().default([]),
  isSystem: boolean("is_system").notNull().default(false),
  createdBy: uuid("created_by").references(() => users.id, {
    onDelete: "set null",
  }),
  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
});

// Resources (containers attached to categories)

export const resources = pgTable(
  "resources",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    categoryId: uuid("category_id")
      .notNull()
      .references(() => engagementCategories.id, { onDelete: "cascade" }),
    templateId: uuid("template_id").references(() => resourceTemplates.id, {
      onDelete: "set null",
    }),
    name: varchar("name", { length: 255 }).notNull(),
    description: text("description"),
    createdBy: uuid("created_by")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [index("resources_category_idx").on(table.categoryId)]
);

// Resource Fields (user-defined key-value pairs on a resource)

export const fieldTypeEnum = pgEnum("field_type", [
  "text",
  "secret",
  "url",
  "code",
]);

export const resourceFields = pgTable(
  "resource_fields",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    resourceId: uuid("resource_id")
      .notNull()
      .references(() => resources.id, { onDelete: "cascade" }),
    key: varchar("key", { length: 100 }).notNull(),
    label: varchar("label", { length: 150 }).notNull(),
    type: fieldTypeEnum("type").notNull(),
    language: varchar("language", { length: 30 }),
    value: text("value"),
    encryptedValue: text("encrypted_value"),
    sortOrder: integer("sort_order").notNull().default(0),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [index("resource_fields_resource_idx").on(table.resourceId)]
);

// Resource Files (encrypted file attachments on a resource)

export const resourceFiles = pgTable(
  "resource_files",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    resourceId: uuid("resource_id")
      .notNull()
      .references(() => resources.id, { onDelete: "cascade" }),
    diskPath: varchar("disk_path", { length: 500 }).notNull(),
    originalFilename: varchar("original_filename", { length: 500 }).notNull(),
    mimeType: varchar("mime_type", { length: 255 }).notNull(),
    fileSize: bigint("file_size", { mode: "number" }).notNull(),
    sortOrder: integer("sort_order").notNull().default(0),
    createdBy: uuid("created_by")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [index("resource_files_resource_idx").on(table.resourceId)]
);

// Category Actions (specific actions taken by operators)

export const categoryActions = pgTable(
  "category_actions",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    categoryId: uuid("category_id")
      .notNull()
      .references(() => engagementCategories.id, { onDelete: "cascade" }),
    title: varchar("title", { length: 255 }).notNull(),
    content: text("content").notNull(),
    contentFormat: varchar("content_format", { length: 10 }).notNull().default("text"),
    performedAt: timestamp("performed_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    createdBy: uuid("created_by")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    index("category_actions_category_idx").on(table.categoryId),
  ]
);

// Finding Templates (global reusable vulnerability descriptions)

export const findingTemplateCategoryEnum = pgEnum("finding_template_category", [
  "web",
  "network",
  "cloud",
  "mobile",
  "wireless",
  "social_engineering",
  "physical",
  "api",
  "active_directory",
  "code_review",
  "general",
]);

// Category Findings (standalone vulnerability findings)

export const findingSeverityEnum = pgEnum("finding_severity", [
  "critical",
  "high",
  "medium",
  "low",
  "info",
  "fixed",
]);

export const categoryFindings = pgTable(
  "category_findings",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    categoryId: uuid("category_id")
      .notNull()
      .references(() => engagementCategories.id, { onDelete: "cascade" }),
    title: varchar("title", { length: 255 }).notNull(),
    overview: text("overview").notNull(),
    overviewFormat: varchar("overview_format", { length: 10 }).notNull().default("text"),
    impact: text("impact"),
    impactFormat: varchar("impact_format", { length: 10 }).notNull().default("text"),
    recommendation: text("recommendation"),
    recommendationFormat: varchar("recommendation_format", { length: 10 }).notNull().default("text"),
    severity: findingSeverityEnum("severity").notNull().default("medium"),
    cvssScore: numeric("cvss_score", { precision: 3, scale: 1 }),
    cvssVector: varchar("cvss_vector", { length: 150 }),
    createdBy: uuid("created_by")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    index("category_findings_category_idx").on(table.categoryId),
  ]
);

// Finding Screenshots (encrypted image attachments directly on findings)

export const findingScreenshots = pgTable(
  "finding_screenshots",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    findingId: uuid("finding_id")
      .notNull()
      .references(() => categoryFindings.id, { onDelete: "cascade" }),
    diskPath: varchar("disk_path", { length: 500 }).notNull(),
    originalFilename: varchar("original_filename", { length: 500 }).notNull(),
    mimeType: varchar("mime_type", { length: 255 }).notNull(),
    fileSize: bigint("file_size", { mode: "number" }).notNull(),
    caption: varchar("caption", { length: 500 }),
    sortOrder: integer("sort_order").notNull().default(0),
    createdBy: uuid("created_by")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [index("finding_screenshots_finding_idx").on(table.findingId)]
);

// Activity Log (engagement-scoped event timeline)

export const activityEventTypeEnum = pgEnum("activity_event_type", [
  "category_created",
  "category_updated",
  "category_deleted",
  "resource_created",
  "resource_updated",
  "resource_deleted",
  "action_created",
  "action_updated",
  "action_deleted",
  "finding_created",
  "finding_updated",
  "finding_deleted",
  "member_joined",
  "member_removed",
  "member_role_changed",
  "member_assigned",
  "member_unassigned",
  "engagement_status_changed",
  "comment_created",
  "scope_target_added",
  "scope_target_removed",
  "scope_exclusion_added",
  "scope_exclusion_removed",
  "scope_constraint_added",
  "scope_constraint_removed",
  "contact_added",
  "contact_removed",
  "scope_document_uploaded",
  "scope_document_removed",
  "ai_chat_message",
  "engagement_exported",
  "engagement_duplicated",
  "engagement_imported",
  "report_qa_requested",
  "report_qa_comment",
  "report_qa_resolved",
  "report_qa_signed_off",
]);

export const engagementActivityLog = pgTable(
  "engagement_activity_log",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    engagementId: uuid("engagement_id")
      .notNull()
      .references(() => engagements.id, { onDelete: "cascade" }),
    actorId: uuid("actor_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    eventType: activityEventTypeEnum("event_type").notNull(),
    metadata: jsonb("metadata").notNull().default({}),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    index("activity_log_engagement_idx").on(table.engagementId),
    index("activity_log_engagement_time_idx").on(
      table.engagementId,
      table.createdAt
    ),
  ]
);

// Tags (global, includes MITRE ATT&CK techniques)

export const tags = pgTable(
  "tags",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    name: varchar("name", { length: 255 }).notNull(),
    mitreId: varchar("mitre_id", { length: 20 }),
    tactic: varchar("tactic", { length: 100 }),
    description: text("description"),
    isSystem: boolean("is_system").notNull().default(false),
    createdBy: uuid("created_by").references(() => users.id, {
      onDelete: "set null",
    }),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    uniqueIndex("tags_mitre_id_unique_idx").on(table.mitreId),
    index("tags_tactic_idx").on(table.tactic),
    index("tags_name_idx").on(table.name),
  ]
);

// Action ↔ Resource links (M:N)

export const actionResources = pgTable(
  "action_resources",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    actionId: uuid("action_id")
      .notNull()
      .references(() => categoryActions.id, { onDelete: "cascade" }),
    resourceId: uuid("resource_id")
      .notNull()
      .references(() => resources.id, { onDelete: "cascade" }),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    uniqueIndex("action_resources_unique_idx").on(
      table.actionId,
      table.resourceId
    ),
    index("action_resources_action_idx").on(table.actionId),
    index("action_resources_resource_idx").on(table.resourceId),
  ]
);

// Action ↔ Tag links (M:N)

export const actionTags = pgTable(
  "action_tags",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    actionId: uuid("action_id")
      .notNull()
      .references(() => categoryActions.id, { onDelete: "cascade" }),
    tagId: uuid("tag_id")
      .notNull()
      .references(() => tags.id, { onDelete: "cascade" }),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    uniqueIndex("action_tags_unique_idx").on(table.actionId, table.tagId),
    index("action_tags_action_idx").on(table.actionId),
    index("action_tags_tag_idx").on(table.tagId),
  ]
);

// Finding ↔ Resource links (M:N)

export const findingResources = pgTable(
  "finding_resources",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    findingId: uuid("finding_id")
      .notNull()
      .references(() => categoryFindings.id, { onDelete: "cascade" }),
    resourceId: uuid("resource_id")
      .notNull()
      .references(() => resources.id, { onDelete: "cascade" }),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    uniqueIndex("finding_resources_unique_idx").on(
      table.findingId,
      table.resourceId
    ),
    index("finding_resources_finding_idx").on(table.findingId),
    index("finding_resources_resource_idx").on(table.resourceId),
  ]
);

// Finding ↔ Tag links (M:N)

export const findingTags = pgTable(
  "finding_tags",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    findingId: uuid("finding_id")
      .notNull()
      .references(() => categoryFindings.id, { onDelete: "cascade" }),
    tagId: uuid("tag_id")
      .notNull()
      .references(() => tags.id, { onDelete: "cascade" }),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    uniqueIndex("finding_tags_unique_idx").on(table.findingId, table.tagId),
    index("finding_tags_finding_idx").on(table.findingId),
    index("finding_tags_tag_idx").on(table.tagId),
  ]
);

// Finding Templates (reusable vulnerability knowledge base)

export const findingTemplates = pgTable(
  "finding_templates",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    title: varchar("title", { length: 255 }).notNull(),
    category: findingTemplateCategoryEnum("category").notNull().default("general"),
    overview: text("overview").notNull(),
    overviewFormat: varchar("overview_format", { length: 10 }).notNull().default("text"),
    impact: text("impact"),
    impactFormat: varchar("impact_format", { length: 10 }).notNull().default("text"),
    recommendation: text("recommendation"),
    recommendationFormat: varchar("recommendation_format", { length: 10 }).notNull().default("text"),
    severity: findingSeverityEnum("severity").notNull().default("medium"),
    cvssScore: numeric("cvss_score", { precision: 3, scale: 1 }),
    cvssVector: varchar("cvss_vector", { length: 150 }),
    isSystem: boolean("is_system").notNull().default(false),
    createdBy: uuid("created_by").references(() => users.id, {
      onDelete: "set null",
    }),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    index("finding_templates_category_idx").on(table.category),
    index("finding_templates_severity_idx").on(table.severity),
    index("finding_templates_title_idx").on(table.title),
  ]
);

// Finding Template ↔ Tag links (M:N)

export const findingTemplateTags = pgTable(
  "finding_template_tags",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    templateId: uuid("template_id")
      .notNull()
      .references(() => findingTemplates.id, { onDelete: "cascade" }),
    tagId: uuid("tag_id")
      .notNull()
      .references(() => tags.id, { onDelete: "cascade" }),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    uniqueIndex("finding_template_tags_unique_idx").on(
      table.templateId,
      table.tagId
    ),
    index("finding_template_tags_template_idx").on(table.templateId),
    index("finding_template_tags_tag_idx").on(table.tagId),
  ]
);

// Methodology Templates (reusable testing methodology descriptions)

export const methodologyTemplates = pgTable(
  "methodology_templates",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    name: varchar("name", { length: 255 }).notNull(),
    category: findingTemplateCategoryEnum("category")
      .notNull()
      .default("general"),
    content: text("content").notNull(),
    isSystem: boolean("is_system").notNull().default(false),
    createdBy: uuid("created_by").references(() => users.id, {
      onDelete: "set null",
    }),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    index("methodology_templates_category_idx").on(table.category),
    index("methodology_templates_name_idx").on(table.name),
  ]
);

// IP Geolocations (extracted IPs with country resolution)

export const ipSourceTypeEnum = pgEnum("ip_source_type", [
  "resource",
  "action",
  "finding",
]);

export const ipGeolocations = pgTable(
  "ip_geolocations",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    engagementId: uuid("engagement_id")
      .notNull()
      .references(() => engagements.id, { onDelete: "cascade" }),
    ip: varchar("ip", { length: 45 }).notNull(),
    countryCode: varchar("country_code", { length: 2 }),
    countryName: varchar("country_name", { length: 100 }),
    isManual: boolean("is_manual").notNull().default(false),
    isPrivate: boolean("is_private").notNull().default(false),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    uniqueIndex("ip_geolocations_engagement_ip_idx").on(
      table.engagementId,
      table.ip
    ),
    index("ip_geolocations_engagement_idx").on(table.engagementId),
    index("ip_geolocations_country_idx").on(table.countryCode),
  ]
);

// IP Geolocation Sources (tracks which resources/actions reference each IP)

export const ipGeolocationSources = pgTable(
  "ip_geolocation_sources",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    geolocationId: uuid("geolocation_id")
      .notNull()
      .references(() => ipGeolocations.id, { onDelete: "cascade" }),
    sourceType: ipSourceTypeEnum("source_type").notNull(),
    sourceId: uuid("source_id").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    uniqueIndex("ip_geo_sources_unique_idx").on(
      table.geolocationId,
      table.sourceType,
      table.sourceId
    ),
    index("ip_geo_sources_source_idx").on(table.sourceType, table.sourceId),
  ]
);

// Domain Resolutions (extracted domains resolved to IPs via DNS)

export const domainResolutions = pgTable(
  "domain_resolutions",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    engagementId: uuid("engagement_id")
      .notNull()
      .references(() => engagements.id, { onDelete: "cascade" }),
    domain: varchar("domain", { length: 255 }).notNull(),
    ip: varchar("ip", { length: 45 }),
    geolocationId: uuid("geolocation_id").references(
      () => ipGeolocations.id,
      { onDelete: "set null" }
    ),
    resolveError: varchar("resolve_error", { length: 255 }),
    resolvedAt: timestamp("resolved_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    uniqueIndex("domain_res_engagement_domain_ip_idx").on(
      table.engagementId,
      table.domain,
      table.ip
    ),
    index("domain_res_engagement_idx").on(table.engagementId),
    index("domain_res_geolocation_idx").on(table.geolocationId),
  ]
);

// Report Generation

export const reportFormatEnum = pgEnum("report_format", ["pdf", "docx"]);

export const reportStatusEnum = pgEnum("report_status", [
  "pending",
  "generating",
  "completed",
  "failed",
]);

export const reportConfigs = pgTable(
  "report_configs",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    engagementId: uuid("engagement_id")
      .notNull()
      .references(() => engagements.id, { onDelete: "cascade" }),
    name: varchar("name", { length: 255 }).notNull(),
    templateType: varchar("template_type", { length: 50 }).notNull(),
    sections: jsonb("sections").notNull().default([]),
    filters: jsonb("filters").notNull().default({}),
    metadata: jsonb("metadata").notNull().default({}),
    reportJson: jsonb("report_json"),
    designTemplateId: uuid("design_template_id").references(
      () => designTemplates.id,
      { onDelete: "set null" }
    ),
    createdBy: uuid("created_by")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    // QA review tracking
    qaRequestedAt: timestamp("qa_requested_at", { withTimezone: true }),
    qaSignedOffAt: timestamp("qa_signed_off_at", { withTimezone: true }),
    qaSignedOffBy: uuid("qa_signed_off_by").references(() => users.id, {
      onDelete: "set null",
    }),
  },
  (table) => [
    index("report_configs_engagement_idx").on(table.engagementId),
  ]
);

export const generatedReports = pgTable(
  "generated_reports",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    configId: uuid("config_id")
      .notNull()
      .references(() => reportConfigs.id, { onDelete: "cascade" }),
    engagementId: uuid("engagement_id")
      .notNull()
      .references(() => engagements.id, { onDelete: "cascade" }),
    format: reportFormatEnum("format").notNull(),
    status: reportStatusEnum("status").notNull().default("pending"),
    diskPath: varchar("disk_path", { length: 500 }),
    fileSize: integer("file_size"),
    errorMessage: text("error_message"),
    generatedBy: uuid("generated_by")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    generatedAt: timestamp("generated_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    index("generated_reports_config_idx").on(table.configId),
    index("generated_reports_engagement_idx").on(table.engagementId),
  ]
);

// Domain Resolution Sources (tracks which resources/actions reference each domain)

export const domainResolutionSources = pgTable(
  "domain_resolution_sources",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    resolutionId: uuid("resolution_id")
      .notNull()
      .references(() => domainResolutions.id, { onDelete: "cascade" }),
    sourceType: ipSourceTypeEnum("source_type").notNull(),
    sourceId: uuid("source_id").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    uniqueIndex("domain_res_sources_unique_idx").on(
      table.resolutionId,
      table.sourceType,
      table.sourceId
    ),
    index("domain_res_sources_source_idx").on(
      table.sourceType,
      table.sourceId
    ),
  ]
);

// Notifications (user-targeted events)

export const notificationTypeEnum = pgEnum("notification_type", [
  "member_joined",
  "member_removed",
  "member_role_changed",
  "member_assigned",
  "member_unassigned",
  "security_login_success",
  "security_login_failed",
  "security_password_changed",
  "security_totp_enabled",
  "engagement_status_changed",
  "comment_mention",
  "comment_reply",
  "security_session_hijack",
  "report_qa_requested",
  "report_qa_comment",
  "report_qa_signed_off",
]);

export const notifications = pgTable(
  "notifications",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    type: notificationTypeEnum("type").notNull(),
    engagementId: uuid("engagement_id").references(() => engagements.id, {
      onDelete: "cascade",
    }),
    actorId: uuid("actor_id").references(() => users.id, {
      onDelete: "cascade",
    }),
    metadata: jsonb("metadata").notNull().default({}),
    read: boolean("read").notNull().default(false),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    index("notifications_user_created_idx").on(table.userId, table.createdAt),
    index("notifications_engagement_idx").on(table.engagementId),
  ]
);

// Security Events (audit log for auth/security actions)

export const securityEventTypeEnum = pgEnum("security_event_type", [
  "user_registered",
  "login_success",
  "login_failed",
  "totp_login_success",
  "totp_invalid_code",
  "totp_decryption_failed",
  "file_decryption_failed",
  "totp_enabled",
  "totp_enable_password_failed",
  "password_changed",
  "password_change_failed",
  "password_change_totp_failed",
  "password_change_decrypt_failed",
  "account_deleted",
  "account_delete_failed",
  "recovery_code_login",
  "recovery_codes_generated",
  "recovery_codes_regenerated",
  "recovery_code_login_failed",
  "admin_user_disabled",
  "admin_user_enabled",
  "admin_user_deleted",
  "admin_force_password_reset",
  "admin_grant_admin",
  "admin_revoke_admin",
  "admin_settings_changed",
  "admin_password_reset",
  "admin_grant_coordinator",
  "admin_revoke_coordinator",
  "session_hijack_detected",
]);

export const securityEvents = pgTable(
  "security_events",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    eventType: securityEventTypeEnum("event_type").notNull(),
    userId: uuid("user_id").references(() => users.id, {
      onDelete: "set null",
    }),
    username: varchar("username", { length: 100 }),
    ipAddress: varchar("ip_address", { length: 45 }),
    userAgent: text("user_agent"),
    metadata: jsonb("metadata").notNull().default({}),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    index("security_events_type_idx").on(table.eventType),
    index("security_events_user_idx").on(table.userId),
    index("security_events_created_idx").on(table.createdAt),
    index("security_events_ip_idx").on(table.ipAddress),
  ]
);

// User Known IPs (for "new IP" login detection)

export const userKnownIps = pgTable(
  "user_known_ips",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    ipAddress: varchar("ip_address", { length: 45 }).notNull(),
    userAgent: text("user_agent"),
    firstSeenAt: timestamp("first_seen_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    lastSeenAt: timestamp("last_seen_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    uniqueIndex("user_known_ips_user_ip_idx").on(table.userId, table.ipAddress),
    index("user_known_ips_user_idx").on(table.userId),
  ]
);

// Platform Settings (admin-configurable key-value store)

export const platformSettings = pgTable("platform_settings", {
  key: varchar("key", { length: 100 }).primaryKey(),
  value: text("value").notNull(),
  updatedBy: uuid("updated_by").references(() => users.id, {
    onDelete: "set null",
  }),
  updatedAt: timestamp("updated_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
});

// Invite Codes (admin-provisioned registration)

export const inviteCodes = pgTable(
  "invite_codes",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    code: varchar("code", { length: 64 }).notNull().unique(),
    createdBy: uuid("created_by")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    usedBy: uuid("used_by").references(() => users.id, {
      onDelete: "set null",
    }),
    expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
    usedAt: timestamp("used_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    index("invite_codes_code_idx").on(table.code),
    index("invite_codes_created_by_idx").on(table.createdBy),
  ]
);

// Comments (threaded discussions on findings, actions, resources)

export const commentTargetTypeEnum = pgEnum("comment_target_type", [
  "finding",
  "action",
  "resource",
  "report_section",
]);

export const comments = pgTable(
  "comments",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    engagementId: uuid("engagement_id")
      .notNull()
      .references(() => engagements.id, { onDelete: "cascade" }),
    targetType: commentTargetTypeEnum("target_type").notNull(),
    targetId: uuid("target_id").notNull(),
    parentId: uuid("parent_id").references(
      (): AnyPgColumn => comments.id,
      { onDelete: "cascade" }
    ),
    authorId: uuid("author_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    content: text("content").notNull(),
    contentFormat: varchar("content_format", { length: 10 })
      .notNull()
      .default("markdown"),
    editedAt: timestamp("edited_at", { withTimezone: true }),
    deletedAt: timestamp("deleted_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    // QA review fields — only populated when targetType = 'report_section'
    qaStatus: varchar("qa_status", { length: 20 }),
    sectionKey: varchar("section_key", { length: 100 }),
    fieldPath: varchar("field_path", { length: 255 }),
    qaResolvedAt: timestamp("qa_resolved_at", { withTimezone: true }),
    qaResolvedBy: uuid("qa_resolved_by").references(() => users.id, {
      onDelete: "set null",
    }),
    qaApprovedAt: timestamp("qa_approved_at", { withTimezone: true }),
    qaApprovedBy: uuid("qa_approved_by").references(() => users.id, {
      onDelete: "set null",
    }),
  },
  (table) => [
    index("comments_target_idx").on(
      table.targetType,
      table.targetId,
      table.createdAt
    ),
    index("comments_engagement_idx").on(table.engagementId),
    index("comments_parent_idx").on(table.parentId),
    index("comments_author_idx").on(table.authorId),
  ]
);

// Scoping & Rules of Engagement

export const scopeTargetTypeEnum = pgEnum("scope_target_type", [
  "ip",
  "cidr",
  "domain",
  "url",
  "application",
  "network",
]);

export const scopeDocumentTypeEnum = pgEnum("scope_document_type", [
  "authorization_letter",
  "msa",
  "sow",
  "nda",
  "other",
]);

export const scopeTargets = pgTable(
  "scope_targets",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    engagementId: uuid("engagement_id")
      .notNull()
      .references(() => engagements.id, { onDelete: "cascade" }),
    type: scopeTargetTypeEnum("type").notNull(),
    value: varchar("value", { length: 500 }).notNull(),
    notes: text("notes"),
    createdBy: uuid("created_by")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    index("scope_targets_engagement_idx").on(table.engagementId),
    index("scope_targets_type_idx").on(table.engagementId, table.type),
  ]
);

export const scopeExclusions = pgTable(
  "scope_exclusions",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    engagementId: uuid("engagement_id")
      .notNull()
      .references(() => engagements.id, { onDelete: "cascade" }),
    type: scopeTargetTypeEnum("type").notNull(),
    value: varchar("value", { length: 500 }).notNull(),
    justification: text("justification").notNull(),
    createdBy: uuid("created_by")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    index("scope_exclusions_engagement_idx").on(table.engagementId),
  ]
);

export const scopeConstraints = pgTable(
  "scope_constraints",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    engagementId: uuid("engagement_id")
      .notNull()
      .references(() => engagements.id, { onDelete: "cascade" }),
    constraint: text("constraint").notNull(),
    createdBy: uuid("created_by")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    index("scope_constraints_engagement_idx").on(table.engagementId),
  ]
);

export const contacts = pgTable(
  "contacts",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    engagementId: uuid("engagement_id")
      .notNull()
      .references(() => engagements.id, { onDelete: "cascade" }),
    name: varchar("name", { length: 255 }).notNull(),
    title: varchar("title", { length: 255 }),
    email: varchar("email", { length: 255 }),
    encryptedPhone: text("encrypted_phone"),
    isPrimary: boolean("is_primary").notNull().default(false),
    sortOrder: integer("sort_order").notNull().default(0),
    createdBy: uuid("created_by")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    index("contacts_engagement_idx").on(table.engagementId),
  ]
);

export const scopeDocuments = pgTable(
  "scope_documents",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    engagementId: uuid("engagement_id")
      .notNull()
      .references(() => engagements.id, { onDelete: "cascade" }),
    documentType: scopeDocumentTypeEnum("document_type").notNull(),
    name: varchar("name", { length: 255 }).notNull(),
    description: text("description"),
    referenceNumber: varchar("reference_number", { length: 100 }),
    diskPath: varchar("disk_path", { length: 500 }).notNull(),
    originalFilename: varchar("original_filename", { length: 500 }).notNull(),
    mimeType: varchar("mime_type", { length: 255 }).notNull(),
    fileSize: bigint("file_size", { mode: "number" }).notNull(),
    createdBy: uuid("created_by")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    index("scope_documents_engagement_idx").on(table.engagementId),
  ]
);

// Design Templates for Reports

export const designTemplates = pgTable(
  "design_templates",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    name: varchar("name", { length: 255 }).notNull(),
    description: text("description"),
    theme: jsonb("theme").notNull(),
    mdxSource: text("mdx_source"),
    logoDiskPath: varchar("logo_disk_path", { length: 500 }),
    logoFilename: varchar("logo_filename", { length: 500 }),
    logoMimeType: varchar("logo_mime_type", { length: 100 }),
    logoWidth: integer("logo_width"),
    logoHeight: integer("logo_height"),
    logoPosition: varchar("logo_position", { length: 20 }),
    isSystem: boolean("is_system").notNull().default(false),
    isDefault: boolean("is_default").notNull().default(false),
    createdBy: uuid("created_by").references(() => users.id, {
      onDelete: "set null",
    }),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    index("design_templates_created_by_idx").on(table.createdBy),
  ]
);

// ── Arsenal (Global Tools & Tactics) ────────────────────────────

export const arsenalToolCategoryEnum = pgEnum("arsenal_tool_category", [
  "reconnaissance",
  "scanning",
  "exploitation",
  "post_exploitation",
  "privilege_escalation",
  "credential_access",
  "lateral_movement",
  "persistence",
  "exfiltration",
  "command_and_control",
  "defense_evasion",
  "reporting",
  "utility",
  "general",
]);

export const arsenalTacticCategoryEnum = pgEnum("arsenal_tactic_category", [
  "initial_access",
  "execution",
  "persistence",
  "privilege_escalation",
  "defense_evasion",
  "credential_access",
  "discovery",
  "lateral_movement",
  "collection",
  "exfiltration",
  "command_and_control",
  "impact",
  "general",
]);

export const arsenalTools = pgTable(
  "arsenal_tools",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    name: varchar("name", { length: 255 }).notNull(),
    description: text("description"),
    url: varchar("url", { length: 2048 }),
    category: arsenalToolCategoryEnum("category").notNull().default("general"),
    notes: text("notes"),
    notesFormat: varchar("notes_format", { length: 10 }).notNull().default("text"),
    createdBy: uuid("created_by")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    index("arsenal_tools_category_idx").on(table.category),
    index("arsenal_tools_name_idx").on(table.name),
    index("arsenal_tools_created_by_idx").on(table.createdBy),
  ]
);

export const arsenalTactics = pgTable(
  "arsenal_tactics",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    name: varchar("name", { length: 255 }).notNull(),
    description: text("description"),
    content: text("content"),
    contentFormat: varchar("content_format", { length: 10 }).notNull().default("text"),
    category: arsenalTacticCategoryEnum("category").notNull().default("general"),
    createdBy: uuid("created_by")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    index("arsenal_tactics_category_idx").on(table.category),
    index("arsenal_tactics_name_idx").on(table.name),
    index("arsenal_tactics_created_by_idx").on(table.createdBy),
  ]
);

// Arsenal Tactic ↔ Tag links (M:N for MITRE ATT&CK tags)

export const arsenalTacticTags = pgTable(
  "arsenal_tactic_tags",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    tacticId: uuid("tactic_id")
      .notNull()
      .references(() => arsenalTactics.id, { onDelete: "cascade" }),
    tagId: uuid("tag_id")
      .notNull()
      .references(() => tags.id, { onDelete: "cascade" }),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    uniqueIndex("arsenal_tactic_tags_unique_idx").on(table.tacticId, table.tagId),
    index("arsenal_tactic_tags_tactic_idx").on(table.tacticId),
    index("arsenal_tactic_tags_tag_idx").on(table.tagId),
  ]
);

// Arsenal Tool ↔ Tactic links (M:N)

export const arsenalToolTactics = pgTable(
  "arsenal_tool_tactics",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    toolId: uuid("tool_id")
      .notNull()
      .references(() => arsenalTools.id, { onDelete: "cascade" }),
    tacticId: uuid("tactic_id")
      .notNull()
      .references(() => arsenalTactics.id, { onDelete: "cascade" }),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    uniqueIndex("arsenal_tool_tactics_unique_idx").on(table.toolId, table.tacticId),
    index("arsenal_tool_tactics_tool_idx").on(table.toolId),
    index("arsenal_tool_tactics_tactic_idx").on(table.tacticId),
  ]
);

// URL Preview Cache (for tool link cards)

export const urlPreviewCache = pgTable(
  "url_preview_cache",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    url: varchar("url", { length: 2048 }).notNull().unique(),
    type: varchar("type", { length: 20 }).notNull(), // 'github' | 'opengraph'
    title: varchar("title", { length: 500 }),
    description: text("description"),
    imageUrl: varchar("image_url", { length: 2048 }),
    githubStars: integer("github_stars"),
    githubLanguage: varchar("github_language", { length: 100 }),
    githubTopics: jsonb("github_topics"), // string[]
    githubFullName: varchar("github_full_name", { length: 255 }),
    fetchedAt: timestamp("fetched_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
  },
  (table) => [
    index("url_preview_cache_expires_idx").on(table.expiresAt),
  ]
);

// ── AI Chat ─────────────────────────────────────────────────────

export const chatMessageRoleEnum = pgEnum("chat_message_role", [
  "user",
  "assistant",
  "system",
]);

export const chatSessions = pgTable(
  "chat_sessions",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    engagementId: uuid("engagement_id")
      .notNull()
      .references(() => engagements.id, { onDelete: "cascade" }),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    title: varchar("title", { length: 255 }),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    index("chat_sessions_engagement_user_idx").on(
      table.engagementId,
      table.userId
    ),
    index("chat_sessions_user_idx").on(table.userId),
  ]
);

export const chatMessages = pgTable(
  "chat_messages",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    sessionId: uuid("session_id")
      .notNull()
      .references(() => chatSessions.id, { onDelete: "cascade" }),
    role: chatMessageRoleEnum("role").notNull(),
    content: text("content").notNull(),
    toolCalls: jsonb("tool_calls"),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    index("chat_messages_session_idx").on(table.sessionId, table.createdAt),
  ]
);
