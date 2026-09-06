-- Migration: Add deadline reminder fields to habits table
ALTER TABLE public.habits
    ADD COLUMN IF NOT EXISTS reminder_enabled BOOLEAN NOT NULL DEFAULT FALSE,
    ADD COLUMN IF NOT EXISTS reminder_time TEXT DEFAULT '20:00',
    ADD COLUMN IF NOT EXISTS reminder_message TEXT,
    ADD COLUMN IF NOT EXISTS reminder_email TEXT,
    ADD COLUMN IF NOT EXISTS last_reminded_date TEXT;
