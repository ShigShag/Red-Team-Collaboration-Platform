ALTER TYPE "notification_type" ADD VALUE 'security_login_success';
--> statement-breakpoint
ALTER TYPE "notification_type" ADD VALUE 'security_login_failed';
--> statement-breakpoint
ALTER TYPE "notification_type" ADD VALUE 'security_password_changed';
--> statement-breakpoint
ALTER TYPE "notification_type" ADD VALUE 'security_totp_enabled';
--> statement-breakpoint
ALTER TABLE "notifications" ALTER COLUMN "engagement_id" DROP NOT NULL;
--> statement-breakpoint
ALTER TABLE "notifications" ALTER COLUMN "actor_id" DROP NOT NULL;
--> statement-breakpoint
CREATE TABLE "user_known_ips" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "user_id" uuid NOT NULL REFERENCES "users"("id") ON DELETE CASCADE,
  "ip_address" varchar(45) NOT NULL,
  "user_agent" text,
  "first_seen_at" timestamptz NOT NULL DEFAULT NOW(),
  "last_seen_at" timestamptz NOT NULL DEFAULT NOW()
);
--> statement-breakpoint
CREATE UNIQUE INDEX "user_known_ips_user_ip_idx" ON "user_known_ips" ("user_id", "ip_address");
--> statement-breakpoint
CREATE INDEX "user_known_ips_user_idx" ON "user_known_ips" ("user_id");
