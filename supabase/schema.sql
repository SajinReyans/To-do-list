-- Aloft Todo App - Supabase Schema Migration (Idempotent)
-- Safe to re-run multiple times

-- 1. Create queue_tasks table
CREATE TABLE IF NOT EXISTS public.queue_tasks (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    title TEXT NOT NULL,
    deadline TEXT,
    checked BOOLEAN NOT NULL DEFAULT FALSE,
    "order" INTEGER NOT NULL DEFAULT 0,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT timezone('utc'::text, now())
);

-- 2. Create tree_nodes table (supports arbitrary recursive nesting via parent_id)
CREATE TABLE IF NOT EXISTS public.tree_nodes (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    title TEXT NOT NULL,
    parent_id UUID REFERENCES public.tree_nodes(id) ON DELETE CASCADE,
    deadline TEXT,
    checked BOOLEAN NOT NULL DEFAULT FALSE,
    "order" INTEGER NOT NULL DEFAULT 0,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT timezone('utc'::text, now())
);

-- 3. Create user_settings table
CREATE TABLE IF NOT EXISTS public.user_settings (
    user_id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
    theme TEXT NOT NULL DEFAULT 'cottonCandy',
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT timezone('utc'::text, now())
);

-- 4. Create habits table (yearly habit definitions with optional daily deadline reminder)
CREATE TABLE IF NOT EXISTS public.habits (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    title TEXT NOT NULL,
    color TEXT,
    icon TEXT,
    year INTEGER NOT NULL,
    archived BOOLEAN NOT NULL DEFAULT FALSE,
    reminder_enabled BOOLEAN NOT NULL DEFAULT FALSE,
    reminder_time TEXT DEFAULT '20:00',
    reminder_message TEXT,
    reminder_email TEXT,
    last_reminded_date TEXT,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT timezone('utc'::text, now())
);


-- 5. Create habit_completions table (daily checkbox records)
CREATE TABLE IF NOT EXISTS public.habit_completions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    habit_id UUID NOT NULL REFERENCES public.habits(id) ON DELETE CASCADE,
    date DATE NOT NULL,
    completed BOOLEAN NOT NULL DEFAULT FALSE,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT timezone('utc'::text, now()),
    CONSTRAINT habit_completions_habit_date_uniq UNIQUE (habit_id, date)
);

-- 6. Indexes for query performance
CREATE INDEX IF NOT EXISTS idx_queue_tasks_user_id ON public.queue_tasks(user_id);
CREATE INDEX IF NOT EXISTS idx_tree_nodes_user_id ON public.tree_nodes(user_id);
CREATE INDEX IF NOT EXISTS idx_tree_nodes_parent_id ON public.tree_nodes(parent_id);
CREATE INDEX IF NOT EXISTS idx_habits_user_year ON public.habits(user_id, year);
CREATE INDEX IF NOT EXISTS idx_habit_completions_user_date ON public.habit_completions(user_id, date);
CREATE INDEX IF NOT EXISTS idx_habit_completions_habit_id ON public.habit_completions(habit_id);



-- 7. Enable Row Level Security (RLS) on all tables
ALTER TABLE public.queue_tasks ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.tree_nodes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.habits ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.habit_completions ENABLE ROW LEVEL SECURITY;

-- 8. RLS Policies for queue_tasks (Drop and Recreate)
DROP POLICY IF EXISTS "Users can select their own queue tasks" ON public.queue_tasks;
CREATE POLICY "Users can select their own queue tasks"
    ON public.queue_tasks FOR SELECT
    USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can insert their own queue tasks" ON public.queue_tasks;
CREATE POLICY "Users can insert their own queue tasks"
    ON public.queue_tasks FOR INSERT
    WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can update their own queue tasks" ON public.queue_tasks;
CREATE POLICY "Users can update their own queue tasks"
    ON public.queue_tasks FOR UPDATE
    USING (auth.uid() = user_id)
    WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can delete their own queue tasks" ON public.queue_tasks;
CREATE POLICY "Users can delete their own queue tasks"
    ON public.queue_tasks FOR DELETE
    USING (auth.uid() = user_id);

-- 9. RLS Policies for tree_nodes (Drop and Recreate)
DROP POLICY IF EXISTS "Users can select their own tree nodes" ON public.tree_nodes;
CREATE POLICY "Users can select their own tree nodes"
    ON public.tree_nodes FOR SELECT
    USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can insert their own tree nodes" ON public.tree_nodes;
CREATE POLICY "Users can insert their own tree nodes"
    ON public.tree_nodes FOR INSERT
    WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can update their own tree nodes" ON public.tree_nodes;
CREATE POLICY "Users can update their own tree nodes"
    ON public.tree_nodes FOR UPDATE
    USING (auth.uid() = user_id)
    WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can delete their own tree nodes" ON public.tree_nodes;
CREATE POLICY "Users can delete their own tree nodes"
    ON public.tree_nodes FOR DELETE
    USING (auth.uid() = user_id);

-- 10. RLS Policies for user_settings (Drop and Recreate)
DROP POLICY IF EXISTS "Users can select their own settings" ON public.user_settings;
CREATE POLICY "Users can select their own settings"
    ON public.user_settings FOR SELECT
    USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can insert their own settings" ON public.user_settings;
CREATE POLICY "Users can insert their own settings"
    ON public.user_settings FOR INSERT
    WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can update their own settings" ON public.user_settings;
CREATE POLICY "Users can update their own settings"
    ON public.user_settings FOR UPDATE
    USING (auth.uid() = user_id)
    WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can delete their own settings" ON public.user_settings;
CREATE POLICY "Users can delete their own settings"
    ON public.user_settings FOR DELETE
    USING (auth.uid() = user_id);

-- 11. RLS Policies for habits (Drop and Recreate)
DROP POLICY IF EXISTS "Users can select their own habits" ON public.habits;
CREATE POLICY "Users can select their own habits"
    ON public.habits FOR SELECT
    USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can insert their own habits" ON public.habits;
CREATE POLICY "Users can insert their own habits"
    ON public.habits FOR INSERT
    WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can update their own habits" ON public.habits;
CREATE POLICY "Users can update their own habits"
    ON public.habits FOR UPDATE
    USING (auth.uid() = user_id)
    WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can delete their own habits" ON public.habits;
CREATE POLICY "Users can delete their own habits"
    ON public.habits FOR DELETE
    USING (auth.uid() = user_id);

-- 12. RLS Policies for habit_completions (Drop and Recreate)
DROP POLICY IF EXISTS "Users can select their own habit completions" ON public.habit_completions;
CREATE POLICY "Users can select their own habit completions"
    ON public.habit_completions FOR SELECT
    USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can insert their own habit completions" ON public.habit_completions;
CREATE POLICY "Users can insert their own habit completions"
    ON public.habit_completions FOR INSERT
    WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can update their own habit completions" ON public.habit_completions;
CREATE POLICY "Users can update their own habit completions"
    ON public.habit_completions FOR UPDATE
    USING (auth.uid() = user_id)
    WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can delete their own habit completions" ON public.habit_completions;
CREATE POLICY "Users can delete their own habit completions"
    ON public.habit_completions FOR DELETE
    USING (auth.uid() = user_id);


