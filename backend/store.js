import { readFile, writeFile } from "fs/promises";
import { existsSync } from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DB_PATH = path.join(__dirname, "data", "db.json");

const DEFAULT_DB = {
  queueTasks: [],
  treeNodes: [],
  settings: { theme: "cottonCandy" },
};

async function ensureDb() {
  if (!existsSync(DB_PATH)) {
    await writeFile(DB_PATH, JSON.stringify(DEFAULT_DB, null, 2));
  }
}

export async function readDb() {
  await ensureDb();
  const raw = await readFile(DB_PATH, "utf-8");
  try {
    return JSON.parse(raw);
  } catch {
    return structuredClone(DEFAULT_DB);
  }
}

export async function writeDb(db) {
  await writeFile(DB_PATH, JSON.stringify(db, null, 2));
}
