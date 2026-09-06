import { useState, useEffect } from "react";
import { updateHabit, sendTestHabitReminder } from "../api.js";

export default function HabitReminderModal({ habit, isOpen, onClose, onHabitUpdated }) {
  const [enabled, setEnabled] = useState(habit?.reminderEnabled ?? false);
  const [time, setTime] = useState(habit?.reminderTime || "21:00");
  const [email, setEmail] = useState(habit?.reminderEmail || "");
  const [message, setMessage] = useState(
    habit?.reminderMessage || `You haven't done anything about "${habit?.title || "your habit"}" today! Don't let your streak break.`
  );
  const [saving, setSaving] = useState(false);
  const [testing, setTesting] = useState(false);
  const [statusMessage, setStatusMessage] = useState(null); // { type: 'success' | 'error', text: string, previewUrl?: string }

  // Sync state whenever active habit changes
  useEffect(() => {
    if (habit) {
      setEnabled(Boolean(habit.reminderEnabled));
      setTime(habit.reminderTime || "21:00");
      setEmail(habit.reminderEmail || "");
      setMessage(
        habit.reminderMessage ||
          `You haven't done anything about "${habit.title}" today! Don't let your streak break.`
      );
      setStatusMessage(null);
    }
  }, [habit]);

  // Handle ESC key to close
  useEffect(() => {
    if (!isOpen) return;
    const handleKeyDown = (e) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isOpen, onClose]);

  if (!isOpen || !habit) return null;

  const handleSave = async (e) => {
    if (e) e.preventDefault();
    setStatusMessage(null);

    if (enabled && !email.trim()) {
      setStatusMessage({
        type: "error",
        text: "Please provide a valid recipient email address to receive reminders.",
      });
      return;
    }

    setSaving(true);
    try {
      const updated = await updateHabit(habit.id, {
        reminderEnabled: enabled,
        reminderTime: time,
        reminderEmail: email.trim(),
        reminderMessage: message.trim(),
      });
      onHabitUpdated(updated);
      setStatusMessage({ type: "success", text: "Reminder settings saved successfully!" });
      setTimeout(() => {
        onClose();
      }, 700);
    } catch (err) {
      setStatusMessage({
        type: "error",
        text: err.message || "Failed to update reminder settings.",
      });
    } finally {
      setSaving(false);
    }
  };

  const handleSendTest = async () => {
    setStatusMessage(null);
    if (!email.trim()) {
      setStatusMessage({
        type: "error",
        text: "Please enter an email address to send the test reminder to.",
      });
      return;
    }

    setTesting(true);
    try {
      const res = await sendTestHabitReminder(habit.id, email.trim(), message.trim());
      setStatusMessage({
        type: "success",
        text: res.message || "Test reminder email sent!",
        previewUrl: res.previewUrl,
      });
    } catch (err) {
      setStatusMessage({
        type: "error",
        text: err.message || "Failed to send test reminder.",
      });
    } finally {
      setTesting(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm animate-fadeIn"
      onClick={onClose}
    >
      <div
        className="relative w-full max-w-lg rounded-3xl p-6 sm:p-7 border-2 shadow-2xl overflow-hidden flex flex-col gap-5 max-h-[90vh] overflow-y-auto"
        style={{ backgroundColor: "var(--surface)", borderColor: "var(--border)" }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-center gap-3">
            <span
              className="w-12 h-12 rounded-2xl flex items-center justify-center text-2xl shadow-sm border-2"
              style={{ backgroundColor: "var(--card)", borderColor: "var(--border)" }}
            >
              {habit.icon || "🔔"}
            </span>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="font-display text-xl font-bold" style={{ color: "var(--text)" }}>
                  Deadline Reminder
                </h3>
                <span
                  className="text-xs px-2.5 py-0.5 rounded-full font-semibold"
                  style={{
                    backgroundColor: enabled ? "rgba(16, 185, 129, 0.15)" : "rgba(107, 114, 128, 0.15)",
                    color: enabled ? "#059669" : "#6b7280",
                  }}
                >
                  {enabled ? "Active" : "Disabled"}
                </span>
              </div>
              <p className="text-xs mt-0.5" style={{ color: "var(--text-soft)" }}>
                For habit: <strong>{habit.title}</strong>
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="w-8 h-8 rounded-full border flex items-center justify-center text-gray-400 hover:text-black transition-colors cursor-pointer"
            style={{ borderColor: "var(--border)" }}
            aria-label="Close"
          >
            ✕
          </button>
        </div>

        <p className="text-xs leading-relaxed" style={{ color: "var(--text-soft)" }}>
          Set a daily deadline for this habit. If you have not checked it off by the designated time,
          the system will automatically dispatch your customized reminder email alerting you that you haven't done anything about it today.
        </p>

        {/* Form Body */}
        <div className="flex flex-col gap-4">
          {/* Toggle reminder active */}
          <label className="flex items-center justify-between p-3.5 rounded-2xl border-2 cursor-pointer transition-colors hover:bg-black/[0.02]"
            style={{ backgroundColor: "var(--card2)", borderColor: "var(--border)" }}
          >
            <div className="flex flex-col">
              <span className="font-semibold text-sm" style={{ color: "var(--text)" }}>
                Enable Deadline Email Reminder
              </span>
              <span className="text-xs" style={{ color: "var(--text-soft)" }}>
                Automatically scan and email if uncompleted by deadline
              </span>
            </div>
            <input
              type="checkbox"
              checked={enabled}
              onChange={(e) => setEnabled(e.target.checked)}
              className="w-5 h-5 rounded cursor-pointer accent-[#f43f5e]"
            />
          </label>

          {/* Deadline Time */}
          <div className="flex flex-col gap-1.5">
            <label className="text-xs font-bold uppercase tracking-wider" style={{ color: "var(--text)" }}>
              Daily Deadline (24h Time)
            </label>
            <div className="flex items-center gap-2">
              <input
                type="time"
                value={time}
                onChange={(e) => setTime(e.target.value)}
                disabled={!enabled}
                className="w-full sm:w-44 rounded-xl px-3.5 py-2 border-2 bg-white/80 outline-none text-sm font-semibold disabled:opacity-50"
                style={{ borderColor: "var(--border)", color: "var(--text)" }}
              />
              <span className="text-xs" style={{ color: "var(--text-soft)" }}>
                Local Time
              </span>
            </div>
          </div>

          {/* Recipient Email */}
          <div className="flex flex-col gap-1.5">
            <label className="text-xs font-bold uppercase tracking-wider" style={{ color: "var(--text)" }}>
              Recipient Email Address
            </label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="e.g. yourname@domain.com"
              disabled={!enabled}
              className="w-full rounded-xl px-3.5 py-2 border-2 bg-white/80 outline-none text-sm disabled:opacity-50"
              style={{ borderColor: "var(--border)", color: "var(--text)" }}
            />
          </div>

          {/* Custom Message */}
          <div className="flex flex-col gap-1.5">
            <label className="text-xs font-bold uppercase tracking-wider" style={{ color: "var(--text)" }}>
              Customized Reminder Message
            </label>
            <textarea
              rows={3}
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              placeholder="Write what you want the email to say when you haven't done anything about it..."
              disabled={!enabled}
              className="w-full rounded-xl p-3 border-2 bg-white/80 outline-none text-xs leading-relaxed disabled:opacity-50 resize-y"
              style={{ borderColor: "var(--border)", color: "var(--text)" }}
            />
            <p className="text-[11px]" style={{ color: "var(--text-soft)" }}>
              💡 This message will be featured prominently in the alert email.
            </p>
          </div>
        </div>

        {/* Status Notification Banner */}
        {statusMessage && (
          <div
            className={`rounded-2xl p-3.5 border-2 text-xs flex flex-col gap-1 ${
              statusMessage.type === "success"
                ? "bg-emerald-50 border-emerald-300 text-emerald-800"
                : "bg-red-50 border-red-300 text-red-800"
            }`}
          >
            <div className="flex items-center gap-2">
              <span>{statusMessage.type === "success" ? "✓" : "⚠️"}</span>
              <span className="font-semibold">{statusMessage.text}</span>
            </div>
            {statusMessage.previewUrl && (
              <a
                href={statusMessage.previewUrl}
                target="_blank"
                rel="noreferrer"
                className="text-blue-600 underline font-medium hover:text-blue-800 break-all mt-1 inline-flex items-center gap-1"
              >
                🔗 View Test Email in Ethereal Inbox &rarr;
              </a>
            )}
          </div>
        )}

        {/* Modal Actions */}
        <div className="flex flex-wrap items-center justify-between gap-3 pt-2 border-t" style={{ borderColor: "var(--border)" }}>
          <button
            type="button"
            onClick={handleSendTest}
            disabled={testing || !email.trim()}
            className="px-4 py-2 rounded-xl text-xs font-bold border-2 cursor-pointer transition-all hover:bg-black/[0.04] disabled:opacity-40"
            style={{ borderColor: "var(--border)", color: "var(--text)" }}
          >
            {testing ? "Sending Test…" : "✉️ Send Test Email"}
          </button>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 rounded-xl text-xs font-semibold cursor-pointer hover:bg-black/[0.05]"
              style={{ color: "var(--text)" }}
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={handleSave}
              disabled={saving}
              className="px-5 py-2 rounded-xl text-xs font-bold text-white shadow-md cursor-pointer transition-transform hover:-translate-y-0.5 disabled:opacity-50"
              style={{ backgroundColor: "var(--accent)" }}
            >
              {saving ? "Saving…" : "Save Reminder"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
