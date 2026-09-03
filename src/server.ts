import cors from "cors";
import express, { type NextFunction, type Request, type Response } from "express";
import { ZodError } from "zod";
import { getDatabase } from "./db.js";
import { openApiDocument } from "./openapi.js";
import { documentSchema, gardenSchema, plantSchema, searchSchema, taskSchema } from "./schemas.js";
import * as service from "./service.js";

export const app = express();
app.use(cors());
app.use(express.json({ limit: "2mb" }));

function authorize(req: Request, res: Response, next: NextFunction): void {
  const expected = process.env.GARDEN_API_KEY ?? "";
  if (expected && req.header("authorization") !== `Bearer ${expected}`) {
    res.status(401).json({ detail: "Invalid or missing bearer token" });
    return;
  }
  next();
}

app.get("/health", (_req, res) => res.json({ status: "ok" }));
app.get("/openapi.json", (_req, res) => res.json(openApiDocument));
app.use(authorize);
app.post("/gardens", (req, res) => { const value = gardenSchema.parse(req.body); res.json(service.createGarden(value.name, value.location, value.hardiness_zone)); });
app.get("/gardens", (_req, res) => res.json(service.listGardens()));
app.post("/plants", (req, res) => { const value = plantSchema.parse(req.body); res.json(service.addPlant(value.garden_id, value.name, value.variety, value.quantity, value.planted_date, value.notes)); });
app.get("/gardens/:gardenId/plants", (req, res) => res.json(service.listPlants(Number(req.params.gardenId), req.query.include_archived === "true")));
app.post("/plants/:plantId/archive", (req, res) => res.json(service.archivePlant(Number(req.params.plantId))));
app.post("/tasks", (req, res) => { const value = taskSchema.parse(req.body); res.json(service.createTask(value.garden_id, value.title, value.due_date, value.plant, value.notes)); });
app.get("/gardens/:gardenId/tasks", (req, res) => res.json(service.listTasks(Number(req.params.gardenId), req.query.include_completed === "true")));
app.post("/tasks/:taskId/complete", (req, res) => res.json(service.completeTask(Number(req.params.taskId))));
app.post("/knowledge/documents", (req, res) => { const value = documentSchema.parse(req.body); res.json(service.addDocument(value)); });
app.post("/knowledge/search", (req, res) => { const value = searchSchema.parse(req.body); res.json({ query: value.query, results: service.searchKnowledge(value.query, value.region, value.limit) }); });

app.use((error: unknown, _req: Request, res: Response, _next: NextFunction) => {
  if (error instanceof ZodError) return res.status(422).json({ detail: error.issues });
  const message = error instanceof Error ? error.message : "Unexpected error";
  res.status(message.includes("does not exist") ? 404 : 500).json({ detail: message });
});

if (process.env.NODE_ENV !== "test") {
  getDatabase();
  app.listen(8000, "0.0.0.0", () => console.log("Open Gardener API listening on http://0.0.0.0:8000"));
}
