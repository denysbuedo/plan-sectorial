import { drizzle } from "drizzle-orm/libsql";
import { migrate } from "drizzle-orm/libsql/migrator";
import { createClient } from "@libsql/client";
import { resolve } from "path";

const client = createClient({
  url: "file:local.db",
});
const db = drizzle(client);

await migrate(db, { migrationsFolder: resolve("./src/db/migrations") });

console.log("Migrations completed successfully");
