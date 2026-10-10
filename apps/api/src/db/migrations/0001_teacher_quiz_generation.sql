ALTER TYPE "public"."lesson_status" ADD VALUE 'transcribed' BEFORE 'ready_for_review';--> statement-breakpoint
ALTER TABLE "lessons" ADD COLUMN "quiz_request" jsonb;