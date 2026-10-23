-- AUD-78. Local migration only until separate remote approval.
-- Fail on pre-existing role names instead of silently trusting/altering unrelated roles.
create role classroom_reader nologin nosuperuser nocreatedb nocreaterole noinherit nobypassrls;
create role classroom_writer nologin nosuperuser nocreatedb nocreaterole noinherit nobypassrls;
create schema classroom;
revoke all on schema classroom from public;
alter default privileges in schema classroom revoke all on tables from public;
alter default privileges in schema classroom revoke execute on functions from public;

-- Security invoker, schema-qualified, no dynamic SQL. Used in CHECK constraints.
create function classroom.keys_allowed(value jsonb, allowed text[]) returns boolean
language sql immutable strict set search_path = pg_catalog as $$
  select jsonb_typeof(value) = 'object' and not exists (
    select 1 from jsonb_object_keys(case when jsonb_typeof(value) = 'object' then value else '{}'::jsonb end) k
    where not (k = any(allowed))
  )
$$;
create function classroom.safe_student(value jsonb) returns boolean
language sql immutable strict set search_path = pg_catalog as $$
  select classroom.keys_allowed(value, array['id','slug','version','title','description','language','difficulty',
    'topics','tags','minutes','filename','instructions','readContent','learningObjectives','readCode','vocabulary','questions','fix'])
    and value ?& array['id','slug','version','title','description','language','difficulty','topics','tags','minutes',
      'filename','instructions','readContent','learningObjectives','readCode','vocabulary','questions','fix']
    and classroom.keys_allowed(value->'fix', array['instructions','buggyCode','hints'])
    and jsonb_typeof(value->'vocabulary') = 'array' and jsonb_typeof(value->'questions') = 'array'
    and not exists (select 1 from jsonb_array_elements(case when jsonb_typeof(value->'vocabulary') = 'array'
      then value->'vocabulary' else '[]'::jsonb end) v where not classroom.keys_allowed(v,
      array['term','definition','example','readLines','speakingPrompt','pronunciation']))
    and not exists (select 1 from jsonb_array_elements(case when jsonb_typeof(value->'questions') = 'array'
      then value->'questions' else '[]'::jsonb end) q where not classroom.keys_allowed(q, array['id','prompt']))
$$;

