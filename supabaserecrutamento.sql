-- Recrutamento & Seleção Supabase schema

-- Extensions
create extension if not exists "uuid-ossp";

-- Enums
create type recruitment_role as enum ('admin','recruiter','manager','viewer');
create type job_status as enum ('open','closed','frozen');
create type application_status as enum ('applied','screening','interview','offer','admitted','rejected','withdrawn');
create type candidate_source as enum ('career_site','referral','linkedin','import','event','other','instagram','internal_referral');
create type rejection_reason as enum ('lack_of_skill','cultural_fit','salary','position_filled','candidate_withdrew','other');
create type talent_status as enum ('active','withdrawn','rejected');

-- Talents
create table if not exists talents (
  id uuid primary key default uuid_generate_v4(),
  company_id uuid not null references companies(id) on delete cascade,
  name text not null,
  email text not null,
  phone text,
  city text,
  state text,
  comment text,
  stage_id uuid references job_stages(id),
  links jsonb default '[]',
  cv_url text,
  salary_expectation numeric,
  seniority text,
  availability text,
  source candidate_source,
  status talent_status default 'active',
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
  color text,
  unique (company_id,name)
);

create table if not exists talent_tag_map (
  talent_id uuid references talents(id) on delete cascade,
  tag_id uuid references talent_tags(id) on delete cascade,
  company_id uuid references companies(id) on delete cascade,
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
  company_id uuid references companies(id) on delete cascade,
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
  work_location text,
  summary text,
  responsibilities text[],
  requirements text[],
  desirables text[],
  salary_range text,
  benefits text,
  contract_type text,
  workload text,
  seniority text,
  form_fields jsonb default '["name","email"]',
  custom_fields jsonb default '[]',
  form_field_order jsonb default '[]',
  form_field_wide jsonb default '[]',
  created_at timestamptz default now(),
  created_by uuid references auth.users(id),
  constraint jobs_manager_fkey foreign key (company_id, manager_id)
    references companies_users(company_id, user_id)
);
comment on table jobs is 'Vagas de recrutamento';

alter table if exists jobs
  add column if not exists custom_fields jsonb default '[]';

alter table if exists jobs
  add column if not exists form_field_order jsonb default '[]';

alter table if exists jobs
  add column if not exists form_field_wide jsonb default '[]';

create table if not exists job_stages (
  id uuid primary key default uuid_generate_v4(),
  company_id uuid not null references companies(id) on delete cascade,
  job_id uuid references jobs(id) on delete cascade,
  name text not null,
  position int not null,
  sla_days int,
  unique (job_id,position)
);

create table if not exists job_metrics (
  job_id uuid primary key references jobs(id) on delete cascade,
  company_id uuid not null references companies(id) on delete cascade,
  link_clicks int default 0,
  closing_time numeric
);

alter table if exists job_metrics
  add column if not exists closing_time numeric;

-- Roteiros salvos
create table if not exists job_script_configs (
  id uuid primary key default uuid_generate_v4(),
  company_id uuid not null references companies(id) on delete cascade,
  name text not null,
  content text default '',
  softskills jsonb not null default '[]',
  cultural_fit jsonb not null default '[]'
);

-- Scripts de entrevista/roteiro
create table if not exists job_scripts (
  id uuid primary key default uuid_generate_v4(),
  job_id uuid not null references jobs(id) on delete cascade,
  company_id uuid not null references companies(id) on delete cascade,
  template_id uuid references job_script_configs(id),
  name text not null,
  content text default '',
  softskills jsonb not null default '[]',
  cultural_fit jsonb not null default '[]',
  unique (job_id)
);

create unique index if not exists job_scripts_job_id_key on job_scripts(job_id);

-- Formulários salvos
create table if not exists job_form_configs (
  id uuid primary key default uuid_generate_v4(),
  company_id uuid not null references companies(id) on delete cascade,
  name text not null,
  config jsonb not null default '[]'
);

alter table if exists jobs
  add column if not exists form_config_id uuid references job_form_configs(id);

alter table if exists jobs
  add column if not exists script_template_id uuid references job_script_configs(id);

create or replace function increment_job_link_click(j uuid)
returns void as $$
  insert into job_metrics(job_id, link_clicks)
  values (j, 1)
  on conflict (job_id)
    do update set link_clicks = job_metrics.link_clicks + 1;
$$ language sql;

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
  custom_answers jsonb default '{}',
  unique (job_id,talent_id)
);

-- Ensure legacy installations have the stage reference
alter table if exists applications
  add column if not exists stage_id uuid references job_stages(id);

alter table if exists applications
  add column if not exists custom_answers jsonb default '{}';

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

