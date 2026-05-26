ALTER TABLE "user" ADD COLUMN "type" char(1) NOT NULL;--> statement-breakpoint
ALTER TABLE "user" ADD CONSTRAINT "user_type_check" CHECK ("user"."type" IN ('F', 'T'));