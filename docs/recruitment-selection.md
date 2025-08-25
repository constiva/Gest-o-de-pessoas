# Recrutamento & Seleção (R&S) - Arquitetura e Schema

## 1. Visão Geral
O módulo de R&S centraliza talentos, vagas e candidaturas em uma base multitenant.
Principais objetivos:
- Manter um **Banco de Talentos global** com histórico completo.
- Acompanhar candidaturas em um **Pipeline global** com etapas configuráveis.
- Gerar **relatórios e exportações** com KPIs de contratação.
- Garantir **segurança** e conformidade com **LGPD** via RLS e auditoria.

## 2. Arquitetura de Domínio
### Entidades Principais
- **talents**: candidatos independentes de vaga.
- **talent_tags**, **talent_tag_map**: taxonomia flexível de tags.
- **skills**, **talent_skill_map**: habilidades técnicas ou comportamentais.
- **jobs**: vagas com status e etapas personalizadas.
- **job_stages**: etapas padrão por empresa ou sobrescritas por vaga.
- **job_metrics**: estatísticas agregadas por vaga (ex.: cliques no link).
- **applications**: vínculo talento↔vaga com estágio atual.
- **application_stage_history**: histórico de mudanças de etapa e SLAs.
- **application_events**: auditoria de ações (quem, quando, payload).
- **reports_cache**: materialização periódica de métricas.

### Relacionamentos
- `talents.company_id -> companies.id`
- `jobs.company_id -> companies.id`
- `applications.job_id -> jobs.id`
- `applications.talent_id -> talents.id`
- `job_stages.job_id -> jobs.id` (ou nulo para padrão da empresa)
- `job_metrics.job_id -> jobs.id`
- `application_stage_history.application_id -> applications.id`
- `application_events.application_id -> applications.id`

## 3. Script SQL (Supabase)
```sql
-- Enums
create type recruitment_role as enum ('admin','recruiter','manager','viewer');
create type job_status as enum ('open','closed','frozen');
create type application_stage as enum ('applied','screening','interview','offer','admitted','rejected','withdrawn');
create type candidate_source as enum ('career_site','referral','linkedin','import','event','other');
create type rejection_reason as enum ('lack_of_skill','cultural_fit','salary','position_filled','candidate_withdrew','other');
create type talent_status as enum ('active','withdrawn','rejected');

-- Talents
create table talents (
  id uuid primary key default uuid_generate_v4(),
  company_id uuid not null references companies(id) on delete cascade,
  name text not null,
  email text not null,
  phone text,
  city text,
  state text,
  comment text,
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
  unique (company_id, email),
  unique (company_id, phone)
);
comment on table talents is 'Banco de talentos global';

create table talent_tags (
  id uuid primary key default uuid_generate_v4(),
  company_id uuid not null references companies(id) on delete cascade,
  name text not null,
  color text,
  unique (company_id, name)
);
create table talent_tag_map (
  talent_id uuid references talents(id) on delete cascade,
  tag_id uuid references talent_tags(id) on delete cascade,
  primary key (talent_id, tag_id)
);

create table skills (
  id uuid primary key default uuid_generate_v4(),
  company_id uuid not null references companies(id) on delete cascade,
  name text not null,
  unique (company_id, name)
);
create table talent_skill_map (
  talent_id uuid references talents(id) on delete cascade,
  skill_id uuid references skills(id) on delete cascade,
  primary key (talent_id, skill_id)
);

-- Jobs
create table jobs (
  id uuid primary key default uuid_generate_v4(),
  company_id uuid not null references companies(id) on delete cascade,
  title text not null,
  description text,
  department text,
  manager_id uuid references companies_users(user_id),
  status job_status default 'open',
  opened_at date default current_date,
  closed_at date,
  created_at timestamptz default now(),
  created_by uuid references auth.users(id)
);
comment on table jobs is 'Vagas de recrutamento';

create table job_stages (
  id uuid primary key default uuid_generate_v4(),
  company_id uuid not null references companies(id) on delete cascade,
  job_id uuid references jobs(id) on delete cascade,
  name text not null,
  position int not null,
  sla_days int,
  unique (job_id, position)
);

-- Applications
create table applications (
  id uuid primary key default uuid_generate_v4(),
  company_id uuid not null references companies(id) on delete cascade,
  job_id uuid not null references jobs(id) on delete cascade,
  talent_id uuid not null references talents(id) on delete cascade,
  current_stage application_stage default 'applied',
  status application_stage default 'applied',
  applied_at timestamptz default now(),
  source candidate_source,
  notes text,
  unique (job_id, talent_id)
);

create table application_stage_history (
  id uuid primary key default uuid_generate_v4(),
  application_id uuid not null references applications(id) on delete cascade,
  from_stage application_stage,
  to_stage application_stage not null,
  moved_at timestamptz default now(),
  moved_by uuid references auth.users(id),
  reason rejection_reason,
  note text,
  due_at timestamptz,
  breached_at timestamptz
);

create table application_events (
  id uuid primary key default uuid_generate_v4(),
  company_id uuid not null references companies(id) on delete cascade,
  application_id uuid references applications(id) on delete cascade,
  event_type text not null,
  payload jsonb not null default '{}',
  created_at timestamptz default now(),
  created_by uuid references auth.users(id)
);
comment on table application_events is 'Auditoria de ações do pipeline';

create table reports_cache (
  company_id uuid not null references companies(id) on delete cascade,
  period_start date not null,
  period_end date not null,
  metric text not null,
  value numeric not null,
  primary key (company_id, metric, period_start, period_end)
);
```

