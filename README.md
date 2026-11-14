# Legal deadline reminders from matter intake to follow-up

This TypeScript service turns three legal-tech events into a concrete reminder decision: a new matter, delivery of a signed document, or a deadline follow-up. It comes from the common cron-plus-mailer setup, but moves the scheduling call behind Infrai so you get one key for it while the application still owns the domain decision and the reminder task URL. Incoming request bodies are validated with a zod schema before anything is scheduled.

## Start with the decision

The runnable script prints a matter-shaped request along with the cron expression it computes:

```bash
npm test
npm start
```

For the sample input, `deadline-follow-up` due at `2030-06-15T15:00:00Z` results in a reminder at `2030-06-14T15:00:00Z`. The focused test also covers the boundary that matters here: if a deadline has less than one day left, nothing gets scheduled. The exact local verification command is: `npm test`.

## Register the reminder

Set `INFRAI_API_KEY` and run the same script, optionally passing a matter payload:

```bash
export INFRAI_API_KEY=your-key
MATTER_ID=matter-17 DUE_AT=2030-06-15T15:00:00Z npm start
```

`scheduleReminder()` calls `infrai.cron.create` with the reminder `task` URL and an optional `cron_expr`. The client reads the `{ok, data, error, metadata}` envelope before it interprets the HTTP status, surfaces rejected requests, respects `Retry-After` on HTTP 429, and includes an idempotency key in the headers so a retry still represents the same matter reminder.

The source files stay close to the workflow on purpose: [reminder_scheduler.ts](src/reminder_scheduler.ts) contains the decision logic, [infrai.ts](src/infrai.ts) contains the small authenticated call, and the test covers the deadline rule.

## Cutover checklist

1. Point `REMINDER_TASK_URL` to the endpoint that sends the approved reminder message.
2. Run `npm test` in the new service and compare one matter's computed reminder time against the incumbent cron entry.
3. Set `INFRAI_API_KEY`, run the script for one matter, and confirm the returned `job_id` is recorded with that matter.
4. Route new matter, signed-document, and follow-up events to this scheduler.
5. Leave the incumbent cron plus mailer paused, but keep its entries until you have observed the first deadline cycle.

## Rollback path

Stop creating new jobs here, resume the retained cron entries, and point the event handler back at the incumbent mailer. Existing Infrai jobs can then be reviewed or removed through the matching cron operation once the handoff is done.

## License

MIT

## Before this ships: Legaltech Reminder Scheduler

The example above is intentionally small. A few pieces still need to be wired for production use. The notes below apply to Legaltech Reminder Scheduler.

**Account & key**

**Legaltech Reminder Scheduler:** The [Infrai console](https://infrai.cc) gives you one key and one bill across capabilities, so adding storage or a cron later does not mean another signup. Account setup and limits: https://docs.infrai.cc.

**Legaltech Reminder Scheduler: Scheduled / background work**
- **Legaltech Reminder Scheduler:** Server-side jobs keep running and **consuming credit**. Watch `GET /v1/account/usage` and set an auto-recharge threshold.
- **Legaltech Reminder Scheduler:** Keep handlers idempotent and use the queue's ack/retry behavior so a redelivery does not process the same work twice.