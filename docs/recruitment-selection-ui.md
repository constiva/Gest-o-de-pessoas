# Recrutamento & Seleção (R&S) - Especificação de UI

Esta especificação descreve a interface do módulo de Recrutamento & Seleção. O objetivo é orientar a implementação de telas, componentes e comportamentos seguindo o design system existente e garantindo acessibilidade.

## Navegação
- **Sidebar principal**: entrada "Recrutamento & Seleção" abre submódulos.
- **Topbar fixa**: links para **Vagas**, **Banco de Talentos**, **Pipeline Global**, **Relatórios**, **Exportações** e **Configurações**.
- Header com busca global, filtros rápidos (empresa/área/período), avatar, notificações.

## Ações e Componentes Globais
- Ações padrão em cada página: **Novo**, **Filtrar**, **Salvar visão**, **Exportar**, **Colunas**, **Ações em lote**.
- Componentes base: Cards, DataTable com paginação infinita, Drawer/Modal, Sheet lateral, Tabs, Empty States, Toaster.
- Paleta de badges: vaga → Aberta (verde), Congelada (amarelo), Fechada (cinza); candidatura → Ativo (azul), Reprovado (vermelho), Desistente (cinza); SLA → No prazo (verde), Atenção (amarelo), Estourado (vermelho).
- Acessibilidade AA: foco visível, navegação por teclado, labels descritivos e feedback em `aria-live`.

## 1. Vagas (`/jobs`)
### Lista de Vagas
- Topo com botões: Nova Vaga, Filtrar, Salvar visão, Colunas, Exportar.
- Busca por título, área e gestor.
- Tabela com colunas: Título (link), Área, Gestor, Status, Candidatos Ativos, Dias em aberto, Criada em, Última atividade, Ações.
- Drawer de filtros: status, área, local, senioridade, gestor, período. Filtros persistem via querystring. Colunas configuráveis por usuário.
- Visões salvas: “Minhas vagas”, “Abertas”, “Congeladas”, “Fechadas”.
- Ações em lote: Fechar, Congelar, Duplicar vaga.
- Empty state com CTA “Criar primeira vaga”.

### Detalhe da Vaga (`/jobs/:id`)
- Layout em tabs: **Visão Geral**, **Talentos**, **Analytics**, **Divulgação**, **Configurações**.
- Visão Geral: cards de Status, Dias em aberto, Gestor, Etapas do pipeline, Candidatos por etapa, timeline de atividades, botões Editar, Fechar, Congelar, Duplicar.
- Talentos: tabela ou Kanban com etapas da vaga. Cards mostram nome, cargo/pretensão, dias na etapa, SLA, origem, anexos/notas. Drag‑and‑drop move estágio; reprovar/desistir exige motivo.
- Analytics: funil da vaga, KPIs de conversão, origem, reprovação e SLA.
- Divulgação: formulário de anúncio, link público e QR code, campos configuráveis e pré-filtros automáticos.
- Configurações: etapas customizadas, SLA por etapa, permissões e responsáveis padrão.

## 2. Banco de Talentos (`/talents`)
### Lista
- Topo com: Novo Talento, Importar CSV/Excel, Filtrar, Salvar visão, Colunas, Exportar.
- Busca global por nome, email, telefone.
- Colunas: Nome, Email, Telefone, Localização, Senioridade, Skills, Tags, Origem, Último movimento, Status geral, Ações.
- Filtros facetados: localização, skills, tags, senioridade, origem, disponibilidade, “em processo”.
- Ações em lote: adicionar tags, marcar contatado, encaminhar para vaga.
- Importação com staging/preview de erros e detecção de duplicados.

### Perfil do Talento (`/talents/:id`)
- Coluna esquerda: identificação, contatos, localização, card profissional (cargo, senioridade, pretensão, disponibilidade), skills/tags, anexos, consentimento LGPD.
- Coluna direita: histórico em vagas, notas internas, ações (encaminhar para vaga, marcar contatado, adicionar observação).
- Encaminhar cria application com etapa inicial e responsável.

## 3. Pipeline Global (`/pipeline`)
- Filtros no topo: vaga, área, gestor, período, origem, etapa, tags; busca por nome.
- Botões: Agrupar por (Etapa | Vaga | Responsável), Densidade (compacto/normal), Exportar.
- Kanban com colunas por etapa ou agrupamento escolhido; cards exibem nome, vaga, dias na etapa, SLA badge, origem, responsável, ícones de anexo/nota.
- Drag‑and‑drop com validações; mover para Reprovado/Desistente exige motivo.
- Sheet lateral de candidato com ações rápidas (Mover, Reprovar, Desistir, Trocar responsável, Perfil).

## 4. Relatórios (`/reports`)
- Filtros persistentes: período, vaga, área, origem, responsável.
- Cards KPI: Time to Fill, Taxa de Conversão, Origem principal, % dentro do SLA, Motivo de reprovação mais comum.
- Gráficos: funil de contratação, tempo médio por etapa, origem de candidatos, motivos de reprovação.
- Exportar CSV ou PDF; click em cards aplica drill‑down nos filtros.

## 5. Exportações (`/exports`)
- Seletor de dataset: Vagas, Talentos, Candidaturas, Eventos, Métricas agregadas.
- Seleção de colunas e filtros; prévia com primeiras linhas. Botões para Exportar CSV/Excel e Agendar exportação. Histórico de exportações recentes.

## 6. Configurações (`/settings/recruiting`)
- CRUD de etapas padrão do processo, SLA por etapa, motivos padronizados, origens, tags e skills.
- Permissões: papéis, escopos e máscara de PII para `viewer`.
- Integrações opcionais (email, WhatsApp, webhooks).

## 7. Microcopy
- Exemplos prontos para modais de reprovação, desistência e mensagens de SLA.

## 8. Estados e Validações
- Empty states com CTA, feedback de sucesso/erro via toast, confirmações em ações destrutivas, validação de duplicidade de talentos e badges de consentimento LGPD.

## 9. Observabilidade & Telemetria
- Eventos de uso: `jobs.view_list`, `talents.create`, `applications.move_stage`, `pipeline.view`, `reports.export_pdf`, etc., com company_id, user_id, filtros ativos, latency_ms e resultado.

## 10. Critérios de Aceite Gerais
- Filtros e colunas persistem por usuário/visão.
- Kanban com drag‑and‑drop fluido e auditoria.
- SLA visível nos cards.
- Perfis de talento com histórico completo e anexos.
- Relatórios e exportações refletem exatamente o estado filtrado.
- Acessibilidade básica garantida.
