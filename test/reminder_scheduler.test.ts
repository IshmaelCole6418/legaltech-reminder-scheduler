import test from "node:test";
import assert from "node:assert/strict";
import { decideReminder } from "../src/reminder_scheduler.ts";

test("schedules a follow-up only when a full day remains before the deadline", () => {
  const now = new Date("2030-06-10T12:00:00Z");
  const decision = decideReminder({
    matterId: "matter-42",
    kind: "deadline-follow-up",
    dueAt: "2030-06-12T15:00:00Z",
    taskUrl: "https://example.com/reminders/legaltech"
  }, now);

  assert.equal(decision.shouldSchedule, true);
  assert.equal(decision.cronExpr, "0 15 11 6 *");
});

test("does not create a reminder when less than a day remains", () => {
  const decision = decideReminder({
    matterId: "matter-42",
    kind: "signed-document-delivery",
    dueAt: "2030-06-10T20:00:00Z",
    taskUrl: "https://example.com/reminders/legaltech"
  }, new Date("2030-06-10T12:00:00Z"));

  assert.equal(decision.shouldSchedule, false);
  assert.equal(decision.reason, "less than one day remains");
});
