create table public.companies (
  id uuid primary key default uuid_generate_v4(),
  name text not null,
  email text,
  phone text,
  plan text,
  maxemployees integer
);

create table public.users (
  id uuid primary key references auth.users(id) on delete cascade,
  name text,
  phone text,
  email text,
  company_id uuid references public.companies(id)
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
