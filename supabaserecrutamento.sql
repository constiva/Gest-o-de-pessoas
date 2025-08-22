-- Recrutamento & Seleção Supabase schema

-- Extensions
create extension if not exists "uuid-ossp";

-- Enums
create type recruitment_role as enum ('admin','recruiter','manager','viewer');
create type job_status as enum ('open','closed','frozen');
create type application_status as enum ('applied','screening','interview','offer','admitted','rejected','withdrawn');
create type candidate_source as enum ('career_site','referral','linkedin','import','event','other');
create type rejection_reason as enum ('lack_of_skill','cultural_fit','salary','position_filled','candidate_withdrew','other');

-- Talents
create table if not exists talents (
  id uuid primary key default uuid_generate_v4(),
  company_id uuid not null references companies(id) on delete cascade,
  name text not null,
  email text not null,
  phone text,
  city text,
  state text,
  stage_id uuid references job_stages(id),
  links jsonb default '[]',
  cv_url text,
  salary_expectation numeric,
  seniority text,
  availability text,
  source candidate_source,
  consent_at timestamptz,
  created_at timestamptz default now(),
  updated_at timestamptz default now(),
  unique (company_id,email),
  unique (company_id,phone)
);
comment on table talents is 'Banco de talentos global';

create table if not exists talent_tags (
  id uuid primary key default uuid_generate_v4(),
  company_id uuid not null references companies(id) on delete cascade,
  name text not null,
  unique (company_id,name)
);

create table if not exists talent_tag_map (
  talent_id uuid references talents(id) on delete cascade,
  tag_id uuid references talent_tags(id) on delete cascade,
  primary key (talent_id,tag_id)
);

create table if not exists skills (
  id uuid primary key default uuid_generate_v4(),
  company_id uuid not null references companies(id) on delete cascade,
  name text not null,
  unique (company_id,name)
);

create table if not exists talent_skill_map (
  talent_id uuid references talents(id) on delete cascade,
  skill_id uuid references skills(id) on delete cascade,
  primary key (talent_id,skill_id)
);

-- Jobs
create table if not exists jobs (
  id uuid primary key default uuid_generate_v4(),
  company_id uuid not null references companies(id) on delete cascade,
  title text not null,
  description text,
  department text,
  manager_id uuid,
  status job_status default 'open',
  opened_at date default current_date,
  closed_at date,
  sla date,
  form_fields jsonb default '["name","email"]',
  created_at timestamptz default now(),
  created_by uuid references auth.users(id),
  constraint jobs_manager_fkey foreign key (company_id, manager_id)
    references companies_users(company_id, user_id)
);
comment on table jobs is 'Vagas de recrutamento';

create table if not exists job_stages (
  id uuid primary key default uuid_generate_v4(),
  company_id uuid not null references companies(id) on delete cascade,
  job_id uuid references jobs(id) on delete cascade,
  name text not null,
  position int not null,
  sla_days int,
  unique (job_id,position)
);

-- Applications
create table if not exists applications (
  id uuid primary key default uuid_generate_v4(),
  company_id uuid not null references companies(id) on delete cascade,
  job_id uuid not null references jobs(id) on delete cascade,
  talent_id uuid not null references talents(id) on delete cascade,
  status application_status default 'applied',
  applied_at timestamptz default now(),
  source candidate_source,
  notes text,
  unique (job_id,talent_id)
);

-- Ensure legacy installations have the stage reference
alter table if exists applications
  add column if not exists stage_id uuid references job_stages(id);

create table if not exists application_stage_history (
  id uuid primary key default uuid_generate_v4(),
  application_id uuid not null references applications(id) on delete cascade,
  from_stage uuid references job_stages(id),
  to_stage uuid not null references job_stages(id),
  moved_at timestamptz default now(),
  moved_by uuid references auth.users(id),
  reason rejection_reason,
  note text,
  due_at timestamptz,
  breached_at timestamptz
);

