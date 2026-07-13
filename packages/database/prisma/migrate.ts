import "dotenv/config";
import { PrismaClient } from "@prisma/client";
import { existsSync, readFileSync, readdirSync } from "fs";
import { join } from "path";

const prisma = new PrismaClient();
const migrationsDir = join(__dirname, "migrations");

async function main() {
  await prisma.$executeRawUnsafe(`
    CREATE TABLE IF NOT EXISTS "_HubMigration" (
      "id" TEXT NOT NULL PRIMARY KEY,
      "appliedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
    )
  `);

  if (!existsSync(migrationsDir)) return;
  const migrations = readdirSync(migrationsDir)
    .filter((name) => existsSync(join(migrationsDir, name, "migration.sql")))
    .sort();

  for (const id of migrations) {
    const applied = await prisma.$queryRawUnsafe<Array<{ id: string }>>(
      `SELECT id FROM "_HubMigration" WHERE id = ? LIMIT 1`,
      id
    );
    if (applied.length > 0) continue;

    const sql = readFileSync(join(migrationsDir, id, "migration.sql"), "utf8");
    for (const statement of sql.split(";").map((part) => part.trim()).filter(Boolean)) {
      await prisma.$executeRawUnsafe(statement);
    }
    await prisma.$executeRawUnsafe(`INSERT INTO "_HubMigration" ("id") VALUES (?)`, id);
    console.log(`Applied migration ${id}`);
  }
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
