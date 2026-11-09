import { infrai } from "./infrai.ts";
import { z } from "zod";

export type ReminderKind = "matter-intake" | "signed-document-delivery" | "deadline-follow-up";

export type ReminderRequest = {
  matterId: string;
  kind: ReminderKind;
  dueAt: string;
  taskUrl: string;
};

export const reminderRequestSchema = z.object({
  matterId: z.string().min(1),
  kind: z.enum(["matter-intake", "signed-document-delivery", "deadline-follow-up"]),
  dueAt: z.string().datetime({ offset: true }),
  taskUrl: z.string().url()
});

export function parseReminderRequest(body: unknown): ReminderRequest {
  return reminderRequestSchema.parse(body);
}

export type ReminderDecision = {
  shouldSchedule: boolean;
  reason: string;
  cronExpr: string;
};

export function decideReminder(input: ReminderRequest, now = new Date()): ReminderDecision {
  const due = new Date(input.dueAt);
  if (Number.isNaN(due.getTime())) return { shouldSchedule: false, reason: "invalid due date", cronExpr: "" };
  if (due <= now) return { shouldSchedule: false, reason: "deadline is already due", cronExpr: "" };
  const reminder = new Date(due.getTime() - 24 * 60 * 60 * 1000);
  return {
    shouldSchedule: reminder > now,
    reason: reminder > now ? `schedule ${input.kind} reminder` : "less than one day remains",
    cronExpr: `${reminder.getUTCMinutes()} ${reminder.getUTCHours()} ${reminder.getUTCDate()} ${reminder.getUTCMonth() + 1} *`
  };
}

export async function scheduleReminder(input: ReminderRequest, now = new Date()): Promise<string | null> {
  const decision = decideReminder(input, now);
  if (!decision.shouldSchedule) return null;
  const result = await infrai.cron.create(
    { cron_expr: decision.cronExpr, task: input.taskUrl },
    `matter-reminder:${input.matterId}:${input.kind}:${input.dueAt}`
  );
  return result.job_id;
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const request: ReminderRequest = {
    matterId: process.env.MATTER_ID ?? "matter-demo-17",
    kind: "deadline-follow-up",
    dueAt: process.env.DUE_AT ?? "2030-06-15T15:00:00Z",
    taskUrl: process.env.REMINDER_TASK_URL ?? "https://example.com/reminders/legaltech"
  };
  const decision = decideReminder(request);
  console.log(JSON.stringify({ request, decision }, null, 2));
  if (process.env.INFRAI_API_KEY) {
    console.log(JSON.stringify({ job_id: await scheduleReminder(request) }, null, 2));
  }
}
