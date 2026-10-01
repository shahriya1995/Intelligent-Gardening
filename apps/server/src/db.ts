import { mkdirSync } from "node:fs";
import { dirname } from "node:path";
import { DatabaseSync } from "node:sqlite";
import { DEFAULT_REMINDER_TIME, gardenTimezone, reminderInstant } from "./reminder-time.js";

const schema = `
PRAGMA journal_mode=WAL;
PRAGMA busy_timeout=5000;
PRAGMA foreign_keys=ON;
CREATE TABLE IF NOT EXISTS gardens (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL,
  location TEXT NOT NULL DEFAULT '',
  hardiness_zone TEXT NOT NULL DEFAULT '',
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE TABLE IF NOT EXISTS tasks (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  garden_id INTEGER NOT NULL REFERENCES gardens(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  due_date TEXT NOT NULL,
  reminder_time TEXT NOT NULL DEFAULT '09:00',
  reminder_timezone TEXT NOT NULL DEFAULT 'America/Los_Angeles',
  reminder_at TEXT,
  reminder_sent_at TEXT,
  plant TEXT NOT NULL DEFAULT '',
  notes TEXT NOT NULL DEFAULT '',
  completed INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE TABLE IF NOT EXISTS plants (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  garden_id INTEGER NOT NULL REFERENCES gardens(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  variety TEXT NOT NULL DEFAULT '',
  quantity INTEGER NOT NULL DEFAULT 1 CHECK(quantity > 0),
  planted_date TEXT NOT NULL DEFAULT '',
  notes TEXT NOT NULL DEFAULT '',
  active INTEGER NOT NULL DEFAULT 1,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE TABLE IF NOT EXISTS documents (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  title TEXT NOT NULL,
  content TEXT NOT NULL,
  source_url TEXT NOT NULL DEFAULT '',
  publisher TEXT NOT NULL DEFAULT '',
  region TEXT NOT NULL DEFAULT '',
  tags TEXT NOT NULL DEFAULT '[]',
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);`;

let database: DatabaseSync | undefined;

function migrateReminders(db: DatabaseSync): void {
  db.exec("BEGIN IMMEDIATE");
  try {
    const columns = new Set((db.prepare("PRAGMA table_info(tasks)").all() as Array<{ name: string }>).map((column) => column.name));
    const needsBackfill = !columns.has("reminder_at");
    if (!columns.has("reminder_time")) db.exec("ALTER TABLE tasks ADD COLUMN reminder_time TEXT NOT NULL DEFAULT '09:00'");
    if (!columns.has("reminder_timezone")) db.exec("ALTER TABLE tasks ADD COLUMN reminder_timezone TEXT NOT NULL DEFAULT 'America/Los_Angeles'");
    if (!columns.has("reminder_at")) db.exec("ALTER TABLE tasks ADD COLUMN reminder_at TEXT");
    if (!columns.has("reminder_sent_at")) db.exec("ALTER TABLE tasks ADD COLUMN reminder_sent_at TEXT");
    db.exec("CREATE INDEX IF NOT EXISTS idx_tasks_pending_reminders ON tasks(reminder_at) WHERE completed = 0 AND reminder_sent_at IS NULL");

    if (needsBackfill) {
      const timezone = gardenTimezone();
      const now = new Date().toISOString();
      const oldTasks = db.prepare("SELECT id, due_date FROM tasks WHERE completed = 0").all() as Array<{ id: number; due_date: string }>;
      const update = db.prepare("UPDATE tasks SET reminder_time=?, reminder_timezone=?, reminder_at=? WHERE id=?");
      for (const task of oldTasks) {
        const at = reminderInstant(task.due_date, DEFAULT_REMINDER_TIME, timezone);
        update.run(DEFAULT_REMINDER_TIME, timezone, at > now ? at : null, task.id);
      }
    }
    db.exec("COMMIT");
  } catch (error) {
    db.exec("ROLLBACK");
    throw error;
  }
}

export function getDatabase(): DatabaseSync {
  if (database) return database;
  const path = process.env.GARDEN_DB_PATH ?? "data/garden.db";
  mkdirSync(dirname(path), { recursive: true });
  const opened = new DatabaseSync(path);
  try {
    opened.exec(schema);
    migrateReminders(opened);
  } catch (error) {
    opened.close();
    throw error;
  }
  database = opened;
  return database;
}

export function closeDatabase(): void {
  database?.close();
  database = undefined;
}
