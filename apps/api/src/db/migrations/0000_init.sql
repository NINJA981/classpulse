CREATE TYPE "public"."assignment_status" AS ENUM('draft', 'published');--> statement-breakpoint
CREATE TYPE "public"."day_of_week" AS ENUM('mon', 'tue', 'wed', 'thu', 'fri', 'sat');--> statement-breakpoint
CREATE TYPE "public"."device_command_status" AS ENUM('pending', 'delivered', 'acked', 'failed', 'expired');--> statement-breakpoint
CREATE TYPE "public"."device_command_type" AS ENUM('start_recording', 'stop_recording');--> statement-breakpoint
CREATE TYPE "public"."device_status" AS ENUM('online', 'offline', 'recording', 'error');--> statement-breakpoint
CREATE TYPE "public"."difficulty" AS ENUM('easy', 'medium', 'hard');--> statement-breakpoint
CREATE TYPE "public"."guardian_relation" AS ENUM('mother', 'father', 'guardian', 'other');--> statement-breakpoint
CREATE TYPE "public"."lesson_source_type" AS ENUM('device', 'upload');--> statement-breakpoint
CREATE TYPE "public"."lesson_status" AS ENUM('draft', 'recording', 'queued', 'transcribing', 'generating', 'ready_for_review', 'published', 'failed');--> statement-breakpoint
CREATE TYPE "public"."live_status" AS ENUM('lobby', 'question_open', 'question_closed', 'ended');--> statement-breakpoint
CREATE TYPE "public"."question_status" AS ENUM('draft', 'approved', 'rejected');--> statement-breakpoint
CREATE TYPE "public"."record_status" AS ENUM('active', 'disabled');--> statement-breakpoint
CREATE TYPE "public"."recording_status" AS ENUM('pending', 'recording', 'stopping', 'finalized', 'failed', 'cancelled');--> statement-breakpoint
CREATE TYPE "public"."user_role" AS ENUM('admin', 'teacher', 'student');--> statement-breakpoint
CREATE TABLE "enrollments" (
	"section_id" uuid NOT NULL,
	"student_id" uuid NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "enrollments_section_id_student_id_pk" PRIMARY KEY("section_id","student_id")
);
--> statement-breakpoint
CREATE TABLE "institutions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" varchar(200) NOT NULL,
	"code" varchar(20) NOT NULL,
	"timezone" varchar(64) DEFAULT 'Asia/Kolkata' NOT NULL,
	"academic_year" varchar(20),
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "institutions_code_unique" UNIQUE("code")
);
--> statement-breakpoint
CREATE TABLE "rooms" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"institution_id" uuid NOT NULL,
	"name" varchar(80) NOT NULL,
	"building" varchar(80),
	"capacity" integer,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "section_teachers" (
	"section_id" uuid NOT NULL,
	"teacher_id" uuid NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "section_teachers_section_id_teacher_id_pk" PRIMARY KEY("section_id","teacher_id")
);
--> statement-breakpoint
CREATE TABLE "sections" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"institution_id" uuid NOT NULL,
	"name" varchar(120) NOT NULL,
	"grade" varchar(20),
	"subject" varchar(120),
	"room_id" uuid,
	"join_code" varchar(6) NOT NULL,
	"join_code_expires_at" timestamp with time zone NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "sections_join_code_unique" UNIQUE("join_code")
);
--> statement-breakpoint
CREATE TABLE "timetable_slots" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"section_id" uuid NOT NULL,
	"day" "day_of_week" NOT NULL,
	"period" integer NOT NULL,
	"start_time" varchar(5) NOT NULL,
	"end_time" varchar(5) NOT NULL,
	"subject" varchar(120) NOT NULL,
	"teacher_id" uuid,
	"room_id" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "users" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"institution_id" uuid NOT NULL,
	"role" "user_role" NOT NULL,
	"name" varchar(120) NOT NULL,
	"email" varchar(254),
	"roll_number" varchar(40),
	"department" varchar(120),
	"password_hash" text NOT NULL,
	"must_change_password" boolean DEFAULT false NOT NULL,
	"token_version" integer DEFAULT 0 NOT NULL,
	"status" "record_status" DEFAULT 'active' NOT NULL,
	"last_login_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "assignment_submissions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"assignment_id" uuid NOT NULL,
	"student_id" uuid NOT NULL,
	"text" text NOT NULL,
	"submitted_at" timestamp with time zone DEFAULT now() NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "assignments" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"lesson_id" uuid NOT NULL,
	"title" varchar(200) NOT NULL,
	"prompt" text NOT NULL,
	"rubric" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"estimated_minutes" integer,
	"due_at" timestamp with time zone,
	"status" "assignment_status" DEFAULT 'draft' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "assignments_lesson_id_unique" UNIQUE("lesson_id")
);
--> statement-breakpoint
CREATE TABLE "guardians" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"student_id" uuid NOT NULL,
	"name" varchar(120) NOT NULL,
	"relation" "guardian_relation" NOT NULL,
	"phone" varchar(20) NOT NULL,
	"email" varchar(254),
	"receive_updates" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "lessons" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"institution_id" uuid NOT NULL,
	"teacher_id" uuid NOT NULL,
	"section_id" uuid NOT NULL,
	"title" varchar(200) NOT NULL,
	"subject" varchar(120) NOT NULL,
	"language" varchar(10) DEFAULT 'en-IN' NOT NULL,
	"status" "lesson_status" DEFAULT 'draft' NOT NULL,
	"source_type" "lesson_source_type",
	"audio_object_key" text,
	"audio_mime_type" varchar(100),
	"audio_size_bytes" integer,
	"audio_expires_at" timestamp with time zone,
	"duration_sec" double precision,
	"transcript" text,
	"transcript_segments" jsonb,
	"summary" text,
	"key_takeaways" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"generation_attempt" integer DEFAULT 0 NOT NULL,
	"progress_pct" integer DEFAULT 0 NOT NULL,
	"progress_message" varchar(300),
	"failure_reason" varchar(500),
	"pipeline_meta" jsonb,
	"remedial" jsonb,
	"published_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "model_settings" (
	"institution_id" uuid PRIMARY KEY NOT NULL,
	"stt_provider" varchar(40) NOT NULL,
	"stt_model" varchar(80) NOT NULL,
	"llm_provider" varchar(40) NOT NULL,
	"llm_model" varchar(80) NOT NULL,
	"questions_per_lesson" integer NOT NULL,
	"bilingual" boolean NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "questions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"lesson_id" uuid NOT NULL,
	"position" integer NOT NULL,
	"stem" text NOT NULL,
	"stem_local" text,
	"options" jsonb NOT NULL,
	"options_local" jsonb,
	"correct_index" integer NOT NULL,
	"explanation" text,
	"explanation_local" text,
	"difficulty" "difficulty" DEFAULT 'medium' NOT NULL,
	"topic_tag" varchar(120),
	"citation_start_sec" double precision,
	"citation_end_sec" double precision,
	"status" "question_status" DEFAULT 'draft' NOT NULL,
	"edited_by_teacher" boolean DEFAULT false NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "questions_correct_index_range" CHECK ("questions"."correct_index" between 0 and 3)
);
--> statement-breakpoint
CREATE TABLE "quiz_attempt_answers" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"attempt_id" uuid NOT NULL,
	"question_id" uuid,
	"position" integer NOT NULL,
	"stem_snapshot" text NOT NULL,
	"options_snapshot" jsonb NOT NULL,
	"correct_index_snapshot" integer NOT NULL,
	"selected_index" integer,
	"is_correct" boolean NOT NULL
);
--> statement-breakpoint
CREATE TABLE "quiz_attempts" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"lesson_id" uuid NOT NULL,
	"student_id" uuid NOT NULL,
	"idempotency_key" uuid NOT NULL,
	"correct" integer NOT NULL,
	"total" integer NOT NULL,
	"score_pct" double precision NOT NULL,
	"submitted_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "live_answers" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"participant_id" uuid NOT NULL,
	"question_id" uuid NOT NULL,
	"selected_index" integer NOT NULL,
	"revision" integer DEFAULT 1 NOT NULL,
	"answered_at" timestamp with time zone DEFAULT now() NOT NULL,
	"is_correct" boolean,
	"points_awarded" integer
);
--> statement-breakpoint
CREATE TABLE "live_participants" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"session_id" uuid NOT NULL,
	"student_id" uuid NOT NULL,
	"score" integer DEFAULT 0 NOT NULL,
	"correct" integer DEFAULT 0 NOT NULL,
	"joined_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "live_sessions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"lesson_id" uuid NOT NULL,
	"host_teacher_id" uuid NOT NULL,
	"pin" varchar(6) NOT NULL,
	"status" "live_status" DEFAULT 'lobby' NOT NULL,
	"time_limit_sec" integer DEFAULT 20 NOT NULL,
	"current_question_index" integer,
	"question_opened_at" timestamp with time zone,
	"question_closes_at" timestamp with time zone,
	"started_at" timestamp with time zone,
	"ended_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "device_commands" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"device_id" uuid NOT NULL,
	"type" "device_command_type" NOT NULL,
	"payload" jsonb NOT NULL,
	"status" "device_command_status" DEFAULT 'pending' NOT NULL,
	"error" varchar(500),
	"delivered_at" timestamp with time zone,
	"acked_at" timestamp with time zone,
	"expires_at" timestamp with time zone NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "device_enrollment_tokens" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"institution_id" uuid NOT NULL,
	"room_id" uuid NOT NULL,
	"name" varchar(80) NOT NULL,
	"token_hash" varchar(64) NOT NULL,
	"created_by" uuid,
	"expires_at" timestamp with time zone NOT NULL,
	"used_at" timestamp with time zone,
	"used_by_device_id" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "device_enrollment_tokens_token_hash_unique" UNIQUE("token_hash")
);
--> statement-breakpoint
CREATE TABLE "devices" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"institution_id" uuid NOT NULL,
	"room_id" uuid NOT NULL,
	"device_id" varchar(64) NOT NULL,
	"name" varchar(80) NOT NULL,
	"api_key_hash" varchar(64) NOT NULL,
	"status" "device_status" DEFAULT 'offline' NOT NULL,
	"agent_version" varchar(40),
	"last_heartbeat_at" timestamp with time zone,
	"ip_address" varchar(64),
	"stats" jsonb,
	"revoked_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "devices_device_id_unique" UNIQUE("device_id")
);
--> statement-breakpoint
CREATE TABLE "recording_chunks" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"session_id" uuid NOT NULL,
	"idx" integer NOT NULL,
	"sha256" varchar(64) NOT NULL,
	"bytes" integer NOT NULL,
	"object_key" text NOT NULL,
	"received_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "recording_sessions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"device_id" uuid NOT NULL,
	"lesson_id" uuid NOT NULL,
	"teacher_id" uuid NOT NULL,
	"status" "recording_status" DEFAULT 'pending' NOT NULL,
	"expected_chunks" integer,
	"duration_sec" integer,
	"started_at" timestamp with time zone,
	"stopped_at" timestamp with time zone,
	"finalized_at" timestamp with time zone,
	"failure_reason" varchar(500),
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "recording_sessions_lesson_id_unique" UNIQUE("lesson_id")
);
--> statement-breakpoint
ALTER TABLE "enrollments" ADD CONSTRAINT "enrollments_section_id_sections_id_fk" FOREIGN KEY ("section_id") REFERENCES "public"."sections"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "enrollments" ADD CONSTRAINT "enrollments_student_id_users_id_fk" FOREIGN KEY ("student_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "rooms" ADD CONSTRAINT "rooms_institution_id_institutions_id_fk" FOREIGN KEY ("institution_id") REFERENCES "public"."institutions"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "section_teachers" ADD CONSTRAINT "section_teachers_section_id_sections_id_fk" FOREIGN KEY ("section_id") REFERENCES "public"."sections"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "section_teachers" ADD CONSTRAINT "section_teachers_teacher_id_users_id_fk" FOREIGN KEY ("teacher_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sections" ADD CONSTRAINT "sections_institution_id_institutions_id_fk" FOREIGN KEY ("institution_id") REFERENCES "public"."institutions"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sections" ADD CONSTRAINT "sections_room_id_rooms_id_fk" FOREIGN KEY ("room_id") REFERENCES "public"."rooms"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "timetable_slots" ADD CONSTRAINT "timetable_slots_section_id_sections_id_fk" FOREIGN KEY ("section_id") REFERENCES "public"."sections"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "timetable_slots" ADD CONSTRAINT "timetable_slots_teacher_id_users_id_fk" FOREIGN KEY ("teacher_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "timetable_slots" ADD CONSTRAINT "timetable_slots_room_id_rooms_id_fk" FOREIGN KEY ("room_id") REFERENCES "public"."rooms"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "users" ADD CONSTRAINT "users_institution_id_institutions_id_fk" FOREIGN KEY ("institution_id") REFERENCES "public"."institutions"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "assignment_submissions" ADD CONSTRAINT "assignment_submissions_assignment_id_assignments_id_fk" FOREIGN KEY ("assignment_id") REFERENCES "public"."assignments"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "assignment_submissions" ADD CONSTRAINT "assignment_submissions_student_id_users_id_fk" FOREIGN KEY ("student_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "assignments" ADD CONSTRAINT "assignments_lesson_id_lessons_id_fk" FOREIGN KEY ("lesson_id") REFERENCES "public"."lessons"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "guardians" ADD CONSTRAINT "guardians_student_id_users_id_fk" FOREIGN KEY ("student_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "lessons" ADD CONSTRAINT "lessons_institution_id_institutions_id_fk" FOREIGN KEY ("institution_id") REFERENCES "public"."institutions"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "lessons" ADD CONSTRAINT "lessons_teacher_id_users_id_fk" FOREIGN KEY ("teacher_id") REFERENCES "public"."users"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "lessons" ADD CONSTRAINT "lessons_section_id_sections_id_fk" FOREIGN KEY ("section_id") REFERENCES "public"."sections"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "model_settings" ADD CONSTRAINT "model_settings_institution_id_institutions_id_fk" FOREIGN KEY ("institution_id") REFERENCES "public"."institutions"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "questions" ADD CONSTRAINT "questions_lesson_id_lessons_id_fk" FOREIGN KEY ("lesson_id") REFERENCES "public"."lessons"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "quiz_attempt_answers" ADD CONSTRAINT "quiz_attempt_answers_attempt_id_quiz_attempts_id_fk" FOREIGN KEY ("attempt_id") REFERENCES "public"."quiz_attempts"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "quiz_attempt_answers" ADD CONSTRAINT "quiz_attempt_answers_question_id_questions_id_fk" FOREIGN KEY ("question_id") REFERENCES "public"."questions"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "quiz_attempts" ADD CONSTRAINT "quiz_attempts_lesson_id_lessons_id_fk" FOREIGN KEY ("lesson_id") REFERENCES "public"."lessons"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "quiz_attempts" ADD CONSTRAINT "quiz_attempts_student_id_users_id_fk" FOREIGN KEY ("student_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "live_answers" ADD CONSTRAINT "live_answers_participant_id_live_participants_id_fk" FOREIGN KEY ("participant_id") REFERENCES "public"."live_participants"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "live_answers" ADD CONSTRAINT "live_answers_question_id_questions_id_fk" FOREIGN KEY ("question_id") REFERENCES "public"."questions"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "live_participants" ADD CONSTRAINT "live_participants_session_id_live_sessions_id_fk" FOREIGN KEY ("session_id") REFERENCES "public"."live_sessions"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "live_participants" ADD CONSTRAINT "live_participants_student_id_users_id_fk" FOREIGN KEY ("student_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "live_sessions" ADD CONSTRAINT "live_sessions_lesson_id_lessons_id_fk" FOREIGN KEY ("lesson_id") REFERENCES "public"."lessons"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "live_sessions" ADD CONSTRAINT "live_sessions_host_teacher_id_users_id_fk" FOREIGN KEY ("host_teacher_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "device_commands" ADD CONSTRAINT "device_commands_device_id_devices_id_fk" FOREIGN KEY ("device_id") REFERENCES "public"."devices"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "device_enrollment_tokens" ADD CONSTRAINT "device_enrollment_tokens_institution_id_institutions_id_fk" FOREIGN KEY ("institution_id") REFERENCES "public"."institutions"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "device_enrollment_tokens" ADD CONSTRAINT "device_enrollment_tokens_room_id_rooms_id_fk" FOREIGN KEY ("room_id") REFERENCES "public"."rooms"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "device_enrollment_tokens" ADD CONSTRAINT "device_enrollment_tokens_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "device_enrollment_tokens" ADD CONSTRAINT "device_enrollment_tokens_used_by_device_id_devices_id_fk" FOREIGN KEY ("used_by_device_id") REFERENCES "public"."devices"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "devices" ADD CONSTRAINT "devices_institution_id_institutions_id_fk" FOREIGN KEY ("institution_id") REFERENCES "public"."institutions"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "devices" ADD CONSTRAINT "devices_room_id_rooms_id_fk" FOREIGN KEY ("room_id") REFERENCES "public"."rooms"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "recording_chunks" ADD CONSTRAINT "recording_chunks_session_id_recording_sessions_id_fk" FOREIGN KEY ("session_id") REFERENCES "public"."recording_sessions"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "recording_sessions" ADD CONSTRAINT "recording_sessions_device_id_devices_id_fk" FOREIGN KEY ("device_id") REFERENCES "public"."devices"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "recording_sessions" ADD CONSTRAINT "recording_sessions_lesson_id_lessons_id_fk" FOREIGN KEY ("lesson_id") REFERENCES "public"."lessons"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "recording_sessions" ADD CONSTRAINT "recording_sessions_teacher_id_users_id_fk" FOREIGN KEY ("teacher_id") REFERENCES "public"."users"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "enrollments_student_idx" ON "enrollments" USING btree ("student_id");--> statement-breakpoint
CREATE UNIQUE INDEX "rooms_institution_name_unique" ON "rooms" USING btree ("institution_id","name");--> statement-breakpoint
CREATE INDEX "section_teachers_teacher_idx" ON "section_teachers" USING btree ("teacher_id");--> statement-breakpoint
CREATE UNIQUE INDEX "sections_institution_name_unique" ON "sections" USING btree ("institution_id","name");--> statement-breakpoint
CREATE INDEX "sections_room_idx" ON "sections" USING btree ("room_id");--> statement-breakpoint
CREATE UNIQUE INDEX "timetable_section_day_period_unique" ON "timetable_slots" USING btree ("section_id","day","period");--> statement-breakpoint
CREATE INDEX "timetable_teacher_idx" ON "timetable_slots" USING btree ("teacher_id");--> statement-breakpoint
CREATE INDEX "timetable_room_idx" ON "timetable_slots" USING btree ("room_id");--> statement-breakpoint
CREATE UNIQUE INDEX "users_email_unique" ON "users" USING btree ("email") WHERE "users"."email" is not null;--> statement-breakpoint
CREATE UNIQUE INDEX "users_institution_roll_unique" ON "users" USING btree ("institution_id","roll_number") WHERE "users"."roll_number" is not null;--> statement-breakpoint
CREATE INDEX "users_institution_role_idx" ON "users" USING btree ("institution_id","role");--> statement-breakpoint
CREATE UNIQUE INDEX "assignment_submissions_unique" ON "assignment_submissions" USING btree ("assignment_id","student_id");--> statement-breakpoint
CREATE UNIQUE INDEX "guardians_student_phone_unique" ON "guardians" USING btree ("student_id","phone");--> statement-breakpoint
CREATE INDEX "lessons_teacher_idx" ON "lessons" USING btree ("teacher_id");--> statement-breakpoint
CREATE INDEX "lessons_section_status_idx" ON "lessons" USING btree ("section_id","status");--> statement-breakpoint
CREATE INDEX "lessons_institution_status_idx" ON "lessons" USING btree ("institution_id","status");--> statement-breakpoint
CREATE INDEX "lessons_audio_expiry_idx" ON "lessons" USING btree ("audio_expires_at") WHERE "lessons"."audio_object_key" is not null;--> statement-breakpoint
CREATE INDEX "questions_lesson_status_idx" ON "questions" USING btree ("lesson_id","status");--> statement-breakpoint
CREATE INDEX "quiz_attempt_answers_attempt_idx" ON "quiz_attempt_answers" USING btree ("attempt_id");--> statement-breakpoint
CREATE INDEX "quiz_attempt_answers_question_idx" ON "quiz_attempt_answers" USING btree ("question_id");--> statement-breakpoint
CREATE UNIQUE INDEX "quiz_attempts_idempotency_unique" ON "quiz_attempts" USING btree ("student_id","idempotency_key");--> statement-breakpoint
CREATE INDEX "quiz_attempts_lesson_submitted_idx" ON "quiz_attempts" USING btree ("lesson_id","submitted_at");--> statement-breakpoint
CREATE INDEX "quiz_attempts_student_idx" ON "quiz_attempts" USING btree ("student_id");--> statement-breakpoint
CREATE UNIQUE INDEX "live_answers_participant_question_unique" ON "live_answers" USING btree ("participant_id","question_id");--> statement-breakpoint
CREATE INDEX "live_answers_question_idx" ON "live_answers" USING btree ("question_id");--> statement-breakpoint
CREATE UNIQUE INDEX "live_participants_session_student_unique" ON "live_participants" USING btree ("session_id","student_id");--> statement-breakpoint
CREATE UNIQUE INDEX "live_sessions_active_pin_unique" ON "live_sessions" USING btree ("pin") WHERE "live_sessions"."status" <> 'ended';--> statement-breakpoint
CREATE INDEX "live_sessions_lesson_idx" ON "live_sessions" USING btree ("lesson_id");--> statement-breakpoint
CREATE INDEX "live_sessions_host_idx" ON "live_sessions" USING btree ("host_teacher_id");--> statement-breakpoint
CREATE INDEX "device_commands_device_status_idx" ON "device_commands" USING btree ("device_id","status","created_at");--> statement-breakpoint
CREATE INDEX "devices_room_idx" ON "devices" USING btree ("room_id");--> statement-breakpoint
CREATE INDEX "devices_institution_idx" ON "devices" USING btree ("institution_id");--> statement-breakpoint
CREATE UNIQUE INDEX "recording_chunks_session_idx_unique" ON "recording_chunks" USING btree ("session_id","idx");--> statement-breakpoint
CREATE INDEX "recording_sessions_device_idx" ON "recording_sessions" USING btree ("device_id");--> statement-breakpoint
CREATE UNIQUE INDEX "recording_sessions_one_active_per_device" ON "recording_sessions" USING btree ("device_id") WHERE "recording_sessions"."status" in ('pending', 'recording', 'stopping');