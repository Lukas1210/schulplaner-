-- ============================================================================
-- Schulplaner – Datenbank für den Sync zwischen iPhone und iPad einrichten
-- In einem EIGENEN Supabase-Projekt einmal komplett im SQL-Editor ausführen
-- (SQL Editor → New query → alles einfügen → Run). Mehrfaches Ausführen ist unschädlich.
-- ============================================================================

-- 1) Mitglieder: Nur Konten in dieser Tabelle dürfen Daten lesen und schreiben.
create table if not exists public.members (
  user_id uuid primary key references auth.users (id) on delete cascade,
  created_at timestamptz not null default now()
);
alter table public.members enable row level security;
drop policy if exists "members: eigene Zeile lesen" on public.members;
create policy "members: eigene Zeile lesen" on public.members
  for select to authenticated using (user_id = auth.uid());

create or replace function public.is_member()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (select 1 from public.members where user_id = auth.uid());
$$;

-- 2) Alle Einträge der App (Fächer, Stunden, Hausaufgaben, Tests, Noten, Termine, Fehltage, Karteikarten, Einstellungen)
create table if not exists public.items (
  id uuid primary key,
  type text not null,
  data jsonb not null default '{}'::jsonb,
  deleted boolean not null default false,
  created_at timestamptz,
  client_updated_at timestamptz,
  updated_at timestamptz not null default clock_timestamp(),
  updated_by uuid default auth.uid()
);
create index if not exists items_updated_idx on public.items (updated_at, id);

-- Der Server setzt den Zeitstempel selbst – falsch gehende Geräte-Uhren spielen so keine Rolle.
create or replace function public.items_touch()
returns trigger
language plpgsql
as $$
begin
  new.updated_at := clock_timestamp();
  new.updated_by := auth.uid();
  return new;
end;
$$;
drop trigger if exists items_touch on public.items;
create trigger items_touch
  before insert or update on public.items
  for each row execute function public.items_touch();

alter table public.items enable row level security;
drop policy if exists "items: nur Mitglieder" on public.items;
create policy "items: nur Mitglieder" on public.items
  for all to authenticated
  using (public.is_member())
  with check (public.is_member());

-- 3) Live-Updates: Änderungen auf dem iPhone erscheinen sofort auf dem iPad
do $$
begin
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'items'
  ) then
    alter publication supabase_realtime add table public.items;
  end if;
end;
$$;

-- 4) Privater Speicher für Kalenderdateien (.ics), damit Safari „Zum Kalender hinzufügen“ anbietet
insert into storage.buckets (id, name, public)
values ('ics', 'ics', false)
on conflict (id) do nothing;

drop policy if exists "ics: lesen" on storage.objects;
create policy "ics: lesen" on storage.objects
  for select to authenticated using (bucket_id = 'ics' and public.is_member());
drop policy if exists "ics: hochladen" on storage.objects;
create policy "ics: hochladen" on storage.objects
  for insert to authenticated with check (bucket_id = 'ics' and public.is_member());
drop policy if exists "ics: ersetzen" on storage.objects;
create policy "ics: ersetzen" on storage.objects
  for update to authenticated
  using (bucket_id = 'ics' and public.is_member())
  with check (bucket_id = 'ics' and public.is_member());
drop policy if exists "ics: löschen" on storage.objects;
create policy "ics: löschen" on storage.objects
  for delete to authenticated using (bucket_id = 'ics' and public.is_member());

-- 5) Konto freischalten.
--    Erst unter Authentication → Users das Konto anlegen ("Add user", "Auto Confirm User"),
--    dann dieses Skript (noch einmal) ausführen:
insert into public.members (user_id)
select id from auth.users
on conflict do nothing;

-- Kontrolle: Hier sollte genau ihre E-Mail-Adresse stehen.
select u.email, m.created_at as freigeschaltet_seit
from public.members m join auth.users u on u.id = m.user_id;
