CREATE TYPE "public"."email_status" AS ENUM('queued', 'sent', 'failed');--> statement-breakpoint
CREATE TYPE "public"."exam_attempt_status" AS ENUM('in_progress', 'submitted', 'auto_submitted');--> statement-breakpoint
CREATE TYPE "public"."exam_event_type" AS ENUM('fullscreen_exit', 'tab_hidden', 'window_blur', 'copy', 'paste', 'context_menu', 'print', 'second_device', 'resume');--> statement-breakpoint
CREATE TYPE "public"."exam_results_visibility" AS ENUM('after_close', 'immediately', 'never');--> statement-breakpoint
CREATE TYPE "public"."exam_status" AS ENUM('draft', 'published', 'closed');--> statement-breakpoint
CREATE TYPE "public"."late_policy" AS ENUM('allow_late', 'closed');--> statement-breakpoint
CREATE TYPE "public"."password_token_purpose" AS ENUM('invite', 'reset');--> statement-breakpoint
CREATE TYPE "public"."submission_status" AS ENUM('submitted', 'returned');--> statement-breakpoint
ALTER TYPE "public"."assignment_status" ADD VALUE 'closed';--> statement-breakpoint
CREATE TABLE "password_tokens" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"purpose" "password_token_purpose" NOT NULL,
	"token_hash" varchar(64) NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	"used_at" timestamp with time zone,
	"revoked_at" timestamp with time zone,
	"created_by" uuid,
	"email_status" "email_status",
	"email_error" varchar(300),
	"email_sent_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "password_tokens_token_hash_unique" UNIQUE("token_hash")
);
--> statement-breakpoint
CREATE TABLE "assignment_reminders" (
	"assignment_id" uuid NOT NULL,
	"student_id" uuid NOT NULL,
	"sent_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "assignment_reminders_assignment_id_student_id_pk" PRIMARY KEY("assignment_id","student_id")
);
--> statement-breakpoint
CREATE TABLE "submission_files" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"submission_id" uuid NOT NULL,
	"object_key" text NOT NULL,
	"original_name" varchar(255) NOT NULL,
	"mime" varchar(120) NOT NULL,
	"size_bytes" integer NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "exam_answers" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"attempt_id" uuid NOT NULL,
	"exam_question_id" uuid NOT NULL,
	"selected_index" smallint,
	"revision" integer DEFAULT 1 NOT NULL,
	"answered_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "exam_attempts" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"exam_id" uuid NOT NULL,
	"student_id" uuid NOT NULL,
	"status" "exam_attempt_status" DEFAULT 'in_progress' NOT NULL,
	"started_at" timestamp with time zone DEFAULT now() NOT NULL,
	"deadline_at" timestamp with time zone NOT NULL,
	"extra_minutes" integer DEFAULT 0 NOT NULL,
	"submitted_at" timestamp with time zone,
	"paper" jsonb NOT NULL,
	"device_token_hash" varchar(64),
	"last_seen_at" timestamp with time zone,
	"violation_count" integer DEFAULT 0 NOT NULL,
	"correct" integer,
	"total" integer,
	"score_pct" double precision
);
--> statement-breakpoint
CREATE TABLE "exam_events" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"attempt_id" uuid NOT NULL,
	"type" "exam_event_type" NOT NULL,
	"at" timestamp with time zone DEFAULT now() NOT NULL,
	"detail" jsonb
);
--> statement-breakpoint
CREATE TABLE "exam_questions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"exam_id" uuid NOT NULL,
	"source_question_id" uuid,
	"position" integer NOT NULL,
	"stem" text NOT NULL,
	"stem_local" text,
	"options" jsonb NOT NULL,
	"options_local" jsonb,
	"correct_index" smallint NOT NULL,
	"explanation" text,
	"explanation_local" text,
	"difficulty" "difficulty" DEFAULT 'medium' NOT NULL,
	"topic_tag" varchar(120)
);
--> statement-breakpoint
CREATE TABLE "exams" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"institution_id" uuid NOT NULL,
	"teacher_id" uuid NOT NULL,
	"section_id" uuid NOT NULL,
	"title" varchar(200) NOT NULL,
	"instructions" text DEFAULT '' NOT NULL,
	"status" "exam_status" DEFAULT 'draft' NOT NULL,
	"opens_at" timestamp with time zone NOT NULL,
	"closes_at" timestamp with time zone NOT NULL,
	"duration_min" integer NOT NULL,
	"questions_per_student" integer NOT NULL,
	"shuffle_questions" boolean DEFAULT true NOT NULL,
	"shuffle_options" boolean DEFAULT true NOT NULL,
	"require_fullscreen" boolean DEFAULT true NOT NULL,
	"use_access_code" boolean DEFAULT true NOT NULL,
	"access_code" varchar(12),
	"single_device" boolean DEFAULT true NOT NULL,
	"max_violations" integer,
	"results_visibility" "exam_results_visibility" DEFAULT 'after_close' NOT NULL,
	"selected_question_ids" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"published_at" timestamp with time zone,
	"closed_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "assignments" DROP CONSTRAINT "assignments_lesson_id_unique";--> statement-breakpoint
