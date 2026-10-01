import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import * as service from "./service.js";
import { currentDateTime, gardenWeather } from "./context.js";

const output = (value: unknown) => ({
  content: [{ type: "text" as const, text: JSON.stringify(value, null, 2) }],
  // MCP requires structuredContent itself to be an object. List tools return
  // arrays, so keep every result behind a stable object envelope.
  structuredContent: { result: value },
});

export function createMcpServer(): McpServer {
  const server = new McpServer({ name: "Intelligent Gardening", version: "0.3.0" });
  server.tool("create_garden", "Create a garden profile for planning and scheduling.", { name: z.string(), location: z.string().default(""), hardiness_zone: z.string().default("") }, (v) => output(service.createGarden(v.name, v.location, v.hardiness_zone)));
  server.tool("list_gardens", "List garden profiles available to this installation.", {}, () => output(service.listGardens()));
  server.tool("add_garden_plant", "Remember a plant that is growing in a saved garden. Use this when the user says they have, planted, or added a plant.", { garden_id: z.number().int(), name: z.string().min(1), variety: z.string().default(""), quantity: z.number().int().positive().default(1), planted_date: z.union([z.string().date(), z.literal("")]).default(""), notes: z.string().default("") }, (v) => output(service.addPlant(v.garden_id, v.name, v.variety, v.quantity, v.planted_date, v.notes)));
  server.tool("list_garden_plants", "List plants remembered for a garden. Use this before plant-specific planning or answering what is growing.", { garden_id: z.number().int(), include_archived: z.boolean().default(false) }, (v) => output(service.listPlants(v.garden_id, v.include_archived)));
  server.tool("archive_garden_plant", "Archive a plant that is no longer growing in the garden. Only use when the user asks to remove or archive it.", { plant_id: z.number().int() }, (v) => output(service.archivePlant(v.plant_id)));
  server.tool("schedule_garden_task", "Schedule a dated garden task with a reminder. If no reminder time is given, remind at 09:00 in the configured garden timezone. Use get_current_datetime before interpreting relative dates.", { garden_id: z.number().int(), title: z.string(), due_date: z.string().date(), plant: z.string().default(""), notes: z.string().default(""), reminder_time: z.string().regex(/^([01][0-9]|2[0-3]):[0-5][0-9]$/).optional().describe("Optional 24-hour local time HH:mm"), reminder_timezone: z.string().optional().describe("Optional IANA timezone, such as America/Los_Angeles") }, (v) => output(service.createTask(v.garden_id, v.title, v.due_date, v.plant, v.notes, v.reminder_time, v.reminder_timezone)));
  server.tool("list_garden_tasks", "List scheduled tasks for a garden.", { garden_id: z.number().int(), include_completed: z.boolean().default(false) }, (v) => output(service.listTasks(v.garden_id, v.include_completed)));
  server.tool("complete_garden_task", "Mark a scheduled garden task complete.", { task_id: z.number().int() }, (v) => output(service.completeTask(v.task_id)));
  server.tool("get_current_datetime", "Get the actual current date and time in an IANA timezone. Use this before making date-sensitive plans.", { timezone: z.string().default("UTC").describe("IANA timezone, for example America/Los_Angeles") }, (v) => output(currentDateTime(v.timezone)));
  server.tool("get_garden_weather", "Get live current conditions and a weather forecast for a saved garden's configured location. Use this before weather-sensitive planning.", { garden_id: z.number().int(), forecast_days: z.number().int().min(1).max(16).default(7) }, async (v) => output(await gardenWeather(v.garden_id, v.forecast_days)));
  server.tool("search_gardening_knowledge", "Search trusted gardening documents and return citation metadata.", { query: z.string(), region: z.string().default(""), limit: z.number().int().min(1).max(20).default(5) }, (v) => output({ query: v.query, results: service.searchKnowledge(v.query, v.region, v.limit) }));
  return server;
}
