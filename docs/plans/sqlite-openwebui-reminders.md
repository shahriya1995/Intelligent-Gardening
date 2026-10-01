# SQLite reminders through Open WebUI

Status: implemented on `feat/sqlite-openwebui-reminders`; live Open WebUI delivery remains to be verified before merge.

## Goal and scope

Deliver garden task reminders without introducing another database or frontend. Open WebUI remains the chat interface; SQLite remains the source of truth for tasks and reminder state. This first version assumes one trusted user and a shared local SQLite database. It does not provide per-user isolation.

## Design decisions

- The existing `schedule_garden_task` MCP tool and task REST endpoint accept an optional local `reminder_time` (`HH:mm`) and IANA `reminder_timezone`. Date-only tasks use 09:00 in `GARDEN_TIMEZONE` (default `America/Los_Angeles`). The server converts that local time to a UTC `reminder_at` when saving the task.
- Task rows hold `reminder_time`, `reminder_timezone`, `reminder_at`, and `reminder_sent_at`. A separate, optional `gardener-reminders` Compose service reads due, incomplete, unsent tasks from the same SQLite volume every 30 seconds by default.
- The worker posts `{ "content": "..." }` to a private Open WebUI channel webhook. A successful HTTP response marks the reminder sent. A failed request leaves it pending for retry, including after worker restart. Completing a task suppresses its unsent reminder.
- The migration gives existing incomplete tasks a reminder only when their default 09:00 due time is still in the future. It does not flood the channel with old overdue tasks.
- The webhook URL contains a posting token and belongs in ignored `.env`, never in the repository or logs. The MCP endpoint itself remains local and unauthenticated; it must not be exposed publicly.

## Interaction

1. In an Open WebUI chat, the user asks the model to schedule a garden task. The model calls the MCP tool, which saves the task and its UTC reminder time in SQLite.
2. When the task becomes due, the worker sends its message to the configured channel webhook and records successful delivery in SQLite.
3. The user sees the message in the private channel. Browser notifications depend on Open WebUI and browser settings and require the app to be open; this is not background push delivery.

The worker is independent of the model and Open WebUI chat session. The model does not need to be running when the reminder becomes due.

## Reliability and boundaries

Delivery is **at least once**, not guaranteed exactly once: a worker crash after the webhook accepts a message but before SQLite records success may post it again on restart. Only one worker instance should run against this database. The worker retries failed posts, but there is no retry limit or dead-letter queue in this version.

No recurring schedules, email/SMS/push delivery while Open WebUI is closed, per-user reminder routing, or standalone React reminder UI are included. A later frontend can use the same task/reminder data and introduce another delivery adapter without moving the source of truth out of SQLite.

## Verification

- Automated tests cover time zones and daylight saving transitions, retry and sent state, completed tasks, migration behavior, and the MCP tool. Type checking, tests, build, and Compose configuration validation passed on the branch.
- Live acceptance test still required: configure a private channel webhook, start the reminder profile, schedule a task five minutes ahead, and confirm one channel message appears. Then confirm worker logs show delivery and a completed task does not send.

For setup and commands, see [Enable SQLite reminders in Open WebUI](../../README.md#enable-sqlite-reminders-in-open-webui).