create table if not exists application_events (
  id uuid primary key default uuid_generate_v4(),
  company_id uuid not null references companies(id) on delete cascade,
  application_id uuid references applications(id) on delete cascade,
  event_type text not null,
  payload jsonb not null default '{}',
  created_at timestamptz default now(),
  created_by uuid references auth.users(id)
);
comment on table application_events is 'Auditoria de ações do pipeline';

create table if not exists reports_cache (
  company_id uuid not null references companies(id) on delete cascade,
  period_start date not null,
  period_end date not null,
  metric text not null,
  value numeric not null,
  primary key (company_id,metric,period_start,period_end)
);

-- RLS policies
alter table talents enable row level security;
alter table talent_tags enable row level security;
alter table talent_tag_map enable row level security;
alter table skills enable row level security;
alter table talent_skill_map enable row level security;
alter table jobs enable row level security;
alter table job_stages enable row level security;
alter table applications enable row level security;
alter table application_stage_history enable row level security;
alter table application_events enable row level security;
alter table reports_cache enable row level security;

-- Basic company isolation policies
create policy company_iso on talents using (company_id = (auth.jwt() ->> 'company_id')::uuid) with check (company_id = (auth.jwt() ->> 'company_id')::uuid);
create policy company_iso on talent_tags using (company_id = (auth.jwt() ->> 'company_id')::uuid) with check (company_id = (auth.jwt() ->> 'company_id')::uuid);
create policy company_iso on skills using (company_id = (auth.jwt() ->> 'company_id')::uuid) with check (company_id = (auth.jwt() ->> 'company_id')::uuid);
create policy company_iso on jobs using (company_id = (auth.jwt() ->> 'company_id')::uuid) with check (company_id = (auth.jwt() ->> 'company_id')::uuid);
create policy company_iso on job_stages using (company_id = (auth.jwt() ->> 'company_id')::uuid) with check (company_id = (auth.jwt() ->> 'company_id')::uuid);
create policy company_iso on applications using (company_id = (auth.jwt() ->> 'company_id')::uuid) with check (company_id = (auth.jwt() ->> 'company_id')::uuid);
create policy company_iso on application_stage_history using (exists (select 1 from applications a where a.id = application_stage_history.application_id and a.company_id = (auth.jwt() ->> 'company_id')::uuid));
create policy company_iso on application_events using (company_id = (auth.jwt() ->> 'company_id')::uuid) with check (company_id = (auth.jwt() ->> 'company_id')::uuid);
create policy company_iso on reports_cache using (company_id = (auth.jwt() ->> 'company_id')::uuid) with check (company_id = (auth.jwt() ->> 'company_id')::uuid);

-- Role based write policies
create policy talents_write on talents for all using (auth.jwt() ->> 'company_role' in ('admin','recruiter','manager') and company_id = (auth.jwt() ->> 'company_id')::uuid);
create policy jobs_write on jobs for all using (auth.jwt() ->> 'company_role' in ('admin','recruiter','manager') and company_id = (auth.jwt() ->> 'company_id')::uuid);
create policy job_stages_write on job_stages for all using (auth.jwt() ->> 'company_role' in ('admin','recruiter','manager') and company_id = (auth.jwt() ->> 'company_id')::uuid);
create policy applications_write on applications for all using (auth.jwt() ->> 'company_role' in ('admin','recruiter','manager') and company_id = (auth.jwt() ->> 'company_id')::uuid);

-- Read-only policy for all roles
create policy read_all on talents for select using (company_id = (auth.jwt() ->> 'company_id')::uuid);
create policy read_all on jobs for select using (company_id = (auth.jwt() ->> 'company_id')::uuid);
create policy read_all on job_stages for select using (company_id = (auth.jwt() ->> 'company_id')::uuid);
create policy read_all on applications for select using (company_id = (auth.jwt() ->> 'company_id')::uuid);
