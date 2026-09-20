ALTER TABLE "task_entry" DROP CONSTRAINT "task_entry_task_id_task_master_id_fk";
--> statement-breakpoint
ALTER TABLE "task_entry" DROP COLUMN "task_id";