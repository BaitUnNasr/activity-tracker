CREATE TABLE "account" (
	"id" text PRIMARY KEY NOT NULL,
	"account_id" text NOT NULL,
	"provider_id" text NOT NULL,
	"user_id" text NOT NULL,
	"access_token" text,
	"refresh_token" text,
	"id_token" text,
	"access_token_expires_at" timestamp,
	"refresh_token_expires_at" timestamp,
	"scope" text,
	"password" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp NOT NULL
);
--> statement-breakpoint
CREATE TABLE "session" (
	"id" text PRIMARY KEY NOT NULL,
	"expires_at" timestamp NOT NULL,
	"token" text NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp NOT NULL,
	"ip_address" text,
	"user_agent" text,
	"user_id" text NOT NULL,
	CONSTRAINT "session_token_unique" UNIQUE("token")
);
--> statement-breakpoint
CREATE TABLE "user" (
	"id" text PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"email" text NOT NULL,
	"employee_code" text NOT NULL,
	"type" char(1) NOT NULL,
	"email_verified" boolean DEFAULT false NOT NULL,
	"image" text,
	"is_active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "user_email_unique" UNIQUE("email"),
	CONSTRAINT "user_type_check" CHECK ("user"."type" IN ('F', 'T'))
);
--> statement-breakpoint
CREATE TABLE "verification" (
	"id" text PRIMARY KEY NOT NULL,
	"identifier" text NOT NULL,
	"value" text NOT NULL,
	"expires_at" timestamp NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "backdate_permission" (
	"id" serial PRIMARY KEY NOT NULL,
	"user_id" text NOT NULL,
	"date" date NOT NULL,
	"granted_by" text NOT NULL,
	"granted_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
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
CREATE TABLE "holiday_master" (
	"id" serial PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"start_date" date NOT NULL,
	"end_date" date NOT NULL
);
--> statement-breakpoint
CREATE TABLE "schedule_master" (
	"id" serial PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"start_date" date NOT NULL,
	"end_date" date,
	"fulltime_hours" real DEFAULT 8 NOT NULL,
	"trainee_hours" real DEFAULT 5 NOT NULL
);
--> statement-breakpoint
CREATE TABLE "task_answer_option" (
	"id" serial PRIMARY KEY NOT NULL,
	"category_id" integer NOT NULL,
	"label" text NOT NULL,
	"sort_order" integer DEFAULT 0 NOT NULL,
	"designations" text[],
	"branches" text[]
);
--> statement-breakpoint
CREATE TABLE "task_category" (
	"id" serial PRIMARY KEY NOT NULL,
	"task_id" integer NOT NULL,
	"name" text NOT NULL,
	"sort_order" integer DEFAULT 0 NOT NULL,
	"designations" text[],
	"branches" text[]
);
--> statement-breakpoint
CREATE TABLE "task_day_meta" (
	"user_id" text NOT NULL,
	"date" date NOT NULL,
	"half_day" boolean DEFAULT false NOT NULL,
	"on_leave" boolean DEFAULT false NOT NULL,
	"leave_type" text,
	CONSTRAINT "task_day_meta_user_id_date_pk" PRIMARY KEY("user_id","date"),
	CONSTRAINT "leave_type_check" CHECK ("task_day_meta"."leave_type" IS NULL OR "task_day_meta"."leave_type" IN ('casual', 'earned', 'unpaid'))
);
--> statement-breakpoint
CREATE TABLE "task_entry" (
	"id" serial PRIMARY KEY NOT NULL,
	"user_id" text NOT NULL,
	"date" date NOT NULL,
	"task_id" integer NOT NULL,
	"category" text,
	"answer" text NOT NULL,
	"hours" real NOT NULL
);
--> statement-breakpoint
CREATE TABLE "task_master" (
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
ALTER TABLE "account" ADD CONSTRAINT "account_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "session" ADD CONSTRAINT "session_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "backdate_permission" ADD CONSTRAINT "backdate_permission_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "backdate_permission" ADD CONSTRAINT "backdate_permission_granted_by_user_id_fk" FOREIGN KEY ("granted_by") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "task_answer_option" ADD CONSTRAINT "task_answer_option_category_id_task_category_id_fk" FOREIGN KEY ("category_id") REFERENCES "public"."task_category"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "task_category" ADD CONSTRAINT "task_category_task_id_task_master_id_fk" FOREIGN KEY ("task_id") REFERENCES "public"."task_master"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "task_day_meta" ADD CONSTRAINT "task_day_meta_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "task_entry" ADD CONSTRAINT "task_entry_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "task_entry" ADD CONSTRAINT "task_entry_task_id_task_master_id_fk" FOREIGN KEY ("task_id") REFERENCES "public"."task_master"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "user_branch_link" ADD CONSTRAINT "user_branch_link_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "user_branch_link" ADD CONSTRAINT "user_branch_link_branch_id_branch_master_id_fk" FOREIGN KEY ("branch_id") REFERENCES "public"."branch_master"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "user_designation_link" ADD CONSTRAINT "user_designation_link_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "user_designation_link" ADD CONSTRAINT "user_designation_link_designation_id_designation_master_id_fk" FOREIGN KEY ("designation_id") REFERENCES "public"."designation_master"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "account_userId_idx" ON "account" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "session_userId_idx" ON "session" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "verification_identifier_idx" ON "verification" USING btree ("identifier");--> statement-breakpoint
CREATE UNIQUE INDEX "bp_user_date_uniq" ON "backdate_permission" USING btree ("user_id","date");--> statement-breakpoint
CREATE INDEX "bp_userId_idx" ON "backdate_permission" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "te_userId_date_idx" ON "task_entry" USING btree ("user_id","date");--> statement-breakpoint
CREATE INDEX "ubl_userId_idx" ON "user_branch_link" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "udl_userId_idx" ON "user_designation_link" USING btree ("user_id");