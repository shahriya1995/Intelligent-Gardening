import { getDatabase } from "./db.js";
import type { Garden, GardenPlant, GardenTask, KnowledgeDocument, SearchResult } from "./types.js";

type SqlValue = string | number | null;

function gardenRow(row: Record<string, SqlValue>): Garden {
  return row as unknown as Garden;
}

function taskRow(row: Record<string, SqlValue>): GardenTask {
  return { ...(row as unknown as Omit<GardenTask, "completed">), completed: Boolean(row.completed) };
}

function plantRow(row: Record<string, SqlValue>): GardenPlant {
  return { ...(row as unknown as Omit<GardenPlant, "active">), active: Boolean(row.active) };
}

function documentRow(row: Record<string, SqlValue>): KnowledgeDocument {
  return { ...(row as unknown as Omit<KnowledgeDocument, "tags">), tags: JSON.parse(String(row.tags)) as string[] };
}

export function createGarden(name: string, location = "", hardinessZone = ""): Garden {
  const db = getDatabase();
  const result = db.prepare("INSERT INTO gardens(name, location, hardiness_zone) VALUES (?, ?, ?)").run(name, location, hardinessZone);
  return gardenRow(db.prepare("SELECT * FROM gardens WHERE id=?").get(Number(result.lastInsertRowid)) as Record<string, SqlValue>);
}

export function listGardens(): Garden[] {
  return getDatabase().prepare("SELECT * FROM gardens ORDER BY created_at DESC, id DESC").all().map((row) => gardenRow(row as Record<string, SqlValue>));
}

export function createTask(gardenId: number, title: string, dueDate: string, plant = "", notes = ""): GardenTask {
  const db = getDatabase();
  if (!db.prepare("SELECT 1 FROM gardens WHERE id=?").get(gardenId)) throw new Error(`Garden ${gardenId} does not exist`);
  const result = db.prepare("INSERT INTO tasks(garden_id, title, due_date, plant, notes) VALUES (?, ?, ?, ?, ?)").run(gardenId, title, dueDate, plant, notes);
  return taskRow(db.prepare("SELECT * FROM tasks WHERE id=?").get(Number(result.lastInsertRowid)) as Record<string, SqlValue>);
}

export function listTasks(gardenId: number, includeCompleted = false): GardenTask[] {
  const suffix = includeCompleted ? "" : " AND completed=0";
  return getDatabase().prepare(`SELECT * FROM tasks WHERE garden_id=?${suffix} ORDER BY due_date, id`).all(gardenId).map((row) => taskRow(row as Record<string, SqlValue>));
}

export function completeTask(taskId: number): GardenTask {
  const db = getDatabase();
  db.prepare("UPDATE tasks SET completed=1 WHERE id=?").run(taskId);
  const row = db.prepare("SELECT * FROM tasks WHERE id=?").get(taskId);
  if (!row) throw new Error(`Task ${taskId} does not exist`);
  return taskRow(row as Record<string, SqlValue>);
}

export function addPlant(gardenId: number, name: string, variety = "", quantity = 1, plantedDate = "", notes = ""): GardenPlant {
  const db = getDatabase();
  if (!db.prepare("SELECT 1 FROM gardens WHERE id=?").get(gardenId)) throw new Error(`Garden ${gardenId} does not exist`);
  const result = db.prepare("INSERT INTO plants(garden_id, name, variety, quantity, planted_date, notes) VALUES (?, ?, ?, ?, ?, ?)")
    .run(gardenId, name, variety, quantity, plantedDate, notes);
  return plantRow(db.prepare("SELECT * FROM plants WHERE id=?").get(Number(result.lastInsertRowid)) as Record<string, SqlValue>);
}

export function listPlants(gardenId: number, includeArchived = false): GardenPlant[] {
  const db = getDatabase();
  if (!db.prepare("SELECT 1 FROM gardens WHERE id=?").get(gardenId)) throw new Error(`Garden ${gardenId} does not exist`);
  const suffix = includeArchived ? "" : " AND active=1";
  return db.prepare(`SELECT * FROM plants WHERE garden_id=?${suffix} ORDER BY name COLLATE NOCASE, id`).all(gardenId)
    .map((row) => plantRow(row as Record<string, SqlValue>));
}

export function archivePlant(plantId: number): GardenPlant {
  const db = getDatabase();
  db.prepare("UPDATE plants SET active=0 WHERE id=?").run(plantId);
  const row = db.prepare("SELECT * FROM plants WHERE id=?").get(plantId);
  if (!row) throw new Error(`Plant ${plantId} does not exist`);
  return plantRow(row as Record<string, SqlValue>);
}

export function addDocument(input: Omit<KnowledgeDocument, "id" | "created_at">): KnowledgeDocument {
  const db = getDatabase();
  const result = db.prepare("INSERT INTO documents(title, content, source_url, publisher, region, tags) VALUES (?, ?, ?, ?, ?, ?)")
    .run(input.title, input.content, input.source_url, input.publisher, input.region, JSON.stringify(input.tags));
  return documentRow(db.prepare("SELECT * FROM documents WHERE id=?").get(Number(result.lastInsertRowid)) as Record<string, SqlValue>);
}

function tokens(text: string): Map<string, number> {
  const counts = new Map<string, number>();
  for (const token of text.toLowerCase().match(/[a-z0-9][a-z0-9_-]+/g) ?? []) counts.set(token, (counts.get(token) ?? 0) + 1);
  return counts;
}

function cosine(a: Map<string, number>, b: Map<string, number>): number {
  let numerator = 0;
  let aLength = 0;
  let bLength = 0;
  for (const [token, value] of a) { numerator += value * (b.get(token) ?? 0); aLength += value * value; }
  for (const value of b.values()) bLength += value * value;
  return aLength && bLength ? numerator / (Math.sqrt(aLength) * Math.sqrt(bLength)) : 0;
}

export function searchKnowledge(query: string, region = "", limit = 5): SearchResult[] {
  const queryTokens = tokens(query);
  const rows = getDatabase().prepare("SELECT * FROM documents").all();
  return rows.map((row) => documentRow(row as Record<string, SqlValue>))
    .filter((document) => !region || !document.region || document.region.toLowerCase().includes(region.toLowerCase()))
    .map(({ content, ...document }) => ({
      ...document,
      score: Number(cosine(queryTokens, tokens(`${document.title} ${content} ${document.tags.join(" ")}`)).toFixed(4)),
      excerpt: content.slice(0, 800),
    }))
    .filter((result) => result.score > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, limit);
}
