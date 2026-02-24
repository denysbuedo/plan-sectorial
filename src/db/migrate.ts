import { drizzle } from "drizzle-orm/better-sqlite3";
import { migrate } from "drizzle-orm/better-sqlite3/migrator";
import Database from "better-sqlite3";
import { resolve } from "path";

const sqlite = new Database("local.db");
const db = drizzle(sqlite);

await migrate(db, { migrationsFolder: resolve("./src/db/migrations") });

console.log("Migrations completed successfully");