### RLS Básico
```sql
-- Exemplo para talents
alter table talents enable row level security;

create policy "talents_select" on talents
for select using (company_id = auth.jwt() ->> 'company_id');

create policy "talents_modify" on talents
for insert with check (auth.jwt() ->> 'company_role' in ('admin','recruiter','manager')
                      and company_id = auth.jwt() ->> 'company_id')
  to authenticated;

create policy "talents_update" on talents
for update using (auth.jwt() ->> 'company_role' in ('admin','recruiter','manager')
                  and company_id = auth.jwt() ->> 'company_id')
  with check (company_id = auth.jwt() ->> 'company_id');

create policy "talents_delete" on talents
for delete using (auth.jwt() ->> 'company_role' = 'admin'
                  and company_id = auth.jwt() ->> 'company_id');
```
Políticas similares devem ser aplicadas às demais tabelas, sempre filtrando por `company_id` e papel (`company_role`).

## 4. Fluxos Principais
1. **Cadastro de Talento**
   - Manual: recrutador preenche campos básicos e confirma consentimento.
   - Importação: arquivo CSV/Excel processado em `staging_talents`, validações e upsert.
   - Formulário público da vaga: candidato envia dados; sistema verifica duplicidade por email/telefone.
2. **Criação de Vaga**
   - Admin define título, requisitos, gestor e etapas.
   - Etapas herdadas do padrão da empresa podem ser ajustadas por vaga.
3. **Inscrição do Candidato**
   - Link público gera registro em `applications` e vincula talento.
   - Verifica duplicidade; histórico consolidado no talento.
4. **Movimentação no Pipeline**
   - Mudança de etapa cria registro em `application_stage_history` e evento.
   - Reprovações/desistências exigem motivo (`rejection_reason`).
   - SLA: `due_at` calculado a partir de `sla_days`; se `now() > due_at` e sem movimentação, marca `breached_at` e dispara alerta.
5. **Encerramento de Vaga**
   - `status` passa para `closed`; `closed_at` definido pelo primeiro `application` admitido.
   - KPIs como Time to Fill são atualizados em `reports_cache`.
6. **Exportação/Relatórios**
   - Usuário seleciona filtros e colunas; serviço gera CSV/Excel ou PDF com KPIs e gráficos.

