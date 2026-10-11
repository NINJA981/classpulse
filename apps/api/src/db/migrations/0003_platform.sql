CREATE TYPE "public"."institution_status" AS ENUM('active', 'suspended');--> statement-breakpoint
CREATE TYPE "public"."ai_usage_kind" AS ENUM('stt', 'quiz', 'questions', 'remedial', 'grading', 'resource', 'voice');--> statement-breakpoint
CREATE TABLE "ai_usage" (
	"id" bigserial PRIMARY KEY NOT NULL,
	"at" timestamp with time zone DEFAULT now() NOT NULL,
	"institution_id" uuid,
	"lesson_id" uuid,
	"kind" "ai_usage_kind" NOT NULL,
	"provider" varchar(20) NOT NULL,
	"model" varchar(80) NOT NULL,
	"audio_seconds" double precision,
	"input_tokens" integer,
	"output_tokens" integer,
	"ok" boolean NOT NULL,
	"error_code" varchar(60)
);
--> statement-breakpoint
CREATE TABLE "app_logs" (
	"id" bigserial PRIMARY KEY NOT NULL,
	"at" timestamp with time zone NOT NULL,
	"level" smallint NOT NULL,
	"service" varchar(20) NOT NULL,
	"msg" text NOT NULL,
	"req_id" varchar(100),
	"institution_id" uuid,
	"user_id" uuid,
	"context" jsonb
);
--> statement-breakpoint
CREATE TABLE "audit_logs" (
	"id" bigserial PRIMARY KEY NOT NULL,
	"at" timestamp with time zone DEFAULT now() NOT NULL,
	"actor_type" varchar(16) NOT NULL,
	"actor_id" uuid,
	"actor_role" varchar(20),
	"actor_name" varchar(120),
	"institution_id" uuid,
	"action" varchar(80) NOT NULL,
	"target_type" varchar(40),
	"target_id" varchar(80),
	"metadata" jsonb,
	"ip" varchar(64),
	"user_agent" varchar(300)
);
--> statement-breakpoint
CREATE TABLE "email_log" (
	"id" bigserial PRIMARY KEY NOT NULL,
	"at" timestamp with time zone DEFAULT now() NOT NULL,
	"kind" varchar(40) NOT NULL,
	"institution_id" uuid,
	"to_hash" varchar(64) NOT NULL,
	"status" "email_status" NOT NULL,
	"error" varchar(300)
);
--> statement-breakpoint
CREATE TABLE "health_snapshots" (
	"id" bigserial PRIMARY KEY NOT NULL,
	"at" timestamp with time zone DEFAULT now() NOT NULL,
	"status" varchar(10) NOT NULL,
	"checks" jsonb NOT NULL
);
--> statement-breakpoint
CREATE TABLE "platform_admins" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"email" varchar(254) NOT NULL,
	"name" varchar(120) NOT NULL,
	"password_hash" text NOT NULL,
	"must_change_password" boolean DEFAULT true NOT NULL,
	"token_version" integer DEFAULT 0 NOT NULL,
	"status" "record_status" DEFAULT 'active' NOT NULL,
	"totp_secret_enc" text,
	"totp_enabled_at" timestamp with time zone,
	"totp_last_step" integer,
	"recovery_code_hashes" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"last_login_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "platform_admins_email_unique" UNIQUE("email")
);
--> statement-breakpoint
CREATE TABLE "platform_settings" (
	"key" varchar(64) PRIMARY KEY NOT NULL,
	"value" jsonb NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_by" uuid
);
--> statement-breakpoint
ALTER TABLE "institutions" ADD COLUMN "status" "institution_status" DEFAULT 'active' NOT NULL;--> statement-breakpoint
ALTER TABLE "institutions" ADD COLUMN "suspended_reason" varchar(300);--> statement-breakpoint
ALTER TABLE "institutions" ADD COLUMN "suspended_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "institutions" ADD COLUMN "features" jsonb DEFAULT '{"exams":true,"assignments":true,"liveQuiz":true,"devices":true,"emailInvites":true,"aiGrading":true,"teacherTools":true}'::jsonb NOT NULL;--> statement-breakpoint
ALTER TABLE "institutions" ADD COLUMN "limits" jsonb DEFAULT '{"maxStudents":null,"maxTeachers":null,"aiAudioMinutesPerMonth":null,"storageGb":null}'::jsonb NOT NULL;--> statement-breakpoint
ALTER TABLE "institutions" ADD COLUMN "contact" jsonb;--> statement-breakpoint
ALTER TABLE "institutions" ADD COLUMN "notes" text;--> statement-breakpoint
ALTER TABLE "ai_usage" ADD CONSTRAINT "ai_usage_institution_id_institutions_id_fk" FOREIGN KEY ("institution_id") REFERENCES "public"."institutions"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "audit_logs" ADD CONSTRAINT "audit_logs_institution_id_institutions_id_fk" FOREIGN KEY ("institution_id") REFERENCES "public"."institutions"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "ai_usage_at_idx" ON "ai_usage" USING btree ("at");--> statement-breakpoint
CREATE INDEX "ai_usage_institution_at_idx" ON "ai_usage" USING btree ("institution_id","at");--> statement-breakpoint
CREATE INDEX "app_logs_at_idx" ON "app_logs" USING btree ("at");--> statement-breakpoint
CREATE INDEX "app_logs_level_at_idx" ON "app_logs" USING btree ("level","at");--> statement-breakpoint
CREATE INDEX "app_logs_institution_at_idx" ON "app_logs" USING btree ("institution_id","at") WHERE "app_logs"."institution_id" is not null;--> statement-breakpoint
CREATE INDEX "audit_logs_at_idx" ON "audit_logs" USING btree ("at");--> statement-breakpoint
CREATE INDEX "audit_logs_institution_at_idx" ON "audit_logs" USING btree ("institution_id","at");--> statement-breakpoint
CREATE INDEX "audit_logs_actor_at_idx" ON "audit_logs" USING btree ("actor_id","at");--> statement-breakpoint
CREATE INDEX "audit_logs_action_at_idx" ON "audit_logs" USING btree ("action","at");--> statement-breakpoint
CREATE INDEX "email_log_at_idx" ON "email_log" USING btree ("at");--> statement-breakpoint
CREATE INDEX "health_snapshots_at_idx" ON "health_snapshots" USING btree ("at");