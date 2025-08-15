create table public.companies (
  id uuid primary key default uuid_generate_v4(),
  name text not null,
  email text,
  phone text,
  plan text,
  plan_id uuid references public.plans(id),
  maxemployees integer
);

create table public.users (
  id uuid primary key references auth.users(id) on delete cascade,
  name text,
  phone text,
  email text,
  company_id uuid references public.companies(id),
  is_admin boolean default false
);

create table public.employees (
  id uuid primary key default uuid_generate_v4(),
  company_id uuid references public.companies(id) on delete cascade,
  name text,
  email text,
  phone text,
  cpf text,
  street text,
  city text,
  state text,
  zip text,
  position text,
  department text,
  salary numeric,
  hire_date date,
  termination_date date,
  termination_reason text,
  status text check (status in ('active','inactive','dismissed')) default 'active',
  gender text,
  emergency_contact_name text,
  emergency_contact_phone text,
  emergency_contact_relation text,
  resume_url text,
  comments text,
  custom_fields jsonb,
  created_at timestamptz default now()
);

create table public.custom_fields (
  id uuid primary key default uuid_generate_v4(),
  company_id uuid references public.companies(id) on delete cascade,
  field text not null,
  value text not null
);

create table public.departments (
  id uuid primary key default uuid_generate_v4(),
  company_id uuid references public.companies(id) on delete cascade,
  name text not null
);

create table public.positions (
  id uuid primary key default uuid_generate_v4(),
  company_id uuid references public.companies(id) on delete cascade,
  name text not null
);

create table public.employee_views (
  id uuid primary key default uuid_generate_v4(),
  user_id uuid references public.users(id) on delete cascade,
  name text not null,
  columns text[],
  filters jsonb,
  created_at timestamptz default now()
);

create table public.subscriptions (
  id uuid primary key default uuid_generate_v4(),
  company_id uuid references public.companies(id) on delete cascade,
  plan text not null,
  efibank_id text,
  status text default 'pending',
  created_at timestamptz default now()
);

create table public.companies_users (
  company_id uuid not null,
  user_id uuid not null,
  role public.company_user_role not null default 'viewer'::company_user_role,
  scopes jsonb not null default '{}'::jsonb,
  allowed_fields jsonb not null default '[]'::jsonb,
  created_at timestamp with time zone not null default now(),
  constraint companies_users_pkey primary key (company_id, user_id),
  constraint companies_users_company_id_fkey foreign key (company_id) references companies (id) on delete cascade,
  constraint companies_users_user_id_fkey foreign key (user_id) references auth.users (id) on delete cascade,
  constraint companies_users_allowed_fields_is_array check ((jsonb_typeof(allowed_fields) = 'array'::text)),
  constraint companies_users_scopes_is_object check ((jsonb_typeof(scopes) = 'object'::text))
);

create index if not exists companies_users_company_id_idx on public.companies_users using btree (company_id);
create index if not exists companies_users_user_id_idx on public.companies_users using btree (user_id);

create trigger companies_users_validate_scopes before insert or update on companies_users for each row execute function trg_companies_users_validate_scopes ();

-- Snippet para atualizar bancos existentes
-- alter table if exists public.users add column if not exists is_admin boolean default false;
-- alter table if exists public.companies add column if not exists plan_id uuid;
-- alter table public.companies add constraint companies_plan_id_fkey foreign key (plan_id) references public.plans(id);
-- atualiza plan_id de empresas existentes com base no campo plan
-- update public.companies c set plan_id = p.id from public.plans p where c.plan = p.name;
-- limpa plan_id quando o plano informado não existe
-- update public.companies set plan_id = null where plan is not null and plan not in (select name from public.plans);
