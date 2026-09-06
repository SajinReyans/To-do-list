import { test, describe, before, after } from "node:test";
import assert from "node:assert/strict";
import http from "node:http";
import app from "../app.js";
import { sendHabitReminder } from "../services/mailer.js";
import { checkRemindersNow } from "../services/reminderScheduler.js";
import { inMemoryHabits, inMemoryCompletions } from "../routes/habits.js";

let server;
let baseUrl;

before(async () => {
  await new Promise((resolve) => {
    server = http.createServer(app);
    server.listen(0, () => {
      const port = server.address().port;
      baseUrl = `http://127.0.0.1:${port}`;
      resolve();
    });
  });
});

after(async () => {
  if (server) {
    await new Promise((resolve) => server.close(resolve));
  }
});

describe("Habit Reminders & Email Notification Engine", () => {
  test("sendHabitReminder sends email successfully and returns result", async () => {
    const result = await sendHabitReminder({
      to: "testuser@example.com",
      habitTitle: "Morning Jog",
      habitIcon: "🏃",
      streak: 5,
      deadlineTime: "20:00",
      customMessage: "You haven't done your run today! Go now!",
      isTest: true,
    });

    assert.equal(result.success, true);
    assert.ok(result.messageId);
  });

  test("sendHabitReminder throws if recipient email is invalid", async () => {
    await assert.rejects(
      async () => {
        await sendHabitReminder({
          to: "not-an-email",
          habitTitle: "Read",
        });
      },
      {
        name: "Error",
        message: "A valid recipient email address is required",
      }
    );
  });

  test("POST /api/habits creates a habit with reminder configuration", async () => {
    const res = await fetch(`${baseUrl}/api/habits`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: "Bearer mock-guest-token",
      },
      body: JSON.stringify({
        title: "Daily Meditation",
        icon: "🧘",
        reminderEnabled: true,
        reminderTime: "21:30",
        reminderMessage: "You haven't meditated today! Take 10 minutes before bed.",
        reminderEmail: "meditator@example.com",
      }),
    });

    assert.equal(res.status, 201);
    const habit = await res.json();
    assert.equal(habit.title, "Daily Meditation");
    assert.equal(habit.reminderEnabled, true);
    assert.equal(habit.reminderTime, "21:30");
    assert.equal(habit.reminderMessage, "You haven't meditated today! Take 10 minutes before bed.");
    assert.equal(habit.reminderEmail, "meditator@example.com");

    // Test updating reminder settings via PATCH
    const patchRes = await fetch(`${baseUrl}/api/habits/${habit.id}`, {
      method: "PATCH",
      headers: {
        "Content-Type": "application/json",
        Authorization: "Bearer mock-guest-token",
      },
      body: JSON.stringify({
        reminderTime: "22:00",
        reminderMessage: "Updated: haven't done anything about it yet!",
      }),
    });

    assert.equal(patchRes.status, 200);
    const updated = await patchRes.json();
    assert.equal(updated.reminderTime, "22:00");
    assert.equal(updated.reminderMessage, "Updated: haven't done anything about it yet!");

    // Test POST /:id/test-reminder
    const testRemindRes = await fetch(`${baseUrl}/api/habits/${habit.id}/test-reminder`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: "Bearer mock-guest-token",
      },
      body: JSON.stringify({
        email: "test@example.com",
      }),
    });

    assert.equal(testRemindRes.status, 200);
    const testBody = await testRemindRes.json();
    assert.equal(testBody.ok, true);
    assert.ok(testBody.message);
  });

  test("PATCH /api/habits/:id rejects invalid reminderTime format", async () => {
    const res = await fetch(`${baseUrl}/api/habits/123e4567-e89b-42d3-a456-426614174000`, {
      method: "PATCH",
      headers: {
        "Content-Type": "application/json",
        Authorization: "Bearer mock-guest-token",
      },
      body: JSON.stringify({
        reminderTime: "twenty-hundred",
      }),
    });

    assert.equal(res.status, 400);
    const body = await res.json();
    assert.match(body.error, /HH:MM/);
  });

  test("checkRemindersNow runs scanning cycle safely", async () => {
    const result = await checkRemindersNow(inMemoryHabits, inMemoryCompletions);
    assert.ok(typeof result.remindersSent === "number");
    assert.ok(result.timestamp);
  });
});
