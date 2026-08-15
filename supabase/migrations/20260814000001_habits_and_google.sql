-- Aloft Todo App - Habit Tracker Migration

-- 1. Create habits table
CREATE TABLE IF NOT EXISTS public.habits (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    title TEXT NOT NULL,
    color TEXT,
    icon TEXT,
    year INTEGER NOT NULL,
    archived BOOLEAN NOT NULL DEFAULT FALSE,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT timezone('utc'::text, now())
);

-- 2. Create habit_completions table
CREATE TABLE IF NOT EXISTS public.habit_completions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    habit_id UUID NOT NULL REFERENCES public.habits(id) ON DELETE CASCADE,
    date DATE NOT NULL,
    completed BOOLEAN NOT NULL DEFAULT FALSE,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT timezone('utc'::text, now()),
    CONSTRAINT habit_completions_habit_date_uniq UNIQUE (habit_id, date)
);

-- 3. Indexes for habits
CREATE INDEX IF NOT EXISTS idx_habits_user_year ON public.habits(user_id, year);
CREATE INDEX IF NOT EXISTS idx_habit_completions_user_date ON public.habit_completions(user_id, date);
CREATE INDEX IF NOT EXISTS idx_habit_completions_habit_id ON public.habit_completions(habit_id);

-- 4. Enable Row Level Security (RLS)
ALTER TABLE public.habits ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.habit_completions ENABLE ROW LEVEL SECURITY;

-- 5. RLS Policies for habits
CREATE POLICY "Users can select their own habits"
    ON public.habits FOR SELECT
    USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own habits"
    ON public.habits FOR INSERT
    WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own habits"
    ON public.habits FOR UPDATE
    USING (auth.uid() = user_id)
    WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete their own habits"
    ON public.habits FOR DELETE
    USING (auth.uid() = user_id);

-- 6. RLS Policies for habit_completions
CREATE POLICY "Users can select their own habit completions"
    ON public.habit_completions FOR SELECT
    USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own habit completions"
    ON public.habit_completions FOR INSERT
    WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own habit completions"
    ON public.habit_completions FOR UPDATE
    USING (auth.uid() = user_id)
    WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete their own habit completions"
    ON public.habit_completions FOR DELETE
    USING (auth.uid() = user_id);
