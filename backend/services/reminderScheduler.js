import { supabase } from "../supabase.js";
import { sendHabitReminder } from "./mailer.js";

let schedulerInterval = null;
let isScanning = false;

function getCurrentTimeHHMM(date = new Date()) {
  const hours = String(date.getHours()).padStart(2, "0");
  const minutes = String(date.getMinutes()).padStart(2, "0");
  return `${hours}:${minutes}`;
}

function getTodayYYYYMMDD(date = new Date()) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

/**
 * Scans active habits with reminders enabled and dispatches reminder emails if uncompleted past deadline
 */
export async function checkRemindersNow(inMemoryHabitsStore = null, inMemoryCompletionsStore = null) {
  if (isScanning) return { count: 0, status: "already_scanning" };
  isScanning = true;

  const now = new Date();
  const currentTime = getCurrentTimeHHMM(now);
  const todayStr = getTodayYYYYMMDD(now);
  let remindersSent = 0;

  try {
    // 1. Fetch active habits with reminder enabled from Supabase or in-memory fallback
    let habitsToCheck = [];

    if (process.env.SUPABASE_URL && !process.env.SUPABASE_URL.includes("placeholder")) {
      const { data, error } = await supabase
        .from("habits")
        .select("*, user:auth.users(id, email)")
        .eq("reminder_enabled", true)
        .eq("archived", false);

      if (!error && data) {
        habitsToCheck = data;
      }
    } else if (inMemoryHabitsStore) {
      // In-memory mode for development and automated testing
      for (const [userId, userHabits] of inMemoryHabitsStore.entries()) {
        for (const h of userHabits) {
          if (h.reminder_enabled && !h.archived) {
            habitsToCheck.push({
              ...h,
              _ref: h,
              user: { id: userId, email: h.reminder_email || "user@aloft.local" },
            });
          }
        }
      }
    }

    for (const habit of habitsToCheck) {
      const reminderTime = habit.reminder_time || "20:00";
      const lastReminded = habit.last_reminded_date || null;

      // Condition 1: Has deadline passed for today?
      const isPastDeadline = currentTime >= reminderTime;

      // Condition 2: Has user already been sent a reminder today?
      const alreadyRemindedToday = lastReminded === todayStr;

      if (isPastDeadline && !alreadyRemindedToday) {
        // Condition 3: Is habit completed today?
        let isCompleted = false;

        if (process.env.SUPABASE_URL && !process.env.SUPABASE_URL.includes("placeholder")) {
          const { data: completion } = await supabase
            .from("habit_completions")
            .select("completed")
            .eq("habit_id", habit.id)
            .eq("date", todayStr)
            .maybeSingle();

          isCompleted = Boolean(completion?.completed);
        } else if (inMemoryCompletionsStore) {
          const completions = inMemoryCompletionsStore.get(habit.id) || {};
          isCompleted = Boolean(completions[todayStr]);
        }

        // If NOT completed today, send custom reminder email
        if (!isCompleted) {
          const recipientEmail =
            habit.reminder_email || habit.user?.email || (habit.user_id ? `${habit.user_id}@aloft.local` : null);

          if (recipientEmail && recipientEmail.includes("@")) {
            try {
              await sendHabitReminder({
                to: recipientEmail,
                habitTitle: habit.title,
                habitIcon: habit.icon || "🎯",
                deadlineTime: reminderTime,
                customMessage: habit.reminder_message,
              });

              remindersSent += 1;

              // Mark as reminded today to prevent duplicate spam
              if (process.env.SUPABASE_URL && !process.env.SUPABASE_URL.includes("placeholder")) {
                await supabase
                  .from("habits")
                  .update({ last_reminded_date: todayStr })
                  .eq("id", habit.id);
              } else {
                if (habit._ref) {
                  habit._ref.last_reminded_date = todayStr;
                }
                habit.last_reminded_date = todayStr;
              }

              console.log(
                `[Reminder Scheduler] Sent deadline alert for "${habit.title}" to ${recipientEmail} (deadline: ${reminderTime})`
              );
            } catch (err) {
              console.error(
                `[Reminder Scheduler] Failed to send reminder email for "${habit.title}":`,
                err.message
              );
            }
          }
        }
      }
    }
  } catch (err) {
    console.error("[Reminder Scheduler] Error running reminder scan:", err.message);
  } finally {
    isScanning = false;
  }

  return { remindersSent, timestamp: new Date().toISOString() };
}

/**
 * Starts background scheduler interval (runs every 60 seconds)
 */
export function startReminderScheduler(intervalMs = 60000) {
  if (schedulerInterval) return;

  // Run initial check after 5 seconds, then every interval
  setTimeout(() => {
    checkRemindersNow().catch(() => {});
  }, 5000);

  schedulerInterval = setInterval(() => {
    checkRemindersNow().catch(() => {});
  }, intervalMs);

  console.log(`[Reminder Scheduler] Started habit reminder worker (interval: ${intervalMs / 1000}s)`);
}

/**
 * Stops the background scheduler
 */
export function stopReminderScheduler() {
  if (schedulerInterval) {
    clearInterval(schedulerInterval);
    schedulerInterval = null;
    console.log("[Reminder Scheduler] Stopped habit reminder worker");
  }
}
