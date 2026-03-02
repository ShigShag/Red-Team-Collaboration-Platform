import { z } from "zod";

const passwordSchema = z
  .string()
  .min(12, "Password must be at least 12 characters")
  .max(128, "Password must be under 128 characters")
  .refine((pw) => /[a-z]/.test(pw) && /[A-Z]/.test(pw), {
    message: "Password must contain uppercase and lowercase letters",
  })
  .refine((pw) => /\d/.test(pw), {
    message: "Password must contain a number",
  })
  .refine((pw) => /[^a-zA-Z0-9]/.test(pw), {
    message: "Password must contain a special character",
  });

export const registerSchema = z
  .object({
    username: z
      .string()
      .min(3, "Username must be at least 3 characters")
      .max(100, "Username must be under 100 characters")
      .regex(
        /^[a-zA-Z0-9_-]+$/,
        "Username can only contain letters, numbers, hyphens, and underscores"
      ),
    password: passwordSchema,
    confirmPassword: z.string(),
  })
  .refine((data) => data.password === data.confirmPassword, {
    message: "Passwords do not match",
    path: ["confirmPassword"],
  });

export const loginSchema = z.object({
  username: z.string().min(1, "Username is required"),
  password: z.string().min(1, "Password is required"),
});

export const totpSchema = z.object({
  code: z
    .string()
    .length(6, "Code must be 6 digits")
    .regex(/^\d+$/, "Code must be numeric"),
});

export const recoveryCodeSchema = z.object({
  code: z
    .string()
    .min(8, "Recovery code must be at least 8 characters")
    .max(9, "Recovery code is too long")
    .regex(/^[a-zA-Z0-9-]+$/, "Recovery code must be alphanumeric"),
});

export const enableTotpSchema = z.object({
  code: z
    .string()
    .length(6, "Code must be 6 digits")
    .regex(/^\d+$/, "Code must be numeric"),
  password: z.string().min(1, "Password is required"),
});

export const changePasswordSchema = z
  .object({
    currentPassword: z.string().min(1, "Current password is required"),
    newPassword: passwordSchema,
    confirmNewPassword: z.string(),
    totpCode: z.string().optional(),
  })
  .refine((data) => data.newPassword === data.confirmNewPassword, {
    message: "Passwords do not match",
    path: ["confirmNewPassword"],
  });

// Engagements

export const createEngagementSchema = z.object({
  name: z
    .string()
    .min(1, "Engagement name is required")
    .max(255, "Name must be under 255 characters"),
  description: z
    .string()
    .max(1000, "Description must be under 1000 characters")
    .optional(),
  startDate: z.string().optional(),
  endDate: z.string().optional(),
});

export const updateTimespanSchema = z.object({
  startDate: z.string().optional(),
  endDate: z.string().optional(),
});

export const updateEngagementDetailsSchema = z.object({
  name: z
    .string()
    .min(1, "Engagement name is required")
    .max(255, "Name must be under 255 characters"),
  description: z
    .string()
    .max(1000, "Description must be under 1000 characters")
    .optional(),
});

export const addMemberSchema = z.object({
  username: z.string().min(1, "Username is required"),
  role: z.enum(["read", "write", "owner"], {
    error: "Role must be read, write, or owner",
  }),
});

export const updateMemberRoleSchema = z.object({
  memberId: z.string().uuid("Invalid member ID"),
  role: z.enum(["read", "write", "owner"], {
    error: "Role must be read, write, or owner",
  }),
});

// Categories

