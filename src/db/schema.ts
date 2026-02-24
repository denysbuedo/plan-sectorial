import { sqliteTable, text, integer } from "drizzle-orm/sqlite-core";

export const universities = sqliteTable("universities", {
  code: text("code").primaryKey(),
  name: text("name").notNull(),
  shortName: text("short_name").notNull(),
});

export const students = sqliteTable("students", {
  document: text("document").primaryKey(),
  docType: integer("doc_type").notNull(), // 1: CI, 2: Pasaporte
  fullname: text("fullname").notNull(),
  entity: text("entity")
    .notNull()
    .references(() => universities.code),
  state: text("state").notNull().default("active"), // active, baja, error
  isHolder: integer("is_holder", { mode: "boolean" }).default(false),
  isClient: integer("is_client", { mode: "boolean" }).default(false),
  hasMobileSubscriptionsActive: integer("has_mobile_subscriptions_active", {
    mode: "boolean",
  }).default(false),
  isChannelConfirmed: integer("is_channel_confirmed", {
    mode: "boolean",
  }).default(false),
  isChannelConfigured: integer("is_channel_configured", {
    mode: "boolean",
  }).default(false),
  isConfigured: integer("is_configured", { mode: "boolean" }).default(false),
  createdAt: integer("created_at", { mode: "timestamp" }).$defaultFn(
    () => new Date()
  ),
  updatedAt: integer("updated_at", { mode: "timestamp" }).$defaultFn(
    () => new Date()
  ),
});

export type Student = typeof students.$inferSelect;
export type NewStudent = typeof students.$inferInsert;
export type University = typeof universities.$inferSelect;
