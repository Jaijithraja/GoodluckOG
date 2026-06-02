-- Enable UUID extension
create extension if not exists "uuid-ossp";

-- Create pods table
create table if not exists public.pods (
    id uuid default gen_random_uuid() primary key,
    target_percentile_range text not null,
    exam_date_range text not null,
    member_ids uuid[] not null default '{}'::uuid[],
    active boolean not null default true,
    created_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- Create students table
create table if not exists public.students (
    id uuid default gen_random_uuid() primary key,
    user_id uuid references auth.users(id) on delete cascade not null,
    name text not null,
    exam_date date not null,
    target_percentile numeric not null,
    available_hours_weekday numeric not null,
    available_hours_weekend numeric not null,
    peak_energy_window text not null check (peak_energy_window in ('morning', 'afternoon', 'night')),
    study_style text not null check (study_style in ('structured', 'flexible')),
    biggest_fear text,
    archetype text,
    prep_phase text not null check (prep_phase in ('Foundation', 'Acceleration', 'Crunch', 'FinalWeek')),
    burnout_risk_score numeric not null default 0.0,
    onboarding_complete boolean not null default false,
    pod_id uuid references public.pods(id) on delete set null,
    pod_alert_opt_in boolean not null default false,
    dreamIIM text,
    created_at timestamp with time zone default timezone('utc'::text, now()) not null,
    updated_at timestamp with time zone default timezone('utc'::text, now()) not null,
    constraint unique_user_id unique (user_id)
);

-- Create topic_weights table
create table if not exists public.topic_weights (
    id uuid default gen_random_uuid() primary key,
    student_id uuid references public.students(id) on delete cascade not null,
    topic text not null,
    section text not null check (section in ('VARC', 'DILR', 'Quant')),
    weight numeric not null default 0.5,
    coverage_percent numeric not null default 0.0,
    revision_count integer not null default 0,
    last_studied date,
    fatigue_score numeric not null default 0.0,
    avoidance_flag boolean not null default false,
    updated_at timestamp with time zone default timezone('utc'::text, now()) not null,
    constraint unique_student_topic unique (student_id, topic)
);

-- Create daily_plans table
create table if not exists public.daily_plans (
    id uuid default gen_random_uuid() primary key,
    student_id uuid references public.students(id) on delete cascade not null,
    plan_date date not null default current_date,
    prep_phase text not null,
    days_remaining integer not null,
    sessions jsonb not null default '[]'::jsonb,
    rationale text,
    dynamic_alerts jsonb not null default '[]'::jsonb,
    generated_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- Create session_logs table
create table if not exists public.session_logs (
    id uuid default gen_random_uuid() primary key,
    student_id uuid references public.students(id) on delete cascade not null,
    plan_id uuid references public.daily_plans(id) on delete set null,
    log_date date not null default current_date,
    topic text not null,
    section text not null check (section in ('VARC', 'DILR', 'Quant')),
    session_type text not null check (session_type in ('Learn', 'Revise', 'Practice', 'Mock', 'Recovery')),
    planned_duration_minutes integer,
    actual_duration_minutes integer not null,
    difficulty_rating integer,
    focus_rating integer,
    completed boolean not null default false,
    abandoned_at_minute integer,
    notes text,
    logged_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- Create mock_results table
create table if not exists public.mock_results (
    id uuid default gen_random_uuid() primary key,
    student_id uuid references public.students(id) on delete cascade not null,
    mock_date date not null default current_date,
    source text not null check (source in ('SimCAT', 'AIMCAT', 'CL', 'TIME', 'IMS', 'Other')),
    overall_percentile numeric not null,
    varc_score numeric,
    varc_percentile numeric,
    varc_accuracy numeric,
    varc_time_minutes numeric,
    dilr_score numeric,
    dilr_percentile numeric,
    dilr_accuracy numeric,
    dilr_time_minutes numeric,
    quant_score numeric,
    quant_percentile numeric,
    quant_accuracy numeric,
    quant_time_minutes numeric,
    total_attempts integer,
    total_accuracy numeric,
    debrief jsonb,
    logged_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- Create adaptation_logs table
create table if not exists public.adaptation_logs (
    id uuid default gen_random_uuid() primary key,
    student_id uuid references public.students(id) on delete cascade not null,
    log_date date not null default current_date,
    change_type text not null,
    topic_affected text,
    reason text not null,
    previous_value jsonb,
    new_value jsonb,
    triggered_by text not null,
    created_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- Create burnout_scores table
create table if not exists public.burnout_scores (
    id uuid default gen_random_uuid() primary key,
    student_id uuid references public.students(id) on delete cascade not null,
    computed_at timestamp with time zone default timezone('utc'::text, now()) not null,
    risk_score numeric not null,
    abandonment_rate_7d numeric not null,
    streak_breaks_7d integer not null,
    difficulty_trend numeric not null,
    duration_trend numeric not null,
    session_time_drift numeric not null,
    intervention_triggered text not null check (intervention_triggered in ('none', 'check_in', 'recovery_day', 'pod_alert'))
);

-- Create weekly_reports table
create table if not exists public.weekly_reports (
    id uuid default gen_random_uuid() primary key,
    student_id uuid references public.students(id) on delete cascade not null,
    week_start date not null,
    week_end date not null,
    sessions_planned integer not null,
    sessions_completed integer not null,
    topics_covered text[] not null default '{}'::text[],
    weak_topics text[] not null default '{}'::text[],
    adaptation_changes jsonb not null default '[]'::jsonb,
    mock_count integer not null default 0,
    narrative jsonb,
    generated_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- Create pod_execution_logs table
create table if not exists public.pod_execution_logs (
    pod_id uuid references public.pods(id) on delete cascade not null,
    student_id uuid references public.students(id) on delete cascade not null,
    log_date date not null default current_date,
    execution_status text not null check (execution_status in ('completed', 'partial', 'missed')),
    streak_days integer not null default 0,
    primary key (pod_id, student_id, log_date)
);

-- RLS (Row Level Security) Configuration
alter table public.pods enable row level security;
alter table public.students enable row level security;
alter table public.topic_weights enable row level security;
alter table public.daily_plans enable row level security;
alter table public.session_logs enable row level security;
alter table public.mock_results enable row level security;
alter table public.adaptation_logs enable row level security;
alter table public.burnout_scores enable row level security;
alter table public.weekly_reports enable row level security;
alter table public.pod_execution_logs enable row level security;

-- Setup RLS Policies (Allow users to read/write their own records)
create policy "Allow active user to read/write their own student profile"
    on public.students for all using (auth.uid() = user_id);

create policy "Allow active user to read/write their topic weights"
    on public.topic_weights for all using (
        student_id in (select id from public.students where user_id = auth.uid())
    );

create policy "Allow active user to read/write their daily plans"
    on public.daily_plans for all using (
        student_id in (select id from public.students where user_id = auth.uid())
    );

create policy "Allow active user to read/write their session logs"
    on public.session_logs for all using (
        student_id in (select id from public.students where user_id = auth.uid())
    );

create policy "Allow active user to read/write their mock results"
    on public.mock_results for all using (
        student_id in (select id from public.students where user_id = auth.uid())
    );

create policy "Allow active user to read/write their adaptation logs"
    on public.adaptation_logs for all using (
        student_id in (select id from public.students where user_id = auth.uid())
    );

create policy "Allow active user to read/write their burnout scores"
    on public.burnout_scores for all using (
        student_id in (select id from public.students where user_id = auth.uid())
    );

create policy "Allow active user to read/write their weekly reports"
    on public.weekly_reports for all using (
        student_id in (select id from public.students where user_id = auth.uid())
    );

create policy "Allow pod members to view pod details"
    on public.pods for select using (
        id in (select pod_id from public.students where user_id = auth.uid())
    );

create policy "Allow pod members to read pod execution logs"
    on public.pod_execution_logs for select using (
        pod_id in (select pod_id from public.students where user_id = auth.uid())
    );

create policy "Allow active user to write their pod execution logs"
    on public.pod_execution_logs for all using (
        student_id in (select id from public.students where user_id = auth.uid())
    );