create table if not exists application_stage_dates (
  application_id uuid not null references applications(id) on delete cascade,
  stage_id uuid not null references job_stages(id) on delete cascade,
  company_id uuid not null references companies(id) on delete cascade,
  day_in timestamptz not null,
  day_out timestamptz,
  primary key (application_id, stage_id)
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

alter table if exists talent_tag_map
  add column if not exists company_id uuid references companies(id) on delete cascade;

alter table if exists talent_skill_map
  add column if not exists company_id uuid references companies(id) on delete cascade;

alter table if exists job_metrics
  add column if not exists company_id uuid references companies(id) on delete cascade;

alter table if exists job_scripts
  add column if not exists company_id uuid references companies(id) on delete cascade;

alter table if exists application_stage_dates
  add column if not exists company_id uuid references companies(id) on delete cascade;

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
alter table application_stage_dates enable row level security;
alter table application_events enable row level security;
alter table reports_cache enable row level security;
alter table job_scripts enable row level security;
alter table job_script_configs enable row level security;
alter table job_form_configs enable row level security;

-- Basic company isolation policies
create policy company_iso on talents using (company_id = (auth.jwt() ->> 'company_id')::uuid) with check (company_id = (auth.jwt() ->> 'company_id')::uuid);
create policy company_iso on talent_tags using (company_id = (auth.jwt() ->> 'company_id')::uuid) with check (company_id = (auth.jwt() ->> 'company_id')::uuid);
create policy company_iso on skills using (company_id = (auth.jwt() ->> 'company_id')::uuid) with check (company_id = (auth.jwt() ->> 'company_id')::uuid);
create policy company_iso on jobs using (company_id = (auth.jwt() ->> 'company_id')::uuid) with check (company_id = (auth.jwt() ->> 'company_id')::uuid);
create policy company_iso on job_stages using (company_id = (auth.jwt() ->> 'company_id')::uuid) with check (company_id = (auth.jwt() ->> 'company_id')::uuid);
create policy company_iso on applications using (company_id = (auth.jwt() ->> 'company_id')::uuid) with check (company_id = (auth.jwt() ->> 'company_id')::uuid);
create policy company_iso on application_stage_history using (exists (select 1 from applications a where a.id = application_stage_history.application_id and a.company_id = (auth.jwt() ->> 'company_id')::uuid));
create policy company_iso on application_stage_dates using (exists (select 1 from applications a where a.id = application_stage_dates.application_id and a.company_id = (auth.jwt() ->> 'company_id')::uuid));
create policy company_iso on application_events using (company_id = (auth.jwt() ->> 'company_id')::uuid) with check (company_id = (auth.jwt() ->> 'company_id')::uuid);
create policy company_iso on reports_cache using (company_id = (auth.jwt() ->> 'company_id')::uuid) with check (company_id = (auth.jwt() ->> 'company_id')::uuid);
create policy company_iso on job_scripts using (exists (select 1 from jobs j where j.id = job_scripts.job_id and j.company_id = (auth.jwt() ->> 'company_id')::uuid)) with check (exists (select 1 from jobs j where j.id = job_scripts.job_id and j.company_id = (auth.jwt() ->> 'company_id')::uuid));
create policy company_iso on job_script_configs using (company_id = (auth.jwt() ->> 'company_id')::uuid) with check (company_id = (auth.jwt() ->> 'company_id')::uuid);
create policy company_iso on job_form_configs using (company_id = (auth.jwt() ->> 'company_id')::uuid) with check (company_id = (auth.jwt() ->> 'company_id')::uuid);

-- Role based write policies
create policy talents_write on talents for all using (auth.jwt() ->> 'company_role' in ('admin','recruiter','manager') and company_id = (auth.jwt() ->> 'company_id')::uuid);
create policy jobs_write on jobs for all using (auth.jwt() ->> 'company_role' in ('admin','recruiter','manager') and company_id = (auth.jwt() ->> 'company_id')::uuid);
create policy job_stages_write on job_stages for all using (auth.jwt() ->> 'company_role' in ('admin','recruiter','manager') and company_id = (auth.jwt() ->> 'company_id')::uuid);
create policy applications_write on applications for all using (auth.jwt() ->> 'company_role' in ('admin','recruiter','manager') and company_id = (auth.jwt() ->> 'company_id')::uuid);
create policy job_scripts_write on job_scripts for all using (auth.jwt() ->> 'company_role' in ('admin','recruiter','manager') and exists (select 1 from jobs j where j.id = job_scripts.job_id and j.company_id = (auth.jwt() ->> 'company_id')::uuid));
create policy job_script_configs_write on job_script_configs for all using (auth.jwt() ->> 'company_role' in ('admin','recruiter','manager') and company_id = (auth.jwt() ->> 'company_id')::uuid);
create policy job_form_configs_write on job_form_configs for all using (auth.jwt() ->> 'company_role' in ('admin','recruiter','manager') and company_id = (auth.jwt() ->> 'company_id')::uuid);

-- Read-only policy for all roles
create policy read_all on talents for select using (company_id = (auth.jwt() ->> 'company_id')::uuid);
create policy read_all on jobs for select using (company_id = (auth.jwt() ->> 'company_id')::uuid);
create policy read_all on job_stages for select using (company_id = (auth.jwt() ->> 'company_id')::uuid);
create policy read_all on applications for select using (company_id = (auth.jwt() ->> 'company_id')::uuid);
create policy read_all on job_scripts for select using (exists (select 1 from jobs j where j.id = job_scripts.job_id and j.company_id = (auth.jwt() ->> 'company_id')::uuid));
create policy read_all on job_script_configs for select using (company_id = (auth.jwt() ->> 'company_id')::uuid);
create policy read_all on job_form_configs for select using (company_id = (auth.jwt() ->> 'company_id')::uuid);

-- ensure companies_users scopes default to full access
alter table if exists public.companies_users
  alter column scopes set default '{
    "dashboard": true,
    "employees": true,
    "recruitment": true,
    "metrics": true,
    "users": true
  }'::jsonb;

update public.companies_users
set scopes = '{
  "dashboard": true,
  "employees": true,
  "recruitment": true,
  "metrics": true,
  "users": true
}'::jsonb || coalesce(scopes, '{}'::jsonb);
