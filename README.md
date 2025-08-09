# Gestão de Pessoas

Projeto inicial de SaaS usando Next.js com autenticação via Supabase.

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
```

Após registrar um usuário, ele será redirecionado para `/dashboard`.
