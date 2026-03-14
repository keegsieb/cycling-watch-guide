-- CyclingWorthWatching — Supabase schema
-- Run this in your Supabase project's SQL editor.
-- Dashboard → SQL Editor → New query → paste & run.

-- ─── watch_points ─────────────────────────────────────────────────────────
-- Stores each user's "worth watching from" vote for a stage.
-- pct_from_finish: 0 = just the finish, 100 = watch the whole race.

create table if not exists watch_points (
  id              bigserial primary key,
  race_slug       text      not null,
  stage_url       text      not null,
  pct_from_finish numeric(5,1) not null check (pct_from_finish between 0 and 100),
  created_at      timestamptz not null default now()
);

create index if not exists watch_points_stage_url_idx on watch_points (stage_url);

-- ─── ratings ──────────────────────────────────────────────────────────────
-- Stores each user's 1–10 rating for a stage.

create table if not exists ratings (
  id         bigserial primary key,
  race_slug  text    not null,
  stage_url  text    not null,
  rating     smallint not null check (rating between 1 and 10),
  created_at timestamptz not null default now()
);

create index if not exists ratings_stage_url_idx on ratings (stage_url);

-- ─── Row Level Security ────────────────────────────────────────────────────
-- Allow anyone to read and insert (no login required).
-- To prevent spam, you can add rate limiting at the application layer or
-- switch to authenticated inserts later.

alter table watch_points enable row level security;
alter table ratings enable row level security;

create policy "Anyone can read watch points"
  on watch_points for select using (true);

create policy "Anyone can insert watch points"
  on watch_points for insert with check (true);

create policy "Anyone can read ratings"
  on ratings for select using (true);

create policy "Anyone can insert ratings"
  on ratings for insert with check (true);
