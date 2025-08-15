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
  name text not null,
  email text not null,
  phone text,
  position text,
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
-- alter table if exists public.companies_users add column if not exists name text;
-- alter table if exists public.companies_users add column if not exists email text;
-- alter table if exists public.companies_users add column if not exists phone text;
-- alter table if exists public.companies_users add column if not exists position text;

-- Helpers de acesso e planos
create or replace function app_current_company_id() returns uuid as $$
  select company_id from companies_users where user_id = auth.uid() limit 1;
$$ language sql stable;

create or replace function app_is_superadmin() returns boolean as $$
  select coalesce(is_admin, false) from public.users where id = auth.uid();
$$ language sql stable;

create or replace function app_effective_features(company uuid) returns jsonb as $$
  select coalesce(p.features, '{}'::jsonb) || coalesce(c.plan_overrides, '{}'::jsonb)
  from public.companies c
  left join public.plans p on c.plan_id = p.id
  where c.id = company;
$$ language sql stable;

create or replace function app_feature_enabled(company uuid, module text) returns boolean as $$
  select coalesce((app_effective_features(company)->>module)::boolean, false);
$$ language sql stable;

create or replace function app_allowed_fields(company uuid) returns text[] as $$
  select coalesce(array(select jsonb_array_elements_text(cu.allowed_fields)), array[]::text[])
  from public.companies_users cu
  where cu.company_id = company and cu.user_id = auth.uid();
$$ language sql stable;

create or replace function app_has_scope(company uuid, module text, action text) returns boolean as $$
  select app_is_superadmin() or (
    app_feature_enabled(company, module) and
    coalesce((select (cu.scopes -> module ->> action)::boolean
              from public.companies_users cu
              where cu.company_id = company and cu.user_id = auth.uid()), false)
  );
$$ language sql stable;

-- RLS para employees
alter table public.employees enable row level security;

create policy employees_tenant_policy on public.employees
  using (company_id = app_current_company_id() or app_is_superadmin())
  with check (company_id = app_current_company_id() or app_is_superadmin());

-- Listagem mascarada de funcionários
create or replace function app_list_employees_masked(company uuid)
returns setof public.employees as $$
  select
    id,
    company_id,
    case when 'name' = any(app_allowed_fields(company)) then name else null end as name,
    case when 'email' = any(app_allowed_fields(company)) then email else null end as email,
    case when 'phone' = any(app_allowed_fields(company)) then phone else null end as phone,
    case when 'position' = any(app_allowed_fields(company)) then position else null end as position,
    case when 'salary' = any(app_allowed_fields(company)) then salary else null end as salary,
    case when 'cpf' = any(app_allowed_fields(company)) then cpf else null end as cpf,
    street,
    city,
    state,
    zip,
    department,
    hire_date,
    termination_date,
    termination_reason,
    status,
    gender,
    emergency_contact_name,
    emergency_contact_phone,
    emergency_contact_relation,
    resume_url,
    comments,
    custom_fields,
    created_at
  from public.employees
  where company_id = company;
$$ language sql stable;

-- RPCs que reforçam permissões
create or replace function app_employee_dismiss(emp_id uuid, reason text)
returns void as $$
declare company uuid;
begin
  select company_id into company from public.employees where id = emp_id;
  if not app_has_scope(company, 'employees', 'dismiss') then
    raise exception 'permission denied';
  end if;
  update public.employees
    set status = 'dismissed', termination_reason = reason, termination_date = now()
    where id = emp_id;
end;
$$ language plpgsql security definer;

create or replace function app_employee_toggle_status(emp_id uuid, to_status text)
returns void as $$
declare company uuid;
begin
  select company_id into company from public.employees where id = emp_id;
  if to_status = 'active' then
    if not app_has_scope(company, 'employees', 'activate') then
      raise exception 'permission denied';
    end if;
  else
    if not app_has_scope(company, 'employees', 'deactivate') then
      raise exception 'permission denied';
    end if;
  end if;
  update public.employees set status = to_status where id = emp_id;
end;
$$ language plpgsql security definer;

create or replace function app_employee_update_salary(emp_id uuid, new_salary numeric)
returns void as $$
declare company uuid;
begin
  select company_id into company from public.employees where id = emp_id;
  if not app_has_scope(company, 'employees', 'update_salary') then
    raise exception 'permission denied';
  end if;
  update public.employees set salary = new_salary where id = emp_id;
end;
$$ language plpgsql security definer;

create or replace function app_employees_export(company uuid)
returns setof public.employees as $$
begin
  if not app_has_scope(company, 'employees', 'export') then
    raise exception 'permission denied';
  end if;
  return query select * from app_list_employees_masked(company);
end;
$$ language plpgsql security definer;

-- Snippet para aplicar RLS em bancos existentes
-- alter table if exists public.employees enable row level security;
-- drop policy if exists employees_tenant_policy on public.employees;
-- create policy employees_tenant_policy on public.employees using (company_id = app_current_company_id() or app_is_superadmin()) with check (company_id = app_current_company_id() or app_is_superadmin());