## 5. Regras de Negócio
- **Etapas**: empresa define etapas padrão; vagas podem sobrescrever ou adicionar etapas.
- **SLA**: armazenar `due_at` por etapa e marcar `breached_at` ao ultrapassar o prazo.
- **Duplicidade de Talentos**: busca por email/telefone; se duplicado, mescla dados preservando histórico.
- **LGPD**: campo `consent_at`; opção de anonimização que substitui PII por valores nulos mantendo métricas.
- **Permissões**:
  - `admin`: total acesso.
  - `manager`: gerencia vagas próprias e lê todas.
  - `recruiter`: cria talentos e move candidaturas.
  - `viewer`: leitura com mascaramento de email/telefone.

## 6. KPIs
- **Time to Fill**: `jobs.date_filled - jobs.opened_at`.
- **Conversão por etapa**: `COUNT(history.to_stage = B)/COUNT(history.from_stage = A)`.
- **Origem de candidatos**: `COUNT(*) GROUP BY applications.source`.
- **Motivos de reprovação**: `COUNT(*) GROUP BY history.reason`.
- **SLA cumprido**: `COUNT(history.breached_at IS NULL)/COUNT(*)` por etapa.
Exemplos de consulta encontram-se no relatório agregando `application_stage_history`.

## 7. Importação e Exportação
- **Importação**: arquivos enviados vão para `staging_talents` com validação de headers; registros válidos movidos para `talents` via upsert.
- **Exportação**: serviço constrói consultas dinâmicas respeitando filtros e colunas selecionadas; saída em CSV/Excel e PDF com KPIs.

## 8. Integrações e Automações
- **Webhooks**: `application_events` dispara webhooks para mudanças de etapa e SLA violado.
- **Cron Jobs**: recalculam `reports_cache` e processam importações em lote.
- **Endpoint público**: `/apply/{job_id}` com rate limit e captcha.

## 9. Segurança e LGPD
- RLS em todas as tabelas restringindo por `company_id` e papel.
- Máscara de PII para `viewer` via view ou retorno parcial.
- Auditoria completa em `application_events`.
- `consent_at` rastreia consentimento; anonimização atende pedidos de "esquecer meus dados".

## 10. Glossário de Eventos
- `talent.created`
- `job.created`
- `application.created`
- `application.stage_moved`
- `application.rejected`
- `application.sla_breached`
- `job.closed`
Cada evento grava `company_id`, `application_id` (quando aplicável), `event_type`, `payload`, `created_at`, `created_by`.

## 11. Exemplos de KPIs (SQL)
```sql
-- Time to Fill por vaga
select j.id, j.title,
       j.closed_at - j.opened_at as time_to_fill
from jobs j
where j.status = 'closed';

-- Conversão inscrito -> entrevista
select count(*) filter (where to_stage = 'interview')::numeric /
       nullif(count(*) filter (where from_stage = 'applied'),0) as conv_applied_to_interview
from application_stage_history
where company_id = auth.jwt() ->> 'company_id';

-- SLA cumprido por etapa
select to_stage,
       count(*) filter (where breached_at is null)::numeric / count(*) as pct_on_time
from application_stage_history
where company_id = auth.jwt() ->> 'company_id'
group by to_stage;
```

## 12. Plano de Importação/Exportação
- **Staging**: `staging_talents` (mesma estrutura de `talents` + coluna `errors` jsonb).
- **Validação**: função PL/pgSQL verifica obrigatórios, normaliza dados e grava erros.
- **Deduplicação**: `on conflict (company_id,email)` atualiza registros preservando histórico.
- **Export**: função gera `COPY (query) TO STDOUT WITH CSV` ou usa biblioteca de Excel/PDF no backend.

## 13. Guia de Segurança/LGPD
- Consentimento obrigatório (`consent_at`).
- Anonimização: atualização de PII para `null` e preservação de campos analíticos.
- Logs de acesso e manipulação em `application_events`.
- Retenção: políticas para expurgo de talentos inativos após X anos.
```
