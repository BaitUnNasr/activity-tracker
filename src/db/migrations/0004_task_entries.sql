CREATE TABLE "task_entry" (
	"id" serial PRIMARY KEY NOT NULL,
	"user_id" text NOT NULL,
	"date" date NOT NULL,
	"task_id" integer NOT NULL,
	"answer" text NOT NULL,
	"hours" real NOT NULL,
	CONSTRAINT "task_entry_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action,
	CONSTRAINT "task_entry_task_id_task_master_id_fk" FOREIGN KEY ("task_id") REFERENCES "public"."task_master"("id") ON DELETE cascade ON UPDATE no action
);
--> statement-breakpoint
CREATE TABLE "task_day_meta" (
	"user_id" text NOT NULL,
	"date" date NOT NULL,
	"half_day" boolean DEFAULT false NOT NULL,
	CONSTRAINT "task_day_meta_user_id_date_pk" PRIMARY KEY("user_id","date"),
	CONSTRAINT "task_day_meta_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action
);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "te_userId_date_idx" ON "task_entry" USING btree ("user_id","date");
