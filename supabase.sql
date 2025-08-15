create table public.plans (
  id uuid primary key default uuid_generate_v4(),
  name text not null,
  plan_description text,
  features jsonb default '{}'::jsonb
);

create table public.companies (
  id uuid primary key default uuid_generate_v4(),
  name text not null,
  email text,
  phone text,
  plan_id uuid references public.plans(id),
  plan_overrides jsonb default '{}'::jsonb,
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
  company_id uuid references public.companies(id) on delete cascade,
  user_id uuid references auth.users(id) on delete cascade,
  role text check (role in ('owner','admin','manager','viewer','custom')),
  scopes jsonb default '{}'::jsonb,
  allowed_fields jsonb default '[]'::jsonb,
  created_at timestamptz default now(),
  primary key (company_id, user_id)
);

-- Enable Row Level Security
alter table public.employees enable row level security;
create policy employees_by_company on public.employees
  using (
    company_id = (select company_id from public.users where id = auth.uid())
    or (select is_admin from public.users where id = auth.uid())
  )
  with check (
    company_id = (select company_id from public.users where id = auth.uid())
    or (select is_admin from public.users where id = auth.uid())
  );

alter table public.companies_users enable row level security;
create policy companies_users_select on public.companies_users for select
  using (
    company_id = (select company_id from public.users where id = auth.uid())
    or (select is_admin from public.users where id = auth.uid())
  );
create policy companies_users_write on public.companies_users for insert
  with check (
    company_id = (select company_id from public.users where id = auth.uid())
    or (select is_admin from public.users where id = auth.uid())
  );
create policy companies_users_update on public.companies_users for update
  using (
    company_id = (select company_id from public.users where id = auth.uid())
    or (select is_admin from public.users where id = auth.uid())
  )
  with check (
    company_id = (select company_id from public.users where id = auth.uid())
    or (select is_admin from public.users where id = auth.uid())
  );
create policy companies_users_delete on public.companies_users for delete
  using (
    company_id = (select company_id from public.users where id = auth.uid())
    or (select is_admin from public.users where id = auth.uid())
  );
