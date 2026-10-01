import { getDatabase } from "./db.js";
import type { GardenTask } from "./types.js";

export interface DueReminder extends GardenTask {
  garden_name: string;
}

export function listDueReminders(now = new Date().toISOString(), limit = 50): DueReminder[] {
  return getDatabase().prepare(
    `SELECT tasks.*, gardens.name AS garden_name
     FROM tasks JOIN gardens ON gardens.id = tasks.garden_id
     WHERE tasks.completed = 0
       AND tasks.reminder_at IS NOT NULL
       AND tasks.reminder_at <= ?
       AND tasks.reminder_sent_at IS NULL
     ORDER BY tasks.reminder_at, tasks.id
     LIMIT ?`,
  ).all(now, limit).map((row) => ({
    ...(row as unknown as Omit<DueReminder, "completed">),
    completed: Boolean((row as Record<string, unknown>).completed),
  }));
}

export function markReminderSent(taskId: number, sentAt = new Date().toISOString()): void {
  getDatabase().prepare(
    "UPDATE tasks SET reminder_sent_at = ? WHERE id = ? AND reminder_sent_at IS NULL AND completed = 0",
  ).run(sentAt, taskId);
}

export function formatReminder(reminder: DueReminder): string {
  const plant = reminder.plant ? ` · ${reminder.plant}` : "";
  const notes = reminder.notes ? `\n${reminder.notes}` : "";
  return `🌱 Garden reminder: ${reminder.title}\nGarden: ${reminder.garden_name}${plant}\nDue: ${reminder.due_date} ${reminder.reminder_time} (${reminder.reminder_timezone})${notes}`;
}

export async function deliverDueReminders(
  webhookUrl: string,
  now = new Date().toISOString(),
  send: typeof fetch = fetch,
): Promise<{ sent: number; failed: number }> {
  let sent = 0;
  let failed = 0;
  for (const reminder of listDueReminders(now)) {
    try {
      const response = await send(webhookUrl, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ content: formatReminder(reminder) }),
        signal: AbortSignal.timeout(10_000),
      });
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      markReminderSent(reminder.id, now);
      sent += 1;
    } catch {
      // Keep the reminder pending for the next poll. Never log the token-bearing URL.
      failed += 1;
    }
  }
  return { sent, failed };
}
