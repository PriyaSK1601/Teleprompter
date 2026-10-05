-- Authenticated scripts already belong to auth.users through scripts.user_id.
-- Projects use the same ownership model; Guest data remains local to Electron.

create table if not exists public.projects (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  name text not null check (char_length(name) between 1 and 80),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (id, user_id)
);

alter table public.scripts
  add column if not exists project_id uuid,
  add column if not exists pinned boolean not null default false;

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'scripts_project_owner_fkey'
      and conrelid = 'public.scripts'::regclass
  ) then
    alter table public.scripts
      add constraint scripts_project_owner_fkey
      foreign key (project_id, user_id)
      references public.projects(id, user_id);
  end if;
end
$$;

create index if not exists scripts_user_id_idx on public.scripts(user_id);
create index if not exists scripts_project_id_idx on public.scripts(project_id);
create index if not exists projects_user_id_idx on public.projects(user_id);

alter table public.scripts enable row level security;
alter table public.projects enable row level security;

-- Replace permissive legacy policies so an authenticated request can only
-- operate on rows whose owner matches auth.uid().
do $$
declare
  policy_record record;
begin
  for policy_record in
    select schemaname, tablename, policyname
    from pg_policies
    where schemaname = 'public' and tablename in ('scripts', 'projects')
  loop
    execute format(
      'drop policy %I on %I.%I',
      policy_record.policyname,
      policy_record.schemaname,
      policy_record.tablename
    );
  end loop;
end
$$;

create policy "Users select their own scripts"
on public.scripts for select to authenticated
using ((select auth.uid()) = user_id);

create policy "Users insert their own scripts"
on public.scripts for insert to authenticated
with check ((select auth.uid()) = user_id);

create policy "Users update their own scripts"
on public.scripts for update to authenticated
using ((select auth.uid()) = user_id)
with check ((select auth.uid()) = user_id);

create policy "Users delete their own scripts"
on public.scripts for delete to authenticated
using ((select auth.uid()) = user_id);

create policy "Users select their own projects"
on public.projects for select to authenticated
using ((select auth.uid()) = user_id);

create policy "Users insert their own projects"
on public.projects for insert to authenticated
with check ((select auth.uid()) = user_id);

create policy "Users update their own projects"
on public.projects for update to authenticated
using ((select auth.uid()) = user_id)
with check ((select auth.uid()) = user_id);

create policy "Users delete their own projects"
on public.projects for delete to authenticated
using ((select auth.uid()) = user_id);

revoke all on public.scripts from anon;
revoke all on public.projects from anon;
grant select, insert, update, delete on public.scripts to authenticated;
grant select, insert, update, delete on public.projects to authenticated;
