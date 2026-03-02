-- Invite codes for admin-provisioned registration
CREATE TABLE "invite_codes" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "code" varchar(64) NOT NULL UNIQUE,
  "created_by" uuid NOT NULL REFERENCES "users"("id") ON DELETE CASCADE,
  "used_by" uuid REFERENCES "users"("id") ON DELETE SET NULL,
  "expires_at" timestamptz NOT NULL,
  "used_at" timestamptz,
  "created_at" timestamptz NOT NULL DEFAULT NOW()
);

CREATE INDEX "invite_codes_code_idx" ON "invite_codes" ("code");
CREATE INDEX "invite_codes_created_by_idx" ON "invite_codes" ("created_by");
