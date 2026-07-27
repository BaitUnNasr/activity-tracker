import { relations, sql } from "drizzle-orm";
import {
  boolean,
  check,
  date,
  index,
  integer,
  pgTable,
  primaryKey,
  real,
  serial,
  text,
  timestamp,
  uniqueIndex,
} from "drizzle-orm/pg-core";

export const holidayMaster = pgTable("holiday_master", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  startDate: date("start_date").notNull(),
  endDate: date("end_date").notNull(),
});

import { user } from "./auth";

export const designationMaster = pgTable("designation_master", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  isActive: boolean("is_active").default(true).notNull(),
});

export const branchMaster = pgTable("branch_master", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  isActive: boolean("is_active").default(true).notNull(),
});

export const userDesignationLink = pgTable(
  "user_designation_link",
  {
    id: serial("id").primaryKey(),
    userId: text("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    designationId: integer("designation_id")
      .notNull()
      .references(() => designationMaster.id, { onDelete: "cascade" }),
    startDate: date("start_date").notNull(),
    endDate: date("end_date"),
  },
  (table) => [index("udl_userId_idx").on(table.userId)],
);

export const userBranchLink = pgTable(
  "user_branch_link",
  {
    id: serial("id").primaryKey(),
    userId: text("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    branchId: integer("branch_id")
      .notNull()
      .references(() => branchMaster.id, { onDelete: "cascade" }),
    startDate: date("start_date").notNull(),
    endDate: date("end_date"),
  },
  (table) => [index("ubl_userId_idx").on(table.userId)],
);

export const taskMaster = pgTable("task_master", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  isActive: boolean("is_active").default(true).notNull(),
});

// Task → Category → SubCategory. Restrictions apply at both category and
// subcategory level: a subcategory is visible only if both levels allow the
// user's branch AND designation (null/empty array = all).
export const taskCategory = pgTable("task_category", {
  id: serial("id").primaryKey(),
  taskId: integer("task_id")
    .notNull()
    .references(() => taskMaster.id, { onDelete: "cascade" }),
  name: text("name").notNull(),
  sortOrder: integer("sort_order").default(0).notNull(),
  designations: text("designations").array(),
  branches: text("branches").array(),
});

// A subcategory (the leaf a user logs hours against). `label` is its name.
export const taskAnswerOption = pgTable("task_answer_option", {
  id: serial("id").primaryKey(),
  categoryId: integer("category_id")
    .notNull()
    .references(() => taskCategory.id, { onDelete: "cascade" }),
  label: text("label").notNull(),
  sortOrder: integer("sort_order").default(0).notNull(),
  designations: text("designations").array(), // null = all designations
  branches: text("branches").array(), // null = all branches
});

export const scheduleMaster = pgTable("schedule_master", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  startDate: date("start_date").notNull(),
  // null = open-ended: the schedule continues forever. No later schedule may be
  // created while an open-ended one is in effect until it is given an end date.
  endDate: date("end_date"),
  fulltimeHours: real("fulltime_hours").notNull().default(8),
  traineeHours: real("trainee_hours").notNull().default(5),
});

export const taskEntry = pgTable(
  "task_entry",
  {
    id: serial("id").primaryKey(),
    userId: text("user_id").notNull().references(() => user.id, { onDelete: "cascade" }),
    date: date("date").notNull(),
    taskId: integer("task_id").notNull().references(() => taskMaster.id, { onDelete: "cascade" }),
    category: text("category"), // denormalized category name (null on pre-category rows)
    answer: text("answer").notNull(), // subcategory name
    hours: real("hours").notNull(),
  },
  (table) => [index("te_userId_date_idx").on(table.userId, table.date)],
);

export const taskDayMeta = pgTable(
  "task_day_meta",
  {
    userId: text("user_id").notNull().references(() => user.id, { onDelete: "cascade" }),
    date: date("date").notNull(),
    halfDay: boolean("half_day").default(false).notNull(),
    onLeave: boolean("on_leave").default(false).notNull(),
    // Set only when onLeave is true: casual | earned | unpaid.
    leaveType: text("leave_type"),
  },
  (table) => [
    primaryKey({ columns: [table.userId, table.date] }),
    check(
      "leave_type_check",
      sql`${table.leaveType} IS NULL OR ${table.leaveType} IN ('casual', 'earned', 'unpaid')`,
    ),
  ],
);

// A superior granting a specific past date on which the given user may log
// (backdate) tasks. One row = "userId may add/edit tasks for `date`".
export const backdatePermission = pgTable(
  "backdate_permission",
  {
    id: serial("id").primaryKey(),
    userId: text("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    date: date("date").notNull(),
    grantedBy: text("granted_by")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    grantedAt: timestamp("granted_at").defaultNow().notNull(),
  },
  (table) => [
    uniqueIndex("bp_user_date_uniq").on(table.userId, table.date),
    index("bp_userId_idx").on(table.userId),
  ],
);

export const designationMasterRelations = relations(designationMaster, ({ many }) => ({
  userLinks: many(userDesignationLink),
}));

export const branchMasterRelations = relations(branchMaster, ({ many }) => ({
  userLinks: many(userBranchLink),
}));

export const userDesignationLinkRelations = relations(userDesignationLink, ({ one }) => ({
  user: one(user, {
    fields: [userDesignationLink.userId],
    references: [user.id],
  }),
  designation: one(designationMaster, {
    fields: [userDesignationLink.designationId],
    references: [designationMaster.id],
  }),
}));

export const userBranchLinkRelations = relations(userBranchLink, ({ one }) => ({
  user: one(user, {
    fields: [userBranchLink.userId],
    references: [user.id],
  }),
  branch: one(branchMaster, {
    fields: [userBranchLink.branchId],
    references: [branchMaster.id],
  }),
}));