create table classroom.exercises (
  id uuid primary key default gen_random_uuid(),
  legacy_id text unique,
  slug text not null unique default ('lesson-' || gen_random_uuid()::text),
  content jsonb not null,
  publication text not null default 'draft' check (publication in ('draft','published')),
  version integer not null default 0 check (version >= 0),
  lock_version integer not null default 1 check (lock_version > 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  published_at timestamptz,
  first_published_at timestamptz,
  published_checksum text,
  sort_order integer,
  import_source text unique,
  import_checksum text,
  check (slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$' and length(slug) <= 100),
  check (octet_length(content::text) <= 262144),
  check (classroom.keys_allowed(content, array['title','description','language','difficulty','topic','topics','tags',
    'learningObjectives','filename','minutes','instructions','readContent','readCode','questions','fix'])),
  check (content ?& array['title','description','language','difficulty','topic','topics','tags','learningObjectives',
    'filename','minutes','instructions','readContent','readCode','questions','fix']),
  check (content->>'language' in ('Python','C#')),
  check (content->>'difficulty' in ('Beginner','Intermediate','Advanced')),
  check (length(content->>'title') <= 200 and length(content->>'description') <= 4000),
  check (length(content->>'readCode') <= 20000 and length(content->'fix'->>'buggyCode') <= 20000),
  check (jsonb_typeof(content->'questions') = 'array' and jsonb_array_length(content->'questions') <= 50),
  check (jsonb_typeof(content->'fix') = 'object'),
  check (publication <> 'published' or (published_at is not null and first_published_at is not null and published_checksum is not null))
);
create index exercises_library on classroom.exercises (publication, updated_at desc, id);
create table classroom.vocabulary (
  id uuid primary key default gen_random_uuid(),
  exercise_id uuid not null references classroom.exercises(id) on delete cascade,
  position integer not null check (position >= 0 and position < 100),
  entry jsonb not null check (octet_length(entry::text) <= 16384),
  unique (exercise_id, position) deferrable initially deferred,
  check (classroom.keys_allowed(entry,array['term','definition','example','readLines','speakingPrompt','pronunciation'])),
  check (entry ?& array['term','definition','example']),
  check (length(entry->>'term') between 1 and 120)
);
create table classroom.teacher_guides (
  exercise_id uuid primary key references classroom.exercises(id) on delete cascade,
  content jsonb not null check (jsonb_typeof(content) = 'object' and octet_length(content::text) <= 262144),
  import_checksum text,
  updated_at timestamptz not null default now()
);
create table classroom.published_exercises (
  exercise_id uuid primary key references classroom.exercises(id) on delete cascade,
  slug text not null unique references classroom.exercises(slug),
  student_payload jsonb not null check (octet_length(student_payload::text) <= 262144),
  version integer not null check (version > 0),
  published_at timestamptz not null default now(),
  check (classroom.safe_student(student_payload) is true),
  check (student_payload->>'slug' = slug and (student_payload->>'version')::integer = version)
);

create function classroom.protect_exercise() returns trigger
language plpgsql set search_path = pg_catalog as $$
begin
  if new.id <> old.id or new.created_at <> old.created_at or
    (old.first_published_at is not null and (new.slug <> old.slug or new.first_published_at is distinct from old.first_published_at)) then
    raise exception 'Immutable exercise identity';
  end if;
  new.updated_at := now();
  return new;
end
$$;
create trigger exercise_identity before update on classroom.exercises for each row execute function classroom.protect_exercise();

create function classroom.check_publication() returns trigger
language plpgsql set search_path = pg_catalog as $$
declare target uuid; state text; snapshot_slug text; canonical_slug text;
begin
  if tg_table_name = 'exercises' then target := coalesce(new.id, old.id);
  else target := coalesce(new.exercise_id, old.exercise_id); end if;
  select publication, slug into state, canonical_slug from classroom.exercises where id = target;
  if not found then return null; end if;
  select slug into snapshot_slug from classroom.published_exercises where exercise_id = target;
  if (state = 'published') <> (snapshot_slug is not null) or
    (snapshot_slug is not null and snapshot_slug <> canonical_slug) then
    raise exception 'Inconsistent exercise publication';
  end if;
  return null;
end
$$;
create constraint trigger exercise_publication after insert or update or delete on classroom.exercises
  deferrable initially deferred for each row execute function classroom.check_publication();
create constraint trigger snapshot_publication after insert or update or delete on classroom.published_exercises
  deferrable initially deferred for each row execute function classroom.check_publication();

-- Even if someone accidentally exposes this schema in PostgREST, API roles have
-- neither schema USAGE nor table/function grants. FORCE RLS supplies another layer.
grant usage on schema classroom to classroom_reader, classroom_writer;
grant select on classroom.published_exercises to classroom_reader;
grant select, insert, update, delete on classroom.exercises, classroom.vocabulary,
  classroom.teacher_guides, classroom.published_exercises to classroom_writer;
-- Per-schema default revokes cannot override the global PUBLIC EXECUTE default.
-- Revoke explicitly after every future function-creating migration too.
revoke all on all functions in schema classroom from public;
grant execute on all functions in schema classroom to classroom_writer;

do $$
declare t text; r text;
begin
  foreach t in array array['exercises','vocabulary','teacher_guides','published_exercises'] loop
    execute format('alter table classroom.%I enable row level security', t);
    execute format('alter table classroom.%I force row level security', t);
    execute format('create policy writer on classroom.%I for all to classroom_writer using (true) with check (true)', t);
  end loop;
  foreach r in array array['anon','authenticated','service_role','authenticator'] loop
    if exists (select 1 from pg_roles where rolname = r) then
      execute format('revoke all on schema classroom from %I', r);
      execute format('revoke all on all tables in schema classroom from %I', r);
      execute format('revoke all on all functions in schema classroom from %I', r);
    end if;
  end loop;
end $$;
create policy published_reader on classroom.published_exercises for select to classroom_reader using (true);
