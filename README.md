# Gestão de Pessoas

Projeto inicial de SaaS usando Next.js e TypeScript com autenticação via Supabase.

## Como começar

1. Copie `.env.example` para `.env.local` e preencha as variáveis `NEXT_PUBLIC_SUPABASE_URL` e `NEXT_PUBLIC_SUPABASE_ANON_KEY`.
2. Instale as dependências com `npm install`.
3. Execute o servidor de desenvolvimento com `npm run dev`.
4. O projeto usa TailwindCSS e componentes do [shadcn/ui](https://ui.shadcn.com/) para uma interface limpa com tons de roxo e branco.
5. Variáveis de ambiente para o Efibank estão em `.env.example` caso queira testar assinaturas.

## Assinaturas Efibank

O projeto utiliza o SDK oficial [`gn-api-sdk-node`](https://github.com/efipay/sdk-node) para criar planos e assinaturas. Durante o registro a empresa escolhe entre os planos **Básico**, **Pro** ou **Enterprise**:

- **Básico**: cadastro segue direto para o dashboard.
- **Pro** ou **Enterprise**: após salvar o usuário e a empresa (com `maxemployees` = 0), o fluxo redireciona para `/checkout` onde o cliente informa os dados do cartão. A resposta grava uma linha em `subscriptions` com status `pending` e então o usuário é enviado para `/pending` até que o webhook confirme o pagamento. Quando `POST /api/efibank/webhook` recebe `status=paid`, o registro é marcado como `active` e o limite correspondente é aplicado em `companies.maxemployees` antes de redirecionar ao dashboard.

Exemplo de requisição direta à API:

```bash
curl -X POST http://localhost:3000/api/efibank/subscribe \\
  -H "Content-Type: application/json" \\
  -d '{"plan":"pro","customer":{"name":"Teste","email":"t@e.com"},"card":{"number":"0000","holder":"TESTE","expMonth":"01","expYear":"2030","cvv":"123"}}'
```

O endpoint `POST /api/efibank/webhook` recebe notificações do Efibank, atualiza o status da assinatura e libera o limite de funcionários conforme o plano contratado.

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
```

Após registrar um usuário, ele será redirecionado para `/dashboard` no plano **Básico**. Para planos pagos o fluxo vai para `/checkout` e depois para `/pending` até que o pagamento seja confirmado.

A página `/dashboard` exibe métricas simples de funcionários. A gestão de funcionários (CRUD, filtros e contadores) está em `/employees`.
Nesta página é possível escolher quais colunas aparecem, filtrar múltiplos campos e usar o botão de reticências para visualizar, editar ou alterar o status do colaborador (com opção de ativar novamente). Tanto a lista filtrada quanto a ficha individual possuem um botão de impressão que respeita os campos selecionados.

Cada usuário pode salvar colunas visíveis e filtros em múltiplas listas personalizadas. Essas configurações ficam armazenadas na tabela `employee_views`, são recarregadas automaticamente nas próximas sessões e podem ser excluídas (com exceção da lista principal).

As configurações de Departamentos, Cargos e Campos personalizados podem ser acessadas por um modal com menu lateral para CRUD completo.

Documentação complementar encontra-se em `assinatura-efibak/` e as opções padrão do painel `/checkoutadmin` podem ser ajustadas em `config/checkoutadmin.json`.

