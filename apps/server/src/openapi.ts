const gardenSchema = { type: "object", required: ["name"], properties: { name: { type: "string" }, location: { type: "string" }, hardiness_zone: { type: "string" } } };
const taskSchema = { type: "object", required: ["garden_id", "title", "due_date"], properties: { garden_id: { type: "integer" }, title: { type: "string" }, due_date: { type: "string", format: "date" }, reminder_time: { type: "string", pattern: "^([01][0-9]|2[0-3]):[0-5][0-9]$", default: "09:00" }, reminder_timezone: { type: "string", description: "IANA timezone; defaults to GARDEN_TIMEZONE" }, plant: { type: "string" }, notes: { type: "string" } } };
const plantSchema = { type: "object", required: ["garden_id", "name"], properties: { garden_id: { type: "integer" }, name: { type: "string" }, variety: { type: "string" }, quantity: { type: "integer", minimum: 1, default: 1 }, planted_date: { type: "string", format: "date" }, notes: { type: "string" } } };
const documentSchema = { type: "object", required: ["title", "content"], properties: { title: { type: "string" }, content: { type: "string" }, source_url: { type: "string" }, publisher: { type: "string" }, region: { type: "string" }, tags: { type: "array", items: { type: "string" } } } };
const searchSchema = { type: "object", required: ["query"], properties: { query: { type: "string" }, region: { type: "string" }, limit: { type: "integer", minimum: 1, maximum: 20, default: 5 } } };

export const openApiDocument = {
  openapi: "3.1.0",
  info: { title: "Intelligent Gardening Tools", version: "0.3.0", description: "Model-independent gardening planner, scheduler, and cited knowledge API." },
  servers: [{ url: "/" }],
  components: { securitySchemes: { bearerAuth: { type: "http", scheme: "bearer" } } },
  security: [{ bearerAuth: [] }],
  paths: {
    "/health": { get: { operationId: "garden_health", security: [], responses: { "200": { description: "Healthy" } } } },
    "/gardens": {
      get: { operationId: "list_gardens", responses: { "200": { description: "Gardens" } } },
      post: { operationId: "create_garden", requestBody: jsonBody("Garden details", gardenSchema), responses: { "200": { description: "Created garden" } } },
    },
    "/plants": { post: { operationId: "add_garden_plant", requestBody: jsonBody("Plant to remember", plantSchema), responses: { "200": { description: "Stored plant" } } } },
    "/gardens/{garden_id}/plants": { get: { operationId: "list_garden_plants", parameters: [pathNumber("garden_id"), { name: "include_archived", in: "query", schema: { type: "boolean", default: false } }], responses: { "200": { description: "Garden plants" } } } },
    "/plants/{plant_id}/archive": { post: { operationId: "archive_garden_plant", parameters: [pathNumber("plant_id")], responses: { "200": { description: "Archived plant" } } } },
    "/tasks": { post: { operationId: "schedule_garden_task", requestBody: jsonBody("Task details", taskSchema), responses: { "200": { description: "Created task" } } } },
    "/gardens/{garden_id}/tasks": { get: { operationId: "list_garden_tasks", parameters: [pathNumber("garden_id"), { name: "include_completed", in: "query", schema: { type: "boolean", default: false } }], responses: { "200": { description: "Garden tasks" } } } },
    "/tasks/{task_id}/complete": { post: { operationId: "complete_garden_task", parameters: [pathNumber("task_id")], responses: { "200": { description: "Completed task" } } } },
    "/knowledge/documents": { post: { operationId: "add_gardening_document", requestBody: jsonBody("Source-attributed document", documentSchema), responses: { "200": { description: "Stored document" } } } },
    "/knowledge/search": { post: { operationId: "search_gardening_knowledge", requestBody: jsonBody("Search request", searchSchema), responses: { "200": { description: "Ranked results" } } } },
  },
} as const;

function jsonBody(description: string, schema: object) {
  return { required: true, content: { "application/json": { schema: { description, ...schema } } } };
}

function pathNumber(name: string) {
  return { name, in: "path", required: true, schema: { type: "integer" } };
}
