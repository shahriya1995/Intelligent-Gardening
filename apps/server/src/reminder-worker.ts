import { getDatabase } from "./db.js";
import { gardenTimezone, reminderInstant } from "./reminder-time.js";
import { deliverDueReminders } from "./reminder-service.js";

const webhookUrl = process.env.OPEN_WEBUI_REMINDER_WEBHOOK_URL;
if (!webhookUrl) throw new Error("OPEN_WEBUI_REMINDER_WEBHOOK_URL is required");
const parsed = new URL(webhookUrl);
if (!["http:", "https:"].includes(parsed.protocol)) throw new Error("Reminder webhook must use HTTP or HTTPS");

const timezone = gardenTimezone();
reminderInstant("2030-01-01", "09:00", timezone);
getDatabase();

const interval = Number(process.env.GARDEN_REMINDER_POLL_SECONDS ?? "30");
if (!Number.isInteger(interval) || interval < 5 || interval > 3600) {
  throw new Error("GARDEN_REMINDER_POLL_SECONDS must be between 5 and 3600");
}

let running = false;
async function poll(): Promise<void> {
  if (running) return;
  running = true;
  try {
    const result = await deliverDueReminders(webhookUrl!);
    if (result.sent || result.failed) {
      console.log(`Reminder poll: ${result.sent} delivered, ${result.failed} pending retry`);
    }
  } finally {
    running = false;
  }
}

console.log(`Garden reminder worker started (${timezone}, every ${interval}s)`);
await poll();
setInterval(() => void poll().catch((error: unknown) => {
  console.error("Reminder poll failed:", error instanceof Error ? error.message : error);
}), interval * 1000);
