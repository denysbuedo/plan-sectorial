import { drizzle } from "drizzle-orm/bun-sqlite";
import { migrate } from "drizzle-orm/bun-sqlite/migrator";
import { Database } from "bun:sqlite";
import { resolve } from "path";

const sqlite = new Database("local.db");
const db = drizzle(sqlite);

await migrate(db, { migrationsFolder: resolve("./src/db/migrations") });

console.log("Migrations completed successfully");
