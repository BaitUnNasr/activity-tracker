CREATE TABLE "branch_master" (
	"id" serial PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL
);
--> statement-breakpoint
CREATE TABLE "designation_master" (
	"id" serial PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL
);
--> statement-breakpoint
CREATE TABLE "user_branch_link" (
	"id" serial PRIMARY KEY NOT NULL,
	"user_id" text NOT NULL,
	"branch_id" integer NOT NULL,
	"start_date" date NOT NULL,
	"end_date" date
);
--> statement-breakpoint
CREATE TABLE "user_designation_link" (
	"id" serial PRIMARY KEY NOT NULL,
	"user_id" text NOT NULL,
	"designation_id" integer NOT NULL,
	"start_date" date NOT NULL,
	"end_date" date
);
--> statement-breakpoint
ALTER TABLE "user" ADD COLUMN "employee_code" text NOT NULL;--> statement-breakpoint
ALTER TABLE "user_branch_link" ADD CONSTRAINT "user_branch_link_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "user_branch_link" ADD CONSTRAINT "user_branch_link_branch_id_branch_master_id_fk" FOREIGN KEY ("branch_id") REFERENCES "public"."branch_master"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "user_designation_link" ADD CONSTRAINT "user_designation_link_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "user_designation_link" ADD CONSTRAINT "user_designation_link_designation_id_designation_master_id_fk" FOREIGN KEY ("designation_id") REFERENCES "public"."designation_master"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "ubl_userId_idx" ON "user_branch_link" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "udl_userId_idx" ON "user_designation_link" USING btree ("user_id");--> statement-breakpoint
ALTER TABLE "user" DROP COLUMN "role";--> statement-breakpoint
DROP TYPE "public"."role";