-- Recovery codes table (Argon2id-hashed backup codes for 2FA)
CREATE TABLE "recovery_codes" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "user_id" uuid NOT NULL REFERENCES "users"("id") ON DELETE CASCADE,
  "code_hash" text NOT NULL,
  "created_at" timestamptz NOT NULL DEFAULT NOW()
);

CREATE INDEX "recovery_codes_user_idx" ON "recovery_codes" ("user_id");

-- Security event types for recovery code operations
ALTER TYPE "security_event_type" ADD VALUE 'recovery_code_login';
ALTER TYPE "security_event_type" ADD VALUE 'recovery_codes_generated';
ALTER TYPE "security_event_type" ADD VALUE 'recovery_codes_regenerated';
ALTER TYPE "security_event_type" ADD VALUE 'recovery_code_login_failed';
