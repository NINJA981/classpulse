CREATE TYPE "public"."notification_kind" AS ENUM('lesson.transcribed', 'lesson.ready', 'lesson.failed', 'resource.ready', 'resource.failed', 'deploy.succeeded', 'deploy.failed');--> statement-breakpoint
CREATE TYPE "public"."notification_tone" AS ENUM('success', 'error', 'info');--> statement-breakpoint
CREATE TABLE "notifications" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"institution_id" uuid,
	"user_id" uuid,
	"platform_admin_id" uuid,
	"kind" "notification_kind" NOT NULL,
	"tone" "notification_tone" NOT NULL,
	"title" varchar(200) NOT NULL,
	"body" varchar(500),
	"link" varchar(300),
	"entity_type" varchar(20),
	"entity_id" uuid,
	"entity_attempt" integer,
	"dedupe_key" varchar(200),
	"read_at" timestamp with time zone,
	"created_at" timestamp (3) with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "notifications_one_recipient" CHECK (("notifications"."user_id" is not null and "notifications"."platform_admin_id" is null and "notifications"."institution_id" is not null) or ("notifications"."user_id" is null and "notifications"."platform_admin_id" is not null))
);
--> statement-breakpoint
CREATE TABLE "push_subscriptions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"institution_id" uuid,
	"user_id" uuid,
	"platform_admin_id" uuid,
	"endpoint" varchar(500) NOT NULL,
	"endpoint_hash" varchar(64) NOT NULL,
	"p256dh" varchar(128) NOT NULL,
	"auth" varchar(64) NOT NULL,
	"user_agent" varchar(200),
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"last_success_at" timestamp with time zone,
	"failure_count" integer DEFAULT 0 NOT NULL,
	CONSTRAINT "push_subscriptions_one_recipient" CHECK (("push_subscriptions"."user_id" is not null and "push_subscriptions"."platform_admin_id" is null and "push_subscriptions"."institution_id" is not null) or ("push_subscriptions"."user_id" is null and "push_subscriptions"."platform_admin_id" is not null))
);
--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "notification_prefs" jsonb DEFAULT '{"push":true}'::jsonb NOT NULL;--> statement-breakpoint
ALTER TABLE "platform_admins" ADD COLUMN "notification_prefs" jsonb DEFAULT '{"push":true}'::jsonb NOT NULL;--> statement-breakpoint
ALTER TABLE "notifications" ADD CONSTRAINT "notifications_institution_id_institutions_id_fk" FOREIGN KEY ("institution_id") REFERENCES "public"."institutions"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "notifications" ADD CONSTRAINT "notifications_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "notifications" ADD CONSTRAINT "notifications_platform_admin_id_platform_admins_id_fk" FOREIGN KEY ("platform_admin_id") REFERENCES "public"."platform_admins"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "push_subscriptions" ADD CONSTRAINT "push_subscriptions_institution_id_institutions_id_fk" FOREIGN KEY ("institution_id") REFERENCES "public"."institutions"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "push_subscriptions" ADD CONSTRAINT "push_subscriptions_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "push_subscriptions" ADD CONSTRAINT "push_subscriptions_platform_admin_id_platform_admins_id_fk" FOREIGN KEY ("platform_admin_id") REFERENCES "public"."platform_admins"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "notifications_dedupe_unique" ON "notifications" USING btree ("dedupe_key");--> statement-breakpoint
CREATE INDEX "notifications_user_created_idx" ON "notifications" USING btree ("user_id","created_at" DESC NULLS LAST) WHERE "notifications"."user_id" is not null;--> statement-breakpoint
CREATE INDEX "notifications_admin_created_idx" ON "notifications" USING btree ("platform_admin_id","created_at" DESC NULLS LAST) WHERE "notifications"."platform_admin_id" is not null;--> statement-breakpoint
CREATE INDEX "notifications_user_unread_idx" ON "notifications" USING btree ("user_id") WHERE "notifications"."read_at" is null and "notifications"."user_id" is not null;--> statement-breakpoint
CREATE INDEX "notifications_admin_unread_idx" ON "notifications" USING btree ("platform_admin_id") WHERE "notifications"."read_at" is null and "notifications"."platform_admin_id" is not null;--> statement-breakpoint
CREATE INDEX "notifications_institution_idx" ON "notifications" USING btree ("institution_id");--> statement-breakpoint
CREATE INDEX "notifications_created_idx" ON "notifications" USING btree ("created_at");--> statement-breakpoint
CREATE UNIQUE INDEX "push_subscriptions_endpoint_hash_unique" ON "push_subscriptions" USING btree ("endpoint_hash");--> statement-breakpoint
CREATE INDEX "push_subscriptions_user_idx" ON "push_subscriptions" USING btree ("user_id") WHERE "push_subscriptions"."user_id" is not null;--> statement-breakpoint
CREATE INDEX "push_subscriptions_admin_idx" ON "push_subscriptions" USING btree ("platform_admin_id") WHERE "push_subscriptions"."platform_admin_id" is not null;--> statement-breakpoint
CREATE INDEX "push_subscriptions_institution_idx" ON "push_subscriptions" USING btree ("institution_id");