-- Store the task name on the entry itself, so history survives a task being
-- deleted or renamed (category and answer already work this way). Added
-- nullable first and backfilled from the foreign key, because an existing row
-- cannot satisfy NOT NULL until it has a value.
ALTER TABLE "task_entry" ADD COLUMN "task" text;--> statement-breakpoint
UPDATE "task_entry" e SET "task" = t."name" FROM "task_master" t WHERE t."id" = e."task_id";--> statement-breakpoint
ALTER TABLE "task_entry" ALTER COLUMN "task" SET NOT NULL;--> statement-breakpoint
CREATE UNIQUE INDEX "task_master_name_uniq" ON "task_master" USING btree ("name");