ALTER TABLE "assignment_submissions" ALTER COLUMN "text" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "assignments" ALTER COLUMN "lesson_id" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "assignment_submissions" ADD COLUMN "status" "submission_status" DEFAULT 'submitted' NOT NULL;--> statement-breakpoint
ALTER TABLE "assignment_submissions" ADD COLUMN "is_late" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "assignment_submissions" ADD COLUMN "rubric_marks" jsonb;--> statement-breakpoint
ALTER TABLE "assignment_submissions" ADD COLUMN "total_marks" double precision;--> statement-breakpoint
ALTER TABLE "assignment_submissions" ADD COLUMN "feedback" text;--> statement-breakpoint
ALTER TABLE "assignment_submissions" ADD COLUMN "graded_by" uuid;--> statement-breakpoint
ALTER TABLE "assignment_submissions" ADD COLUMN "graded_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "assignment_submissions" ADD COLUMN "returned_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "assignment_submissions" ADD COLUMN "ai_suggestion" jsonb;--> statement-breakpoint
ALTER TABLE "assignments" ADD COLUMN "section_id" uuid;--> statement-breakpoint
ALTER TABLE "assignments" ADD COLUMN "teacher_id" uuid;--> statement-breakpoint
ALTER TABLE "assignments" ADD COLUMN "is_primary" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "assignments" ADD COLUMN "late_policy" "late_policy" DEFAULT 'allow_late' NOT NULL;--> statement-breakpoint
ALTER TABLE "assignments" ADD COLUMN "allow_files" boolean DEFAULT true NOT NULL;--> statement-breakpoint
ALTER TABLE "assignments" ADD COLUMN "max_files" integer DEFAULT 5 NOT NULL;--> statement-breakpoint
ALTER TABLE "assignments" ADD COLUMN "reminders" boolean DEFAULT true NOT NULL;--> statement-breakpoint
ALTER TABLE "assignments" ADD COLUMN "published_at" timestamp with time zone;--> statement-breakpoint
-- Backfill: existing assignments are the lessons' AI-drafted (primary) assignments.
UPDATE "assignments" AS a SET "section_id" = l."section_id", "teacher_id" = l."teacher_id", "is_primary" = true FROM "lessons" AS l WHERE l."id" = a."lesson_id";--> statement-breakpoint
UPDATE "assignments" SET "published_at" = "updated_at" WHERE "status" = 'published';--> statement-breakpoint
ALTER TABLE "assignments" ALTER COLUMN "section_id" SET NOT NULL;--> statement-breakpoint
ALTER TABLE "assignments" ALTER COLUMN "teacher_id" SET NOT NULL;--> statement-breakpoint
ALTER TABLE "password_tokens" ADD CONSTRAINT "password_tokens_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "password_tokens" ADD CONSTRAINT "password_tokens_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "assignment_reminders" ADD CONSTRAINT "assignment_reminders_assignment_id_assignments_id_fk" FOREIGN KEY ("assignment_id") REFERENCES "public"."assignments"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "assignment_reminders" ADD CONSTRAINT "assignment_reminders_student_id_users_id_fk" FOREIGN KEY ("student_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "submission_files" ADD CONSTRAINT "submission_files_submission_id_assignment_submissions_id_fk" FOREIGN KEY ("submission_id") REFERENCES "public"."assignment_submissions"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "exam_answers" ADD CONSTRAINT "exam_answers_attempt_id_exam_attempts_id_fk" FOREIGN KEY ("attempt_id") REFERENCES "public"."exam_attempts"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "exam_answers" ADD CONSTRAINT "exam_answers_exam_question_id_exam_questions_id_fk" FOREIGN KEY ("exam_question_id") REFERENCES "public"."exam_questions"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "exam_attempts" ADD CONSTRAINT "exam_attempts_exam_id_exams_id_fk" FOREIGN KEY ("exam_id") REFERENCES "public"."exams"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "exam_attempts" ADD CONSTRAINT "exam_attempts_student_id_users_id_fk" FOREIGN KEY ("student_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "exam_events" ADD CONSTRAINT "exam_events_attempt_id_exam_attempts_id_fk" FOREIGN KEY ("attempt_id") REFERENCES "public"."exam_attempts"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "exam_questions" ADD CONSTRAINT "exam_questions_exam_id_exams_id_fk" FOREIGN KEY ("exam_id") REFERENCES "public"."exams"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "exam_questions" ADD CONSTRAINT "exam_questions_source_question_id_questions_id_fk" FOREIGN KEY ("source_question_id") REFERENCES "public"."questions"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "exams" ADD CONSTRAINT "exams_institution_id_institutions_id_fk" FOREIGN KEY ("institution_id") REFERENCES "public"."institutions"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "exams" ADD CONSTRAINT "exams_teacher_id_users_id_fk" FOREIGN KEY ("teacher_id") REFERENCES "public"."users"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "exams" ADD CONSTRAINT "exams_section_id_sections_id_fk" FOREIGN KEY ("section_id") REFERENCES "public"."sections"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "password_tokens_user_idx" ON "password_tokens" USING btree ("user_id","created_at");--> statement-breakpoint
CREATE INDEX "submission_files_submission_idx" ON "submission_files" USING btree ("submission_id");--> statement-breakpoint
CREATE UNIQUE INDEX "exam_answers_attempt_question" ON "exam_answers" USING btree ("attempt_id","exam_question_id");--> statement-breakpoint
CREATE UNIQUE INDEX "exam_attempts_one_per_student" ON "exam_attempts" USING btree ("exam_id","student_id");--> statement-breakpoint
CREATE INDEX "exam_attempts_open_deadline_idx" ON "exam_attempts" USING btree ("deadline_at") WHERE "exam_attempts"."status" = 'in_progress';--> statement-breakpoint
CREATE INDEX "exam_events_attempt_idx" ON "exam_events" USING btree ("attempt_id","at");--> statement-breakpoint
CREATE INDEX "exam_questions_exam_idx" ON "exam_questions" USING btree ("exam_id","position");--> statement-breakpoint
CREATE INDEX "exams_teacher_idx" ON "exams" USING btree ("teacher_id");--> statement-breakpoint
CREATE INDEX "exams_section_status_idx" ON "exams" USING btree ("section_id","status");--> statement-breakpoint
CREATE INDEX "exams_status_closes_idx" ON "exams" USING btree ("status","closes_at");--> statement-breakpoint
ALTER TABLE "assignment_submissions" ADD CONSTRAINT "assignment_submissions_graded_by_users_id_fk" FOREIGN KEY ("graded_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "assignments" ADD CONSTRAINT "assignments_section_id_sections_id_fk" FOREIGN KEY ("section_id") REFERENCES "public"."sections"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "assignments" ADD CONSTRAINT "assignments_teacher_id_users_id_fk" FOREIGN KEY ("teacher_id") REFERENCES "public"."users"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "assignments_lesson_idx" ON "assignments" USING btree ("lesson_id");--> statement-breakpoint
CREATE INDEX "assignments_section_status_idx" ON "assignments" USING btree ("section_id","status");--> statement-breakpoint
CREATE INDEX "assignments_teacher_idx" ON "assignments" USING btree ("teacher_id");--> statement-breakpoint
CREATE UNIQUE INDEX "assignments_primary_per_lesson" ON "assignments" USING btree ("lesson_id") WHERE "assignments"."is_primary";