export const createCategorySchema = z.object({
  presetId: z.string().uuid("A category type is required"),
  name: z
    .string()
    .min(1, "Category name is required")
    .max(150, "Name must be under 150 characters"),
  color: z
    .string()
    .regex(/^#[0-9a-fA-F]{6}$/, "Invalid color format")
    .optional(),
  description: z
    .string()
    .max(500, "Description must be under 500 characters")
    .optional(),
});

export const categoryAssignmentSchema = z.object({
  categoryId: z.string().uuid("Invalid category ID"),
  userId: z.string().uuid("Invalid user ID"),
});

// Category Presets

export const createPresetSchema = z.object({
  name: z
    .string()
    .min(1, "Preset name is required")
    .max(100, "Name must be under 100 characters"),
  icon: z
    .string()
    .min(1, "An icon is required")
    .max(50, "Icon must be under 50 characters"),
  color: z
    .string()
    .regex(/^#[0-9a-fA-F]{6}$/, "Invalid color format")
    .optional(),
  description: z
    .string()
    .max(500, "Description must be under 500 characters")
    .optional(),
});

export const updatePresetSchema = z.object({
  presetId: z.string().uuid("Invalid preset ID"),
  name: z
    .string()
    .min(1, "Preset name is required")
    .max(100, "Name must be under 100 characters"),
  icon: z
    .string()
    .min(1, "An icon is required")
    .max(50, "Icon must be under 50 characters"),
  color: z
    .string()
    .regex(/^#[0-9a-fA-F]{6}$/, "Invalid color format")
    .optional(),
  description: z
    .string()
    .max(500, "Description must be under 500 characters")
    .optional(),
});

export const deletePresetSchema = z.object({
  presetId: z.string().uuid("Invalid preset ID"),
});

export const updateCategorySchema = z.object({
  categoryId: z.string().uuid("Invalid category ID"),
  name: z
    .string()
    .min(1, "Category name is required")
    .max(150, "Name must be under 150 characters"),
  color: z
    .string()
    .regex(/^#[0-9a-fA-F]{6}$/, "Invalid color format")
    .optional(),
  description: z
    .string()
    .max(500, "Description must be under 500 characters")
    .optional(),
});

// Sub-categories

export const createSubCategorySchema = z.object({
  parentId: z.string().uuid("Invalid parent category ID"),
  presetId: z.string().uuid("A category type is required"),
  name: z
    .string()
    .min(1, "Category name is required")
    .max(150, "Name must be under 150 characters"),
  color: z
    .string()
    .regex(/^#[0-9a-fA-F]{6}$/, "Invalid color format")
    .optional(),
  description: z
    .string()
    .max(500, "Description must be under 500 characters")
    .optional(),
});

// Resources

export const createResourceSchema = z.object({
  categoryId: z.string().uuid("Invalid category ID"),
  name: z
    .string()
    .min(1, "Resource name is required")
    .max(255, "Name must be under 255 characters"),
  description: z
    .string()
    .max(1000, "Description must be under 1000 characters")
    .optional(),
  templateId: z.string().uuid("Invalid template ID").optional(),
});

export const resourceFieldSchema = z.object({
  key: z
    .string()
    .min(1, "Field key is required")
    .max(100, "Key must be under 100 characters"),
  label: z
    .string()
    .min(1, "Field label is required")
    .max(150, "Label must be under 150 characters"),
  type: z.enum(["text", "secret", "url", "code"], {
    error: "Field type must be text, secret, url, or code",
  }),
  value: z.string().max(500_000, "Value too large").optional(),
  language: z.string().max(30, "Language identifier too long").optional(),
});

export const updateResourceSchema = z.object({
  resourceId: z.string().uuid("Invalid resource ID"),
  name: z
    .string()
    .min(1, "Resource name is required")
    .max(255, "Name must be under 255 characters"),
  description: z
    .string()
    .max(1000, "Description must be under 1000 characters")
    .optional(),
});

export const createResourceTemplateSchema = z.object({
  name: z
    .string()
    .min(1, "Template name is required")
    .max(100, "Name must be under 100 characters"),
  icon: z
    .string()
    .min(1, "An icon is required")
    .max(50, "Icon must be under 50 characters"),
  color: z
    .string()
    .regex(/^#[0-9a-fA-F]{6}$/, "Invalid color format")
    .optional(),
  description: z
    .string()
    .max(500, "Description must be under 500 characters")
    .optional(),
  fields: z.array(
    z.object({
      key: z.string().min(1).max(100),
      label: z.string().min(1).max(150),
      type: z.enum(["text", "secret", "url", "code"]),
      required: z.boolean().optional(),
      language: z.string().max(30).optional(),
    })
  ),
});

export const updateResourceTemplateSchema = z.object({
  templateId: z.string().uuid("Invalid template ID"),
  name: z
    .string()
    .min(1, "Template name is required")
    .max(100, "Name must be under 100 characters"),
  icon: z
    .string()
    .min(1, "An icon is required")
    .max(50, "Icon must be under 50 characters"),
  color: z
    .string()
    .regex(/^#[0-9a-fA-F]{6}$/, "Invalid color format")
    .optional(),
  description: z
    .string()
    .max(500, "Description must be under 500 characters")
    .optional(),
  fields: z.array(
    z.object({
      key: z.string().min(1).max(100),
      label: z.string().min(1).max(150),
      type: z.enum(["text", "secret", "url", "code"]),
      required: z.boolean().optional(),
      language: z.string().max(30).optional(),
    })
  ),
});

export const deleteResourceTemplateSchema = z.object({
  templateId: z.string().uuid("Invalid template ID"),
});

// Actions

export const createActionSchema = z.object({
  categoryId: z.string().uuid("Invalid category ID"),
  title: z
    .string()
    .min(1, "Action title is required")
    .max(255, "Title must be under 255 characters"),
  content: z
    .string()
    .min(1, "Action content is required"),
  contentFormat: z.enum(["text", "markdown"]).default("text"),
  performedAt: z.string().optional(),
  resourceIds: z.array(z.string().uuid("Invalid resource ID")).optional(),
  tagIds: z.array(z.string().uuid("Invalid tag ID")).optional(),
});

export const updateActionSchema = z.object({
  actionId: z.string().uuid("Invalid action ID"),
  title: z
    .string()
    .min(1, "Action title is required")
    .max(255, "Title must be under 255 characters"),
  content: z
    .string()
    .min(1, "Action content is required"),
  contentFormat: z.enum(["text", "markdown"]).default("text"),
  performedAt: z.string().optional(),
  tagIds: z.array(z.string().uuid("Invalid tag ID")).optional(),
});

// Action ↔ Resource link

export const linkActionResourceSchema = z.object({
  actionId: z.string().uuid("Invalid action ID"),
  resourceId: z.string().uuid("Invalid resource ID"),
});

// Action ↔ Tag link

export const linkActionTagSchema = z.object({
  actionId: z.string().uuid("Invalid action ID"),
  tagId: z.string().uuid("Invalid tag ID"),
});

// Findings

export const createFindingSchema = z.object({
  categoryId: z.string().uuid("Invalid category ID"),
  title: z
    .string()
    .min(1, "Finding title is required")
    .max(255, "Title must be under 255 characters"),
  overview: z
    .string()
    .min(1, "Overview is required"),
  overviewFormat: z.enum(["text", "markdown"]).default("text"),
  impact: z.string().optional(),
  impactFormat: z.enum(["text", "markdown"]).default("text"),
  recommendation: z.string().optional(),
  recommendationFormat: z.enum(["text", "markdown"]).default("text"),
  severity: z.enum(["critical", "high", "medium", "low", "info", "fixed"]).default("medium"),
  cvssScore: z.number().min(0).max(10).nullable().optional(),
  cvssVector: z.string().max(150).nullable().optional(),
  resourceIds: z.array(z.string().uuid("Invalid resource ID")).optional(),
  tagIds: z.array(z.string().uuid("Invalid tag ID")).optional(),
});

export const updateFindingSchema = z.object({
  findingId: z.string().uuid("Invalid finding ID"),
  title: z
    .string()
    .min(1, "Finding title is required")
    .max(255, "Title must be under 255 characters"),
  overview: z
    .string()
    .min(1, "Overview is required"),
  overviewFormat: z.enum(["text", "markdown"]).default("text"),
  impact: z.string().optional(),
  impactFormat: z.enum(["text", "markdown"]).default("text"),
  recommendation: z.string().optional(),
  recommendationFormat: z.enum(["text", "markdown"]).default("text"),
  severity: z.enum(["critical", "high", "medium", "low", "info", "fixed"]).default("medium"),
  cvssScore: z.number().min(0).max(10).nullable().optional(),
  cvssVector: z.string().max(150).nullable().optional(),
  resourceIds: z.array(z.string().uuid("Invalid resource ID")).optional(),
  tagIds: z.array(z.string().uuid("Invalid tag ID")).optional(),
});

// Finding ↔ Resource link

export const linkFindingResourceSchema = z.object({
  findingId: z.string().uuid("Invalid finding ID"),
  resourceId: z.string().uuid("Invalid resource ID"),
});

// Finding ↔ Tag link

export const linkFindingTagSchema = z.object({
  findingId: z.string().uuid("Invalid finding ID"),
  tagId: z.string().uuid("Invalid tag ID"),
});

// Finding Templates

export const findingTemplateCategoryValues = [
  "web", "network", "cloud", "mobile", "wireless",
  "social_engineering", "physical", "api", "active_directory",
  "code_review", "general",
] as const;

export const createFindingTemplateSchema = z.object({
  title: z
    .string()
    .min(1, "Template title is required")
    .max(255, "Title must be under 255 characters"),
  category: z.enum(findingTemplateCategoryValues, {
    error: "Invalid template category",
  }).default("general"),
  overview: z
    .string()
    .min(1, "Overview is required"),
  overviewFormat: z.enum(["text", "markdown"]).default("text"),
  impact: z.string().optional(),
  impactFormat: z.enum(["text", "markdown"]).default("text"),
  recommendation: z.string().optional(),
  recommendationFormat: z.enum(["text", "markdown"]).default("text"),
  severity: z.enum(["critical", "high", "medium", "low", "info", "fixed"]).default("medium"),
  cvssScore: z.number().min(0).max(10).nullable().optional(),
  cvssVector: z.string().max(150).nullable().optional(),
  tagIds: z.array(z.string().uuid("Invalid tag ID")).optional(),
});

export const updateFindingTemplateSchema = z.object({
  templateId: z.string().uuid("Invalid template ID"),
  title: z
    .string()
    .min(1, "Template title is required")
    .max(255, "Title must be under 255 characters"),
  category: z.enum(findingTemplateCategoryValues, {
    error: "Invalid template category",
  }),
  overview: z
    .string()
    .min(1, "Overview is required"),
  overviewFormat: z.enum(["text", "markdown"]).default("text"),
  impact: z.string().optional(),
  impactFormat: z.enum(["text", "markdown"]).default("text"),
  recommendation: z.string().optional(),
  recommendationFormat: z.enum(["text", "markdown"]).default("text"),
  severity: z.enum(["critical", "high", "medium", "low", "info", "fixed"]).default("medium"),
  cvssScore: z.number().min(0).max(10).nullable().optional(),
  cvssVector: z.string().max(150).nullable().optional(),
  tagIds: z.array(z.string().uuid("Invalid tag ID")).optional(),
});

export const deleteFindingTemplateSchema = z.object({
  templateId: z.string().uuid("Invalid template ID"),
});

// Custom tags

export const createTagSchema = z.object({
  name: z
    .string()
    .min(1, "Tag name is required")
    .max(255, "Name must be under 255 characters"),
  description: z
    .string()
    .max(1000, "Description must be under 1000 characters")
    .optional(),
});

// Design Templates

export const createDesignTemplateSchema = z.object({
  name: z.string().min(1, "Template name is required").max(255),
  description: z.string().max(1000, "Description must be under 1000 characters").optional(),
  theme: z.string().min(1, "Theme configuration is required"), // JSON-stringified DesignTheme (without logo)
});

export const updateDesignTemplateSchema = z.object({
  templateId: z.string().uuid("Invalid template ID"),
  name: z.string().min(1, "Template name is required").max(255),
  description: z.string().max(1000, "Description must be under 1000 characters").optional(),
  theme: z.string().min(1, "Theme configuration is required"),
});

export const deleteDesignTemplateSchema = z.object({
  templateId: z.string().uuid("Invalid template ID"),
});

// Scoping & Rules of Engagement

export const addScopeTargetSchema = z.object({
  type: z.enum(["ip", "cidr", "domain", "url", "application", "network"], {
    error: "Invalid scope target type",
  }),
  value: z
    .string()
    .min(1, "Value is required")
    .max(500, "Value must be under 500 characters"),
  notes: z
    .string()
    .max(2000, "Notes must be under 2000 characters")
    .optional(),
});

export const addScopeExclusionSchema = z.object({
  type: z.enum(["ip", "cidr", "domain", "url", "application", "network"], {
    error: "Invalid scope target type",
  }),
  value: z
    .string()
    .min(1, "Value is required")
    .max(500, "Value must be under 500 characters"),
  justification: z
    .string()
    .min(1, "Justification is required")
    .max(2000, "Justification must be under 2000 characters"),
});

export const addScopeConstraintSchema = z.object({
  constraint: z
    .string()
    .min(1, "Constraint text is required")
    .max(2000, "Constraint must be under 2000 characters"),
});

export const addContactSchema = z.object({
  name: z
    .string()
    .min(1, "Name is required")
    .max(255, "Name must be under 255 characters"),
  title: z
    .string()
    .max(255, "Title must be under 255 characters")
    .optional(),
  email: z
    .string()
    .email("Invalid email address")
    .max(255)
    .optional()
    .or(z.literal("")),
  phone: z
    .string()
    .max(50, "Phone must be under 50 characters")
    .optional(),
  isPrimary: z.boolean().optional(),
});

// Global Search

export const globalSearchSchema = z.object({
  q: z.string().min(2, "Search query must be at least 2 characters").max(100, "Search query too long"),
  type: z.enum(["all", "engagements", "findings", "actions", "resources", "scope"]).default("all"),
  limit: z.coerce.number().int().min(1).max(20).default(5),
});

// Engagement Export

export const exportEngagementSchema = z.object({
  format: z.enum(["full", "simple"]).default("full"),
  categoryIds: z.array(z.string().uuid()).optional(),
  includeScope: z.boolean().default(true),
  includeIPs: z.boolean().default(true),
  includeAuditLog: z.boolean().default(false),
  includeComments: z.boolean().default(true),
});

// Notifications

export const notificationActionSchema = z.object({
  notificationId: z.string().uuid().optional(),
});

// Chat Sessions

export const chatSessionCreateSchema = z.object({
  engagementId: z.string().uuid("Invalid engagement ID"),
});

// Arsenal — Tools & Tactics

export const arsenalToolCategoryValues = [
  "reconnaissance", "scanning", "exploitation", "post_exploitation",
  "privilege_escalation", "credential_access", "lateral_movement",
  "persistence", "exfiltration", "command_and_control", "defense_evasion",
  "reporting", "utility", "general",
] as const;

export const arsenalTacticCategoryValues = [
  "initial_access", "execution", "persistence", "privilege_escalation",
  "defense_evasion", "credential_access", "discovery", "lateral_movement",
  "collection", "exfiltration", "command_and_control", "impact", "general",
] as const;

export const createArsenalToolSchema = z.object({
  name: z
    .string()
    .min(1, "Tool name is required")
    .max(255, "Name must be under 255 characters"),
  description: z
    .string()
    .max(2000, "Description must be under 2000 characters")
    .optional(),
  url: z
    .string()
    .url("Must be a valid URL")
    .max(2048, "URL must be under 2048 characters")
    .optional()
    .or(z.literal("")),
  category: z.enum(arsenalToolCategoryValues, {
    error: "Invalid tool category",
  }).default("general"),
  notes: z.string().optional(),
  notesFormat: z.enum(["text", "markdown"]).default("text"),
  tacticIds: z.array(z.string().uuid("Invalid tactic ID")).optional(),
});

export const updateArsenalToolSchema = z.object({
  toolId: z.string().uuid("Invalid tool ID"),
  name: z
    .string()
    .min(1, "Tool name is required")
    .max(255, "Name must be under 255 characters"),
  description: z
    .string()
    .max(2000, "Description must be under 2000 characters")
    .optional(),
  url: z
    .string()
    .url("Must be a valid URL")
    .max(2048, "URL must be under 2048 characters")
    .optional()
    .or(z.literal("")),
  category: z.enum(arsenalToolCategoryValues, {
    error: "Invalid tool category",
  }),
  notes: z.string().optional(),
  notesFormat: z.enum(["text", "markdown"]).default("text"),
  tacticIds: z.array(z.string().uuid("Invalid tactic ID")).optional(),
});

export const deleteArsenalToolSchema = z.object({
  toolId: z.string().uuid("Invalid tool ID"),
});

export const createArsenalTacticSchema = z.object({
  name: z
    .string()
    .min(1, "Tactic name is required")
    .max(255, "Name must be under 255 characters"),
  description: z
    .string()
    .max(2000, "Description must be under 2000 characters")
    .optional(),
  content: z.string().optional(),
  contentFormat: z.enum(["text", "markdown"]).default("text"),
  category: z.enum(arsenalTacticCategoryValues, {
    error: "Invalid tactic category",
  }).default("general"),
  tagIds: z.array(z.string().uuid("Invalid tag ID")).optional(),
  toolIds: z.array(z.string().uuid("Invalid tool ID")).optional(),
});

export const updateArsenalTacticSchema = z.object({
  tacticId: z.string().uuid("Invalid tactic ID"),
  name: z
    .string()
    .min(1, "Tactic name is required")
    .max(255, "Name must be under 255 characters"),
  description: z
    .string()
    .max(2000, "Description must be under 2000 characters")
    .optional(),
  content: z.string().optional(),
  contentFormat: z.enum(["text", "markdown"]).default("text"),
  category: z.enum(arsenalTacticCategoryValues, {
    error: "Invalid tactic category",
  }),
  tagIds: z.array(z.string().uuid("Invalid tag ID")).optional(),
  toolIds: z.array(z.string().uuid("Invalid tool ID")).optional(),
});

export const deleteArsenalTacticSchema = z.object({
  tacticId: z.string().uuid("Invalid tactic ID"),
});

export const urlPreviewSchema = z.object({
  url: z.string().url("Must be a valid URL").max(2048),
});
