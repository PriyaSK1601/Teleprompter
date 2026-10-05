create table if not exists public.guest_migrations (
  migration_id uuid primary key,
  user_id uuid not null references auth.users(id) on delete cascade,
  migrated_at timestamptz not null default now()
);

alter table public.guest_migrations enable row level security;
revoke all on public.guest_migrations from anon, authenticated;

create or replace function public.migrate_guest_data(
  p_migration_id uuid,
  p_projects jsonb,
  p_scripts jsonb
)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare
  authenticated_user_id uuid := auth.uid();
  previous_user_id uuid;
begin
  if authenticated_user_id is null then
    raise exception 'Authentication is required.' using errcode = '42501';
  end if;

  if jsonb_typeof(p_projects) <> 'array' or jsonb_typeof(p_scripts) <> 'array' then
    raise exception 'Guest migration payload must contain arrays.' using errcode = '22023';
  end if;

  if jsonb_array_length(p_projects) > 10000 or jsonb_array_length(p_scripts) > 10000 then
    raise exception 'Guest migration payload is too large.' using errcode = '54000';
  end if;

  -- Serialize retries for one Guest workspace. The ledger makes a completed
  -- migration a no-op while a failed transaction rolls back the ledger row.
  perform pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtextextended(p_migration_id::text, 0)
  );

  select user_id
  into previous_user_id
  from public.guest_migrations
  where migration_id = p_migration_id;

  if found then
    if previous_user_id <> authenticated_user_id then
      raise exception 'This Guest migration belongs to another account.' using errcode = '42501';
    end if;
    return false;
  end if;

  -- A Guest script may only reference a project contained in the same batch.
  if exists (
    select 1
    from jsonb_to_recordset(p_scripts) as script(project_id uuid)
    where script.project_id is not null
      and not exists (
        select 1
        from jsonb_to_recordset(p_projects) as project(id uuid)
        where project.id = script.project_id
      )
  ) then
    raise exception 'A Guest script references a project outside this migration.' using errcode = '23503';
  end if;

  insert into public.guest_migrations (migration_id, user_id)
  values (p_migration_id, authenticated_user_id);

  insert into public.projects (id, user_id, name, created_at, updated_at)
  select
    project.id,
    authenticated_user_id,
    left(project.name, 80),
    coalesce(project.created_at, now()),
    coalesce(project.updated_at, now())
  from jsonb_to_recordset(p_projects) as project(
    id uuid,
    name text,
    created_at timestamptz,
    updated_at timestamptz
  );

  insert into public.scripts (
    id,
    user_id,
    title,
    body,
    created_at,
    updated_at,
    last_opened_at,
    archived,
    pinned,
    project_id
  )
  select
    script.id,
    authenticated_user_id,
    left(script.title, 120),
    coalesce(script.body, ''),
    coalesce(script.created_at, now()),
    coalesce(script.updated_at, now()),
    script.last_opened_at,
    coalesce(script.archived, false),
    coalesce(script.pinned, false),
    script.project_id
  from jsonb_to_recordset(p_scripts) as script(
    id uuid,
    title text,
    body text,
    created_at timestamptz,
    updated_at timestamptz,
    last_opened_at timestamptz,
    archived boolean,
    pinned boolean,
    project_id uuid
  );

  return true;
end;
$$;

revoke all on function public.migrate_guest_data(uuid, jsonb, jsonb) from public, anon;
grant execute on function public.migrate_guest_data(uuid, jsonb, jsonb) to authenticated;
