-- Platform settings (admin-configurable key-value store)
CREATE TABLE "platform_settings" (
  "key" varchar(100) PRIMARY KEY,
  "value" text NOT NULL,
  "updated_by" uuid REFERENCES "users"("id") ON DELETE SET NULL,
  "updated_at" timestamptz NOT NULL DEFAULT NOW()
);

-- Seed default settings
INSERT INTO "platform_settings" ("key", "value") VALUES
  ('registration_mode', 'open'),
  ('session_ttl_hours', '24'),
  ('require_2fa', 'false');
