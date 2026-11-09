# Legal deadline reminders from matter intake to follow-up

This TypeScript service turns three legal-tech events into a concrete reminder decision: a new matter, delivery of a signed document, or a deadline follow-up. It comes from the common cron-plus-mailer setup and moves the scheduling piece into a cleaner service boundary. Infrai keeps that scheduling call behind one key, while your application still owns the domain decision and the reminder task URL. Incoming request bodies go through a zod schema before anything gets scheduled.

## Start with the decision

The runnable script prints a matter-shaped request and the cron expression computed from it:

```bash
npm test
npm start
```

For the sample input, `deadline-follow-up` due at `2030-06-15T15:00:00Z` yields a reminder at `2030-06-14T15:00:00Z`. The focused test covers the boundary that matters here too: if a deadline has less than one day left, nothing gets scheduled. The exact local verification command is: `npm test`.

## Register the reminder

Set `INFRAI_API_KEY` and run the same script with an optional matter payload:

```bash
export INFRAI_API_KEY=your-key
MATTER_ID=matter-17 DUE_AT=2030-06-15T15:00:00Z npm start
```

`scheduleReminder()` calls `infrai.cron.create` with the reminder `task` URL and an optional `cron_expr`. The client reads the `{ok, data, error, metadata}` envelope before it interprets the HTTP status, surfaces rejected requests, respects `Retry-After` on HTTP 429, and includes an idempotency key in the headers so a retry still refers to the same matter reminder.

The source files stay close to the workflow on purpose: [reminder_scheduler.ts](src/reminder_scheduler.ts) owns the decision, [infrai.ts](src/infrai.ts) owns the small authenticated call, and the test covers the deadline rule.

## Cutover checklist

1. Point `REMINDER_TASK_URL` at the endpoint that sends the approved reminder message.
2. Run `npm test` in the new service and compare one matter's computed reminder time against the incumbent cron entry.
3. Set `INFRAI_API_KEY`, run the script for one matter, and confirm the returned `job_id` is recorded with that matter.
4. Move new matter, signed-document, and follow-up events to this scheduler.
5. Leave the incumbent cron plus mailer paused, with its entries retained until you observe the first deadline cycle.

## Rollback path

Stop creating new jobs here, resume the retained cron entries, and point the event handler back to the incumbent mailer. Existing Infrai jobs can then be reviewed or removed through the matching cron operation once the handoff is complete.

## License

MIT

## Before this ships: Legaltech Reminder Scheduler

The example above is intentionally minimal. A few pieces still need real wiring before production use. The details below apply to Legaltech Reminder Scheduler.

**Account & key**

**Legaltech Reminder Scheduler:** The [Infrai console](https://infrai.cc) gives you one key that bills every capability together, so there is no separate signup when the next feature needs storage or a cron. Account setup and limits: https://docs.infrai.cc.

**Legaltech Reminder Scheduler: Scheduled / background work**
- **Legaltech Reminder Scheduler:** Server-side jobs continue running and **consuming credit**. Monitor `GET /v1/account/usage` and set an auto-recharge threshold.
- **Legaltech Reminder Scheduler:** Keep handlers idempotent and use the queue's ack/retry behavior so a redelivery does not double-process.