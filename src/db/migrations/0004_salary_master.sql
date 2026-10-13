CREATE TABLE "salary_master" (
	"id" serial PRIMARY KEY NOT NULL,
	"user_id" text NOT NULL,
	"month" date NOT NULL,
	"gross" numeric(12, 2) NOT NULL
);
--> statement-breakpoint
ALTER TABLE "salary_master" ADD CONSTRAINT "salary_master_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "sm_user_month_uniq" ON "salary_master" USING btree ("user_id","month");