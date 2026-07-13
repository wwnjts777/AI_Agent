import "dotenv/config";
import { copyFileSync, existsSync, mkdirSync } from "fs";
import { basename, dirname, resolve } from "path";

const databaseUrl = process.env.DATABASE_URL ?? "file:../../../storage/database/app.db";
const dbPath = resolve(__dirname, "../../packages/database", databaseUrl.replace("file:", ""));
const backupDir = resolve(process.cwd(), "storage/backups");

if (!existsSync(dbPath)) {
  throw new Error(`Database file not found: ${dbPath}`);
}

mkdirSync(backupDir, { recursive: true });
const stamp = new Date().toISOString().replace(/[:.]/g, "-");
const target = resolve(backupDir, `${basename(dbPath, ".db")}-${stamp}.db`);
copyFileSync(dbPath, target);
console.log(`Backup created: ${target}`);
