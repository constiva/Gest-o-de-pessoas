# Gestão de Pessoas

Projeto inicial de SaaS usando Next.js e TypeScript com autenticação via Supabase.

## Como começar

1. Copie `.env.example` para `.env.local` e preencha as variáveis `NEXT_PUBLIC_SUPABASE_URL` e `NEXT_PUBLIC_SUPABASE_ANON_KEY`.
2. Instale as dependências com `npm install`.
3. Execute o servidor de desenvolvimento com `npm run dev`.

## Esquema no Supabase

Execute as queries abaixo no Supabase para criar as tabelas necessárias:

```sql
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
```

Após registrar um usuário, ele será redirecionado para `/dashboard`.

A página `/dashboard` exibe métricas simples de funcionários. A gestão de funcionários (CRUD, filtros e contadores) está em `/employees`.
