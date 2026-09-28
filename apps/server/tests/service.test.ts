import assert from "node:assert/strict";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, test } from "node:test";
import { closeDatabase } from "../src/db.js";
import * as service from "../src/service.js";

let directory: string;
beforeEach(() => {
  directory = mkdtempSync(join(tmpdir(), "intelligent-gardening-"));
  process.env.GARDEN_DB_PATH = join(directory, "test.db");
});
afterEach(() => { closeDatabase(); rmSync(directory, { recursive: true }); });

test("creates a garden and completes its task", () => {
  const garden = service.createGarden("Backyard", "Portland, OR", "8b");
  const task = service.createTask(garden.id, "Sow peas", "2027-02-15", "pea");
  assert.equal(service.listTasks(garden.id)[0]?.id, task.id);
  assert.equal(service.completeTask(task.id).completed, true);
});

test("remembers and archives plants in a garden", () => {
  const garden = service.createGarden("Backyard", "Fremont, CA", "9b");
  const plant = service.addPlant(garden.id, "Tomato", "Sungold", 2, "2026-04-15", "In raised bed");
  assert.equal(service.listPlants(garden.id)[0]?.variety, "Sungold");
  assert.equal(service.archivePlant(plant.id).active, false);
  assert.equal(service.listPlants(garden.id).length, 0);
  assert.equal(service.listPlants(garden.id, true).length, 1);
});

test("knowledge search returns citation metadata", () => {
  service.addDocument({ title: "Tomato late blight", content: "Late blight causes water-soaked lesions on tomato leaves and fruit.", source_url: "https://extension.example.edu/tomato-blight", publisher: "Example University Extension", region: "Pacific Northwest", tags: ["tomato", "disease"] });
  const result = service.searchKnowledge("tomato leaf blight")[0];
  assert.equal(result?.publisher, "Example University Extension");
  assert.ok(result?.source_url);
});
