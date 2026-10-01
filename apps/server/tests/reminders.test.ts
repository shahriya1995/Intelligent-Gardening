import assert from "node:assert/strict";
import { DatabaseSync } from "node:sqlite";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, test } from "node:test";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { InMemoryTransport } from "@modelcontextprotocol/sdk/inMemory.js";
import { createMcpServer } from "../src/mcp.js";
import { closeDatabase, getDatabase } from "../src/db.js";
import { reminderInstant } from "../src/reminder-time.js";
import { deliverDueReminders, listDueReminders } from "../src/reminder-service.js";
import { completeTask, createGarden, createTask } from "../src/service.js";

let directory: string;
beforeEach(() => {
  directory = mkdtempSync(join(tmpdir(), "garden-reminders-"));
  process.env.GARDEN_DB_PATH = join(directory, "test.db");
  process.env.GARDEN_TIMEZONE = "America/Los_Angeles";
});
afterEach(() => {
  closeDatabase();
  rmSync(directory, { recursive: true });
});

test("converts local reminders across daylight saving transitions", () => {
  assert.equal(reminderInstant("2027-01-15", "09:00", "America/Los_Angeles"), "2027-01-15T17:00:00.000Z");
  assert.equal(reminderInstant("2027-07-15", "09:00", "America/Los_Angeles"), "2027-07-15T16:00:00.000Z");
  assert.equal(reminderInstant("2027-03-14", "02:30", "America/Los_Angeles"), "2027-03-14T10:30:00.000Z");
  assert.equal(reminderInstant("2027-11-07", "01:30", "America/Los_Angeles"), "2027-11-07T08:30:00.000Z");
  assert.throws(() => reminderInstant("2027-01-15", "09:00", "Not/AZone"));
});

test("sends due reminders once and keeps failed deliveries pending", async () => {
  const garden = createGarden("Backyard");
  const due = createTask(garden.id, "Water seedlings", "2027-01-15", "lettuce", "Check soil", "09:00", "America/Los_Angeles");
  const later = createTask(garden.id, "Prune roses", "2027-01-16");
  const now = "2027-01-15T17:00:00.000Z";
  assert.equal(due.reminder_at, now);
  assert.equal(later.reminder_time, "09:00");
  assert.deepEqual(listDueReminders(now).map((task) => task.id), [due.id]);

  const delivered: string[] = [];
  const send = async (_url: string | URL | Request, init?: RequestInit) => {
    delivered.push(String(init?.body));
    return new Response(null, { status: delivered.length === 1 ? 503 : 200 });
  };
  const failed = await deliverDueReminders("http://open-webui/webhook", now, send as typeof fetch);
  assert.deepEqual(failed, { sent: 0, failed: 1 });
  assert.equal(listDueReminders(now).length, 1);

  const success = await deliverDueReminders("http://open-webui/webhook", now, send as typeof fetch);
  assert.deepEqual(success, { sent: 1, failed: 0 });
  assert.match(delivered[1], /Garden reminder: Water seedlings/);
  closeDatabase();
  assert.equal(listDueReminders(now).length, 0);
});

test("completing a task suppresses its reminder", () => {
  const garden = createGarden("Backyard");
  const task = createTask(garden.id, "Water", "2027-01-15");
  completeTask(task.id);
  assert.equal(listDueReminders("2027-01-16T00:00:00.000Z").length, 0);
});

test("migrates only future incomplete legacy tasks", () => {
  const path = process.env.GARDEN_DB_PATH!;
  const legacy = new DatabaseSync(path);
  legacy.exec(`CREATE TABLE gardens (id INTEGER PRIMARY KEY, name TEXT NOT NULL);
    CREATE TABLE tasks (
      id INTEGER PRIMARY KEY, garden_id INTEGER NOT NULL, title TEXT NOT NULL,
      due_date TEXT NOT NULL, plant TEXT NOT NULL DEFAULT '', notes TEXT NOT NULL DEFAULT '',
      completed INTEGER NOT NULL DEFAULT 0, created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
    );
    INSERT INTO gardens VALUES (1, 'Backyard');
    INSERT INTO tasks (garden_id, title, due_date) VALUES (1, 'Future', '2099-01-15');
    INSERT INTO tasks (garden_id, title, due_date) VALUES (1, 'Old', '2020-01-15');`);
  legacy.close();

  const rows = getDatabase().prepare("SELECT title, reminder_at FROM tasks ORDER BY id").all() as Array<{ title: string; reminder_at: string | null }>;
  assert.ok(rows[0].reminder_at);
  assert.equal(rows[1].reminder_at, null);
  closeDatabase();
  assert.equal((getDatabase().prepare("SELECT reminder_at FROM tasks WHERE title='Old'").get() as { reminder_at: string | null }).reminder_at, null);
});


test("MCP client can schedule a task with a reminder", async () => {
  const garden = createGarden("Backyard");
  const [clientTransport, serverTransport] = InMemoryTransport.createLinkedPair();
  const server = createMcpServer();
  const client = new Client({ name: "reminder-test", version: "1.0.0" });
  await server.connect(serverTransport);
  await client.connect(clientTransport);
  try {
    const tools = await client.listTools();
    assert.ok(tools.tools.some((tool) => tool.name === "schedule_garden_task"));
    const response = await client.callTool({
      name: "schedule_garden_task",
      arguments: {
        garden_id: garden.id,
        title: "Water seedlings",
        due_date: "2027-01-15",
        reminder_time: "09:00",
        reminder_timezone: "America/Los_Angeles",
      },
    });
    assert.equal(response.isError, undefined);
    const task = (response.structuredContent as { result: { reminder_at?: string } } | undefined)?.result;
    assert.ok(task);
    assert.equal(task.reminder_at, "2027-01-15T17:00:00.000Z");
  } finally {
    await client.close();
    await server.close();
  }
});
