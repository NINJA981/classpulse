CREATE TYPE "public"."bloom_level" AS ENUM('remember', 'understand', 'apply', 'analyze', 'evaluate', 'create');--> statement-breakpoint
CREATE TYPE "public"."material_kind" AS ENUM('pdf', 'text', 'docx');--> statement-breakpoint
CREATE TYPE "public"."resource_status" AS ENUM('queued', 'generating', 'ready', 'failed');--> statement-breakpoint
CREATE TYPE "public"."resource_type" AS ENUM('lesson_plan', 'worksheet', 'question_paper', 'presentation');--> statement-breakpoint
CREATE TABLE "courses" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"institution_id" uuid NOT NULL,
	"created_by" uuid,
	"title" varchar(200) NOT NULL,
	"level" varchar(80),
	"board" varchar(80),
	"subject" varchar(120),
	"description" text,
	"section_id" uuid,
	"catalog_key" varchar(80),
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "simulation_links" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"institution_id" uuid NOT NULL,
	"created_by" uuid,
	"title" varchar(200) NOT NULL,
	"url" text NOT NULL,
	"subject" varchar(120),
	"description" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "teacher_materials" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"institution_id" uuid NOT NULL,
	"teacher_id" uuid NOT NULL,
	"course_id" uuid,
	"unit_id" uuid,
	"title" varchar(200) NOT NULL,
	"kind" "material_kind" NOT NULL,
	"object_key" text,
	"original_name" varchar(255),
	"size_bytes" integer,
	"text_content" text DEFAULT '' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "teaching_resources" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"institution_id" uuid NOT NULL,
	"teacher_id" uuid NOT NULL,
	"type" "resource_type" NOT NULL,
	"title" varchar(200) NOT NULL,
	"status" "resource_status" DEFAULT 'queued' NOT NULL,
	"course_id" uuid,
	"unit_ids" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"lesson_ids" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"material_ids" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"prompt" text DEFAULT '' NOT NULL,
	"language" varchar(10) DEFAULT 'en-IN' NOT NULL,
	"options" jsonb NOT NULL,
	"content" jsonb,
	"failure_reason" varchar(500),
	"generation_attempt" integer DEFAULT 0 NOT NULL,
	"ai_meta" jsonb,
	"shared" boolean DEFAULT false NOT NULL,
	"shared_at" timestamp with time zone,
	"copied_from_id" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "units" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"course_id" uuid NOT NULL,
	"position" integer NOT NULL,
	"title" varchar(300) NOT NULL,
	"summary" text,
	"objectives" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "questions" ADD COLUMN "bloom_level" "bloom_level";--> statement-breakpoint
ALTER TABLE "questions" ADD COLUMN "competency" varchar(160);--> statement-breakpoint
ALTER TABLE "courses" ADD CONSTRAINT "courses_institution_id_institutions_id_fk" FOREIGN KEY ("institution_id") REFERENCES "public"."institutions"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "courses" ADD CONSTRAINT "courses_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "courses" ADD CONSTRAINT "courses_section_id_sections_id_fk" FOREIGN KEY ("section_id") REFERENCES "public"."sections"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "simulation_links" ADD CONSTRAINT "simulation_links_institution_id_institutions_id_fk" FOREIGN KEY ("institution_id") REFERENCES "public"."institutions"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "simulation_links" ADD CONSTRAINT "simulation_links_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "teacher_materials" ADD CONSTRAINT "teacher_materials_institution_id_institutions_id_fk" FOREIGN KEY ("institution_id") REFERENCES "public"."institutions"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "teacher_materials" ADD CONSTRAINT "teacher_materials_teacher_id_users_id_fk" FOREIGN KEY ("teacher_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "teacher_materials" ADD CONSTRAINT "teacher_materials_course_id_courses_id_fk" FOREIGN KEY ("course_id") REFERENCES "public"."courses"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "teacher_materials" ADD CONSTRAINT "teacher_materials_unit_id_units_id_fk" FOREIGN KEY ("unit_id") REFERENCES "public"."units"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "teaching_resources" ADD CONSTRAINT "teaching_resources_institution_id_institutions_id_fk" FOREIGN KEY ("institution_id") REFERENCES "public"."institutions"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "teaching_resources" ADD CONSTRAINT "teaching_resources_teacher_id_users_id_fk" FOREIGN KEY ("teacher_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "teaching_resources" ADD CONSTRAINT "teaching_resources_course_id_courses_id_fk" FOREIGN KEY ("course_id") REFERENCES "public"."courses"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "units" ADD CONSTRAINT "units_course_id_courses_id_fk" FOREIGN KEY ("course_id") REFERENCES "public"."courses"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "courses_institution_idx" ON "courses" USING btree ("institution_id");--> statement-breakpoint
CREATE INDEX "simulation_links_institution_idx" ON "simulation_links" USING btree ("institution_id");--> statement-breakpoint
CREATE INDEX "teacher_materials_teacher_idx" ON "teacher_materials" USING btree ("teacher_id");--> statement-breakpoint
CREATE INDEX "teaching_resources_teacher_idx" ON "teaching_resources" USING btree ("teacher_id","type");--> statement-breakpoint
CREATE INDEX "teaching_resources_shared_idx" ON "teaching_resources" USING btree ("institution_id","type") WHERE "teaching_resources"."shared";--> statement-breakpoint
CREATE INDEX "units_course_idx" ON "units" USING btree ("course_id","position");