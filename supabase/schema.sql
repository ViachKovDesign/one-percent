-- Выполнить один раз в Supabase: SQL Editor → New query → вставить → Run.
-- Одна строка на пользователя, в ней все его дела, привычки и шаблоны.

create table if not exists public.user_data (
  user_id uuid primary key references auth.users (id) on delete cascade,
  data jsonb not null,
  updated_at timestamptz not null default now()
);

alter table public.user_data enable row level security;

-- Каждый видит и меняет только свою строку.
create policy "read own" on public.user_data
  for select using (auth.uid() = user_id);
create policy "insert own" on public.user_data
  for insert with check (auth.uid() = user_id);
create policy "update own" on public.user_data
  for update using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- Защита бесплатного лимита: одна строка не больше 2 МБ (обычно у человека — десятки КБ).
-- Выполнить отдельно, если таблица уже создана.
alter table public.user_data
  add constraint user_data_size_limit check (octet_length(data::text) < 2000000);
