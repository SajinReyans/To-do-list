-- Migration: Add today_tasks table and policies
CREATE TABLE IF NOT EXISTS public.today_tasks (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    title TEXT NOT NULL,
    date DATE NOT NULL DEFAULT CURRENT_DATE,
    priority TEXT NOT NULL DEFAULT 'none',
    checked BOOLEAN NOT NULL DEFAULT FALSE,
    "order" INTEGER NOT NULL DEFAULT 0,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT timezone('utc'::text, now())
);

CREATE INDEX IF NOT EXISTS idx_today_tasks_user_date ON public.today_tasks(user_id, date);

ALTER TABLE public.today_tasks ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can select their own today tasks" ON public.today_tasks;
CREATE POLICY "Users can select their own today tasks"
    ON public.today_tasks FOR SELECT
    USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can insert their own today tasks" ON public.today_tasks;
CREATE POLICY "Users can insert their own today tasks"
    ON public.today_tasks FOR INSERT
    WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can update their own today tasks" ON public.today_tasks;
CREATE POLICY "Users can update their own today tasks"
    ON public.today_tasks FOR UPDATE
    USING (auth.uid() = user_id)
    WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can delete their own today tasks" ON public.today_tasks;
CREATE POLICY "Users can delete their own today tasks"
    ON public.today_tasks FOR DELETE
    USING (auth.uid() = user_id);
