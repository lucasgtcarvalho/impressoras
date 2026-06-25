# SISTEMA SaaS DE GERENCIAMENTO DE IMPRESSORAS E BILHETAGEM DE IMPRESSÃO

## ARQUITETURA COMPLETA — ESPECIFICAÇÃO TÉCNICA

---

# ETAPA 1 — VISÃO GERAL DO PRODUTO

## 1.1 Resumo do Sistema

SaaS multi-tenant para monitoramento de parque de impressoras, coleta de telemetria SNMP, bilhetagem de impressão e gestão de suprimentos. Cada cliente possui um agente local leve instalado em sua rede que descobre impressoras, coleta dados via SNMP/Windows, e sincroniza com a plataforma em nuvem. Sem necessidade de servidor de impressão centralizado no cliente.

## 1.2 Proposta de Valor

- **Para empresas de outsourcing de impressão:** visibilidade total do parque instalado em todos os clientes em um único painel
- **Para revendas:** monitoramento proativo, reposição de suprimentos baseada em dados reais
- **Para suporte técnico:** diagnóstico remoto, alertas em tempo real, redução de visitas presenciais
- **Para clientes finais:** transparência nos custos, relatórios de impressão por usuário/departamento

## 1.3 Diferenciais

- Agente leve sem dependência de servidor de impressão central
- Coleta de jobs de impressão via Event Log + WMI + monitoramento de spool
- Bilhetagem independente de sistema de print server dedicado
- Sincronização offline com fila local no agente
- Multi-tenant com isolamento total por cliente
- Arquitetura preparada para dezenas de milhares de dispositivos

## 1.4 Arquitetura Macro

```
┌─────────────────────────────────────────────────────────────────┐
│                     NUVEM (SaaS)                                │
│                                                                 │
│  ┌──────────┐  ┌──────────┐  ┌──────────┐  ┌───────────────┐  │
│  │ Frontend  │  │  API     │  │  Workers │  │  PostgreSQL   │  │
│  │ Next.js   │─▶│ NestJS   │─▶│  Bull    │─▶│  + RLS        │  │
│  │ React     │  │ REST     │  │  Redis   │  │  + Timescale  │  │
│  └──────────┘  └────┬─────┘  └──────────┘  └───────────────┘  │
│                     │                                           │
│                     │ HTTPS │ TLS │ API Key                     │
│                     ▼                                           │
│              ┌──────────────┐                                   │
│              │   Gateway    │                                   │
│              │   (Rate      │                                   │
│              │    Limit,    │                                   │
│              │    Auth)     │                                   │
│              └──────────────┘                                   │
└─────────────────────────────────────────────────────────────────┘
                           │
                           │ HTTPS │ TLS │ JWT │ API Key
                           ▼
┌─────────────────────────────────────────────────────────────────┐
│               REDE DO CLIENTE                                   │
│                                                                 │
│  ┌──────────────────────────────────────────────────────────┐   │
│  │              AGENTE LOCAL (.NET Worker)                  │   │
│  │  ┌─────────┐ ┌──────────┐ ┌─────────┐ ┌─────────────┐  │   │
│  │  │ SNMP    │ │ Desco-   │ │ Coleta  │ │ Sincroni-   │  │   │
│  │  │ Scanner │ │ berta    │ │ Jobs    │ │ zador      │  │   │
│  │  │         │ │ Rede     │ │ WMI/    │ │ Fila SQLite │  │   │
│  │  └─────────┘ └──────────┘ └─────────┘ └─────────────┘  │   │
│  │  ┌──────────────────────────────────────────────────┐   │   │
│  │  │         Cache Local SQLite / Sync Queue          │   │   │
│  │  └──────────────────────────────────────────────────┘   │   │
│  └──────────────────────────────────────────────────────────┘   │
│                           │                                      │
│                           ▼                                      │
│  ┌──────────────────────────────────────────────────────────┐   │
│  │              REDE LOCAL                                    │   │
│  │  ┌──────────┐  ┌──────────┐  ┌──────────┐               │   │
│  │  │  Printer  │  │  Printer  │  │  Printer  │   ...       │   │
│  │  │  SNMP     │  │  SNMP     │  │  SNMP     │             │   │
│  │  └──────────┘  └──────────┘  └──────────┘               │   │
│  └──────────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────────┘
```

---

# ETAPA 2 — ARQUITETURA TÉCNICA RECOMENDADA

## 2.1 Stack Escolhida e Justificativa

### Backend: NestJS (Node.js + TypeScript)

**Justificativa:**
- TypeScript nativo → tipagem forte, menos bugs em produção
- Arquitetura modular (Modules, Controllers, Services, Repositories) → escala com o produto
- Decorators para validação, autenticação, serialização
- Suporte nativo a OpenAPI/Swagger → documentação automática da API
- Ecossistema rico para filas (Bull + Redis), ORM (TypeORM/Prisma), validação (class-validator)
- Performance adequada para API de telemetria (não é compute-heavy)
- Curva de aprendizado baixa para equipe JavaScript/TypeScript
- NestJS tem suporte a GraphQL e microserviços quando precisar escalar

**Alternativa rejeitada: Laravel (PHP)**
- Menor performance em manipulação de payloads JSON grandes (lotes de telemetria)
- Ecossistema de filas/workers menos robusto que Bull/Redis
- Tipagem menos rigorosa

### Frontend: Next.js 14 + React + Tailwind + shadcn/ui

**Justificativa:**
- SSR/SSG para dashboards com SEO e performance
- React Server Components para páginas com dados pesados
- Tailwind para produtividade no design system
- shadcn/ui fornece componentes acessíveis e customizáveis
- App Router com layouts aninhados para estrutura multi-tenant
- API Routes para BFF (Backend For Frontend) se necessário

### Banco de Dados: PostgreSQL 16 + TimescaleDB

**Justificativa:**
- Row-Level Security nativa para isolamento multi-tenant
- TimescaleDB para hypertables de séries temporais (contadores, histórico de status)
- Índices parciais, partition listing por cliente/mês
- JSONB para dados flexíveis de suprimentos e configurações
- Extensões: pgcrypto, pg_stat_statements, pg_partman
- Performance comprovada para milhões de registros de bilhetagem

### Agente Local: .NET 8 Worker Service + WPF Configurator

**Justificativa:**
- Acesso nativo ao Windows: WMI, Event Log, Print Spooler API, Performance Counters
- SNMP: #SNMP Library (Leadtools) — biblioteca .NET madura para SNMP v1/v2c/v3
- Performance: compilado nativo, baixo consumo de memória
- Worker Service: roda como Windows Service (background), sem necessidade de usuário logado
- WPF: interface de configuração simples para técnicos
- SQLite: embutido para cache local, sem dependências externas
- Self-contained deployment: publica tudo em um executável, sem runtime requirement

**Alternativas rejeitadas:**
- Python: dependência de Python instalado, maior consumo, SNMP libraries menos maduras
- Go: bom para performance, mas acesso a WMI/Event Log é mais complexo
- Electron: pesado demais para serviço em background

### Fila / Processamento Assíncrono: Bull + Redis

**Justificativa:**
- Processamento de lotes de telemetria em background
- Retry com backoff exponencial
- Rate limiting para APIs externas
- Agendamento de tarefas: heartbeat checking, alertas programados

### Cache: Redis

- Sessões JWT blacklist
- Cache de consultas frequentes
- Pub/sub para notificações em tempo real (WebSocket futuro)
- Contador de rate limit

## 2.2 Diagrama de Componentes

```
┌────────────────────────────────────────────────────────────────────────────┐
│                           INFRAESTRUTURA AWS                               │
│                                                                            │
│  ┌──────────────────────┐   ┌──────────────────────┐                      │
│  │     ECS Fargate       │   │     ElastiCache       │                      │
│  │  ┌────────────────┐   │   │    Redis:             │                      │
│  │  │ API NestJS     │───┼──▶│  - Sessions          │                      │
│  │  │ (múltiplas     │   │   │  - Queue Bull         │                      │
│  │  │  tasks)        │   │   │  - Rate Limit         │                      │
│  │  └────────────────┘   │   │  - Cache              │                      │
│  │  ┌────────────────┐   │   └──────────────────────┘                      │
│  │  │ Worker Bull    │───┼──▶                                              │
│  │  │ Processadores  │   │   ┌──────────────────────┐                      │
│  │  │ Assíncronos    │   │   │     RDS PostgreSQL    │                      │
│  │  └────────────────┘   │   │  + TimescaleDB         │                      │
│  │  ┌────────────────┐   │   │  - RLS Multi-Tenant   │                      │
│  │  │ WebSocket      │───┼──▶│  - Hypertables        │                      │
│  │  │ Gateway        │   │   └──────────────────────┘                      │
│  │  └────────────────┘   │                                                 │
│  └──────────────────────┘   ┌──────────────────────┐                      │
│                             │     S3 (arquivos)     │                      │
│                             │  - Relatórios PDF     │                      │
│                             │  - Logs antigos       │                      │
│                             │  - Exports CSV/XLSX   │                      │
│                             └──────────────────────┘                      │
│  ┌──────────────────────┐   ┌──────────────────────┐                      │
│  │  CloudFront CDN      │   │  Route53 + ACM       │                      │
│  │  ┌────────────────┐  │   │  (SSL/TLS)            │                      │
│  │  │ Next.js        │  │   └──────────────────────┘                      │
│  │  │ (SSR)          │  │                                                 │
│  │  └────────────────┘  │                                                 │
│  └──────────────────────┘                                                 │
└────────────────────────────────────────────────────────────────────────────┘
```

## 2.3 Fluxo de Dados: Agente → Nuvem

```
1. AGENTE
   ├── Descoberta de rede (ARP Scan + DNS + SNMP broadcast)
   ├── Para cada impressora encontrada:
   │   ├── SNMP GET: sysName, sysDescr, sysLocation, serialNumber
   │   ├── SNMP WALK: hrPrinterStatus, ifTable, printerMIB
   │   ├── SNMP WALK: toner levels, pageCounts, errorState
   │   └── Se bilhetagem ativa:
   │       ├── WMI: Win32_PrintJob
   │       ├── Event Log: Microsoft-Windows-PrintService/Operational
   │       └── Performance Counter: Print Queue
   ├── Empacota lote em JSON + compressão GZip
   │
2. AGENTE → API (POST /api/v1/agents/{id}/sync)
   ├── Header: Authorization: Bearer <agent_token>
   ├── Header: Content-Encoding: gzip
   ├── Body: {
   │     "timestamp": "2026-06-25T10:00:00Z",
   │     "printers": [ { ... } ],
   │     "counters": [ { ... } ],
   │     "events": [ { ... } ],
   │     "jobs": [ { ... } ],
   │     "status": { "cpu": 12, "memory": 45 }
   │   }
   │
3. API GATEWAY
   ├── Rate limit check (por agente)
   ├── JWT/API Key validation
   ├── Tenant isolation (extrai client_id do token)
   └── Encaminha para controller
   │
4. NESTJS CONTROLLER
   ├── Valida payload (class-validator)
   ├── Enfileira processamento (Bull)
   └── Retorna 202 Accepted
   │
5. BULL WORKER
   ├── Descompressão
   ├── Para cada impressora:
   │   ├── Upsert (evita duplicatas por IP/serial)
   │   ├── Insere histórico de status
   │   ├── Insere histórico de contadores
   │   ├── Processa eventos → gera alertas se necessário
   │   └── Jobs: insere na print_jobs
   └── Atualiza última comunicação do agente
   │
6. CLIENTE RECEBE CONFIRMAÇÃO
   └── Agente marca lote como enviado (fila SQLite)
```

---

# ETAPA 3 — MODELAGEM DE BANCO DE DADOS

## 3.1 Estratégia Multi-Tenant

**Abordagem: Discriminador por coluna `client_id` + Row-Level Security (RLS)**

- Todas as tabelas de dados do cliente têm `client_id UUID NOT NULL`
- Índices compostos com `(client_id, ...)` nas consultas mais frequentes
- RLS ativado na tabela `clients` e todas as tabelas filhas
- Aplicação nunca usa `SELECT *` sem filtro de `client_id`
- Usuários super-admin têm bypass da RLS via role `super_admin`

## 3.2 Diagrama de Entidades

```
users ──< user_client_links >── clients
                                    │
                              client_settings
                                    │
                               agents ──< agent_sync_logs
                                    │
                               printers ──< printer_status_history
                                    │   ├── printer_supply_levels
                                    │   ├── printer_counter_history
                                    │   ├── printer_events
                                    │   └── print_jobs
                               alerts ──< alert_rules
                               audit_logs
```

## 3.3 Tabelas

### users

| Campo | Tipo | Descrição |
|-------|------|-----------|
| id | UUID PK | |
| name | VARCHAR(255) | |
| email | VARCHAR(255) UNIQUE | |
| password_hash | VARCHAR(255) | bcrypt |
| phone | VARCHAR(20) | |
| avatar_url | TEXT | |
| is_active | BOOLEAN DEFAULT true | |
| role | ENUM('super_admin', 'admin', 'client_manager', 'operator') | |
| last_login_at | TIMESTAMPTZ | |
| refresh_token | TEXT | hashed |
| created_at | TIMESTAMPTZ | |
| updated_at | TIMESTAMPTZ | |

Índices: `(email)`, `(role)`, `(is_active)`

### roles

| Campo | Tipo | Descrição |
|-------|------|-----------|
| id | UUID PK | |
| name | VARCHAR(50) UNIQUE | |
| description | TEXT | |
| is_system | BOOLEAN DEFAULT false | |
| created_at | TIMESTAMPTZ | |

### permissions

| Campo | Tipo | Descrição |
|-------|------|-----------|
| id | UUID PK | |
| role_id | UUID FK → roles.id | |
| resource | VARCHAR(100) | ex: 'clients', 'printers', 'jobs', 'alerts' |
| action | VARCHAR(50) | 'create', 'read', 'update', 'delete', 'manage' |
| scope | VARCHAR(20) | 'global', 'client', 'own' |
| created_at | TIMESTAMPTZ | |

### user_client_links

| Campo | Tipo | Descrição |
|-------|------|-----------|
| id | UUID PK | |
| user_id | UUID FK → users.id ON DELETE CASCADE | |
| client_id | UUID FK → clients.id ON DELETE CASCADE | |
| role | ENUM('client_manager', 'operator') | sobrescreve role global se necessário |
| created_at | TIMESTAMPTZ | |

Índices: `(user_id, client_id)` UNIQUE, `(client_id)`

### clients

| Campo | Tipo | Descrição |
|-------|------|-----------|
| id | UUID PK | |
| name | VARCHAR(255) | nome fantasia |
| legal_name | VARCHAR(255) | razão social |
| document | VARCHAR(20) | CNPJ |
| email | VARCHAR(255) | |
| phone | VARCHAR(20) | |
| address | JSONB | {street, number, city, state, zip} |
| status | ENUM('active', 'inactive', 'suspended') DEFAULT 'active' |
| activation_code | VARCHAR(64) UNIQUE | token para ativar agente |
| max_agents | INTEGER DEFAULT 5 | limite de agentes |
| max_printers | INTEGER DEFAULT 100 | limite de impressoras |
| settings | JSONB | configurações específicas |
| notes | TEXT | |
| created_at | TIMESTAMPTZ | |
| updated_at | TIMESTAMPTZ | |
| deleted_at | TIMESTAMPTZ | soft delete |

Índices: `(activation_code)` UNIQUE, `(status)`, `(document)`

### client_settings

| Campo | Tipo | Descrição |
|-------|------|-----------|
| id | UUID PK | |
| client_id | UUID FK → clients.id UNIQUE | |
| collection_interval_seconds | INTEGER DEFAULT 300 | 5 min |
| data_retention_days | INTEGER DEFAULT 365 | |
| alert_offline_minutes | INTEGER DEFAULT 10 | |
| alert_toner_low_threshold | INTEGER DEFAULT 20 | percentual |
| business_hours | JSONB | {start, end, timezone} |
| cost_per_page_mono | DECIMAL(10,4) | |
| cost_per_page_color | DECIMAL(10,4) | |
| currency | VARCHAR(3) DEFAULT 'BRL' | |
| timezone | VARCHAR(50) DEFAULT 'America/Sao_Paulo' | |
| created_at | TIMESTAMPTZ | |
| updated_at | TIMESTAMPTZ | |

### agents

| Campo | Tipo | Descrição |
|-------|------|-----------|
| id | UUID PK | |
| client_id | UUID FK → clients.id | |
| name | VARCHAR(255) | hostname da máquina |
| agent_version | VARCHAR(20) | |
| os_info | VARCHAR(255) | Windows 10/11/Server |
| local_ip | INET | |
| mac_address | MACADDR | |
| status | ENUM('online', 'offline', 'error') | |
| last_contact_at | TIMESTAMPTZ | |
| last_sync_at | TIMESTAMPTZ | |
| token_hash | VARCHAR(255) | hash do token do agente |
| token_expires_at | TIMESTAMPTZ | |
| config | JSONB | {scan_range, snmp_config, ...} |
| is_active | BOOLEAN DEFAULT true | |
| created_at | TIMESTAMPTZ | |
| updated_at | TIMESTAMPTZ | |

Índices: `(client_id, status)`, `(last_contact_at)`

### printers

| Campo | Tipo | Descrição |
|-------|------|-----------|
| id | UUID PK | |
| client_id | UUID FK → clients.id | |
| agent_id | UUID FK → agents.id | |
| name | VARCHAR(255) | sysName |
| display_name | VARCHAR(255) | nome amigável |
| ip_address | INET | |
| hostname | VARCHAR(255) | |
| mac_address | MACADDR | |
| manufacturer | VARCHAR(100) | |
| model | VARCHAR(255) | |
| serial_number | VARCHAR(100) | |
| location | VARCHAR(255) | sysLocation |
| firmware_version | VARCHAR(100) | |
| snmp_version | VARCHAR(5) | v1, v2c, v3 |
| snmp_community | VARCHAR(100) | encrypted |
| status | ENUM('online', 'offline', 'error', 'warning') | |
| status_detail | VARCHAR(100) | 'printing', 'idle', 'error' |
| last_contact_at | TIMESTAMPTZ | |
| uptime_seconds | BIGINT | |
| total_pages | BIGINT | contador atual |
| is_monochrome | BOOLEAN | true se mono, false se color |
| discovery_method | VARCHAR(50) | 'snmp', 'arp', 'manual' |
| notes | TEXT | |
| is_active | BOOLEAN DEFAULT true | |
| first_seen_at | TIMESTAMPTZ | |
| created_at | TIMESTAMPTZ | |
| updated_at | TIMESTAMPTZ | |

Índices: `(client_id, status)`, `(client_id, ip_address)`, `(serial_number)`, `(agent_id)`

### printer_status_history (TimescaleDB hypertable)

| Campo | Tipo | Descrição |
|-------|------|-----------|
| id | BIGSERIAL | |
| printer_id | UUID FK → printers.id | |
| client_id | UUID FK → clients.id | |
| status | VARCHAR(50) | |
| status_detail | VARCHAR(100) | |
| uptime_seconds | BIGINT | |
| collected_at | TIMESTAMPTZ NOT NULL | |
| created_at | TIMESTAMPTZ DEFAULT NOW() | |

Índices: `(printer_id, collected_at DESC)`, hypertable por `collected_at`

### printer_supply_levels

| Campo | Tipo | Descrição |
|-------|------|-----------|
| id | BIGSERIAL | |
| printer_id | UUID FK → printers.id | |
| client_id | UUID FK → clients.id | |
| supply_type | VARCHAR(50) | 'toner_black', 'toner_cyan', 'toner_magenta', 'toner_yellow', 'drum', 'fuser', 'waste' |
| supply_name | VARCHAR(100) | nome original da MIB |
| level_percent | INTEGER | 0-100 |
| level_remaining | INTEGER | quantidade absoluta se disponível |
| max_capacity | INTEGER | capacidade máxima |
| status | VARCHAR(20) | 'ok', 'low', 'empty', 'unknown' |
| collected_at | TIMESTAMPTZ | |
| created_at | TIMESTAMPTZ DEFAULT NOW() | |

Índices: `(printer_id, collected_at DESC)`, `(printer_id, supply_type, collected_at DESC)`

### printer_counter_history (TimescaleDB hypertable)

| Campo | Tipo | Descrição |
|-------|------|-----------|
| id | BIGSERIAL | |
| printer_id | UUID FK → printers.id | |
| client_id | UUID FK → clients.id | |
| total_pages | BIGINT | |
| mono_pages | BIGINT | |
| color_pages | BIGINT | |
| copy_pages | BIGINT | |
| scan_pages | BIGINT | |
| duplex_pages | BIGINT | |
| printed_pages | BIGINT | impressão |
| total_jobs | BIGINT | |
| collected_at | TIMESTAMPTZ NOT NULL | |
| created_at | TIMESTAMPTZ DEFAULT NOW() | |

Índices: `(printer_id, collected_at DESC)`, hypertable por `collected_at`

### printer_events

| Campo | Tipo | Descrição |
|-------|------|-----------|
| id | BIGSERIAL | |
| printer_id | UUID FK → printers.id | |
| client_id | UUID FK → clients.id | |
| event_type | VARCHAR(100) | 'paper_jam', 'cover_open', 'toner_empty', 'toner_low', 'offline', 'error', 'maintenance', 'general' |
| severity | ENUM('info', 'warning', 'critical') | |
| code | VARCHAR(50) | código do erro se disponível |
| description | TEXT | |
| raw_data | TEXT | dado bruto da MIB |
| is_resolved | BOOLEAN DEFAULT false | |
| resolved_at | TIMESTAMPTZ | |
| resolved_by | UUID FK → users.id | |
| resolution_note | TEXT | |
| occurred_at | TIMESTAMPTZ | |
| created_at | TIMESTAMPTZ DEFAULT NOW() | |

Índices: `(printer_id, occurred_at DESC)`, `(client_id, severity, is_resolved)`, `(event_type, occurred_at)`

### print_jobs

| Campo | Tipo | Descrição |
|-------|------|-----------|
| id | BIGSERIAL | |
| client_id | UUID FK → clients.id | |
| printer_id | UUID FK → printers.id | |
| agent_id | UUID FK → agents.id | |
| job_id | VARCHAR(100) | id original do job no spool |
| document_name | VARCHAR(500) | |
| document_type | VARCHAR(20) | extensão: .doc, .pdf, .xls |
| pages | INTEGER | |
| copies | INTEGER DEFAULT 1 | |
| color_pages | INTEGER | |
| mono_pages | INTEGER | |
| is_duplex | BOOLEAN | |
| paper_size | VARCHAR(20) | A4, Letter |
| username | VARCHAR(255) | usuário que imprimiu |
| computer_name | VARCHAR(255) | estação de origem |
| job_status | VARCHAR(50) | 'completed', 'cancelled', 'error', 'spooling' |
| job_size_bytes | BIGINT | |
| printed_at | TIMESTAMPTZ | |
| collected_at | TIMESTAMPTZ | |
| created_at | TIMESTAMPTZ DEFAULT NOW() | |

Índices:
- `(client_id, printed_at DESC)` — principal consulta de bilhetagem
- `(printer_id, printed_at DESC)`
- `(username, printed_at DESC)`
- `(computer_name, printed_at DESC)`
- `(printed_at)` — para partition listing mensal
- `(client_id, printed_at, pages)` — consultas agregadas

### print_job_raw_logs

| Campo | Tipo | Descrição |
|-------|------|-----------|
| id | BIGSERIAL | |
| client_id | UUID FK → clients.id | |
| agent_id | UUID FK → agents.id | |
| raw_data | JSONB | registro original do spool/evento |
| source | VARCHAR(50) | 'eventlog', 'wmi', 'spool' |
| processed | BOOLEAN DEFAULT false | |
| processed_at | TIMESTAMPTZ | |
| error | TEXT | |
| collected_at | TIMESTAMPTZ | |
| created_at | TIMESTAMPTZ DEFAULT NOW() | |

Índices: `(client_id, processed, collected_at)`, `(agent_id)`

### alerts

| Campo | Tipo | Descrição |
|-------|------|-----------|
| id | UUID PK | |
| client_id | UUID FK → clients.id | |
| printer_id | UUID FK → printers.id (nullable) | |
| rule_id | UUID FK → alert_rules.id (nullable) | |
| title | VARCHAR(255) | |
| description | TEXT | |
| severity | ENUM('info', 'warning', 'critical') | |
| status | ENUM('open', 'acknowledged', 'resolved', 'dismissed') | |
| source | VARCHAR(50) | 'agent', 'system', 'rule' |
| resolved_at | TIMESTAMPTZ | |
| resolved_by | UUID FK → users.id | |
| resolution_note | TEXT | |
| occurred_at | TIMESTAMPTZ | |
| created_at | TIMESTAMPTZ | |
| updated_at | TIMESTAMPTZ | |

Índices: `(client_id, status, severity)`, `(printer_id, status)`, `(status, occurred_at)`

### alert_rules

| Campo | Tipo | Descrição |
|-------|------|-----------|
| id | UUID PK | |
| client_id | UUID FK → clients.id | |
| name | VARCHAR(255) | |
| description | TEXT | |
| metric | VARCHAR(100) | 'offline', 'toner_low', 'toner_empty', 'counter_stale', 'error_count', 'agent_offline' |
| condition | JSONB | {operator: '>', value: 10, unit: 'minutes'} |
| severity | ENUM('info', 'warning', 'critical') | |
| enabled | BOOLEAN DEFAULT true | |
| notify_email | BOOLEAN DEFAULT false | |
| notify_webhook | BOOLEAN DEFAULT false | |
| webhook_url | TEXT | |
| cooldown_minutes | INTEGER DEFAULT 60 | evitar repetição |
| last_triggered_at | TIMESTAMPTZ | |
| created_at | TIMESTAMPTZ | |
| updated_at | TIMESTAMPTZ | |

### agent_sync_logs

| Campo | Tipo | Descrição |
|-------|------|-----------|
| id | BIGSERIAL | |
| agent_id | UUID FK → agents.id | |
| client_id | UUID FK → clients.id | |
| sync_type | VARCHAR(50) | 'heartbeat', 'printers', 'counters', 'events', 'jobs', 'full' |
| status | ENUM('success', 'partial', 'error') | |
| items_count | INTEGER | quantidade de itens no lote |
| payload_size_bytes | INTEGER | |
| error_message | TEXT | |
| response_time_ms | INTEGER | |
| synced_at | TIMESTAMPTZ | |
| created_at | TIMESTAMPTZ DEFAULT NOW() | |

Índices: `(agent_id, synced_at DESC)`, `(client_id, synced_at DESC)`

### audit_logs

| Campo | Tipo | Descrição |
|-------|------|-----------|
| id | BIGSERIAL | |
| user_id | UUID FK → users.id (nullable) | |
| client_id | UUID FK → clients.id (nullable) | |
| action | VARCHAR(100) | 'user.login', 'client.create', 'printer.delete', 'alert.resolve' |
| resource_type | VARCHAR(50) | 'user', 'client', 'printer', 'agent', 'alert' |
| resource_id | VARCHAR(100) | |
| details | JSONB | |
| ip_address | INET | |
| user_agent | TEXT | |
| created_at | TIMESTAMPTZ DEFAULT NOW() | |

Índices: `(client_id, created_at DESC)`, `(user_id, created_at DESC)`, `(action, created_at)`

---

# ETAPA 4 — REGRAS DE NEGÓCIO

## 4.1 Multi-Tenant

- Todo registro de cliente, impressora, job, evento, alerta pertence a um `client_id`
- Toda query na camada de repositório inclui `WHERE client_id = :clientId`
- Usuários só acessam clientes vinculados via `user_client_links`
- Super admins têm visão global (bypass do filtro de client_id)
- API valida tenant ownership em toda operação: "esse recurso pertence a esse cliente?"

## 4.2 Usuários

- Cadastro apenas por super admin ou admin
- Usuário pode ser vinculado a múltiplos clientes
- Permissão por cliente: `client_manager` (gestão) ou `operator` (leitura)
- Bloqueio de acesso: se usuário não está vinculado ao cliente do recurso, retorna 404 (não 403 — por segurança, não revela existência)
- Log de auditoria para todas as ações críticas: login, criação/remoção de recursos, alteração de permissões

## 4.3 Clientes

- Código de ativação: UUID v4 + token de 6 dígitos numéricos (ex: `a1b2c3d4-5678-90ab-cdef-123456-789012`)
- Ao desativar cliente, todos os agentes param de sincronizar (validação no momento do sync)
- Soft delete preserva dados por período de retenção
- Configurações do cliente herdam de defaults globais, podendo sobrescrever

## 4.4 Agentes

- Um agente = uma máquina na rede do cliente
- Ativação: agente envia `activation_code`, API valida, gera `agent_token` JWT com escopo restrito
- Token do agente expira a cada 30 dias, renewal automático via refresh
- Heartbeat a cada 60 segundos
- Se `last_contact_at > 5 min`, agente marcado como offline
- Agente não tem acesso a dados de outros clientes (token embute client_id)
- Rate limit: 1 requisição/segundo por agente em média

## 4.5 Impressoras

- Identificação única: serial number (quando disponível) OU (MAC + modelo) OU (IP + fabricante)
- Se impressora aparece em outro agente do mesmo cliente, faz merge
- Se impressora aparece em outro cliente, cria separado (cada cliente gerencia seu parque)
- Status derivado do último contato SNMP + tempo sem reportar
- Impressoras inativas (sem contato por X dias) são marcadas como inativas automaticamente

## 4.6 Bilhetagem

- Jobs duplicados: identificados por hash de (printer_id + job_id + printed_at + pages)
- Jobs sem usuário identificado: marcados como "unknown"
- Cálculo de custo: pages * cost_per_page do cliente, separado mono/color
- Períodos de fechamento: mensal, por cliente
- Dados brutos mantidos em `print_job_raw_logs` por 30 dias para debugging

## 4.7 Alertas

- Regras por cliente (alert_rules)
- Cooldown: mesmo alerta não é disparado novamente dentro do cooldown
- Alertas de toner baixo: gerados quando level_percent <= threshold configurado
- Alerta de offline: se printer.last_contact_at + alert_offline_minutes > now()
- Alerta de agente offline: se agent.last_contact_at + 10min > now()
- Ao resolver alerta, registrar resolved_by e resolution_note

---

# ETAPA 5 — API REST COMPLETA

## 5.1 Padrões

- Base URL: `https://api.impressora.io/api/v1`
- Content-Type: `application/json`
- Autenticação: `Authorization: Bearer <token>` (usuários) ou `Authorization: Bearer <agent_token>` (agentes)
- Paginação: `?page=1&limit=50` — resposta inclui `{ data: [...], meta: { total, page, limit, totalPages } }`
- Filtros: query params padronizados
- Ordenação: `?sort=created_at&order=desc`
- Resposta de erro: `{ statusCode, message, error, timestamp, path }`
- Versionamento: URL prefix `/v1/`, media type versioning futuramente

## 5.2 Endpoints

### Autenticação

```
POST   /auth/login                    # Login
POST   /auth/refresh                  # Refresh token
POST   /auth/logout                   # Logout (invalida refresh token)
POST   /auth/forgot-password          # Solicitar reset
POST   /auth/reset-password           # Resetar senha com token
GET    /auth/me                       # Perfil do usuário logado
PUT    /auth/me                       # Atualizar próprio perfil
```

**POST /auth/login**
```json
// Request
{ "email": "user@email.com", "password": "123456" }

// Response 200
{
  "accessToken": "eyJ...",
  "refreshToken": "eyJ...",
  "expiresIn": 900,
  "user": {
    "id": "uuid",
    "name": "João",
    "email": "user@email.com",
    "role": "super_admin",
    "clients": [ { "id": "uuid", "name": "Cliente X" } ]
  }
}
```

### Clientes

```
GET    /clients                       # Listar clientes (filtros: status, search)
POST   /clients                       # Criar cliente
GET    /clients/:id                   # Detalhes do cliente
PUT    /clients/:id                   # Atualizar cliente
DELETE /clients/:id                   # Desativar (soft delete)
POST   /clients/:id/regenerate-token  # Gerar novo código de ativação
GET    /clients/:id/stats             # Estatísticas do cliente
GET    /clients/:id/agents            # Agentes do cliente
GET    /clients/:id/printers          # Impressoras do cliente
GET    /clients/:id/users             # Usuários vinculados
PUT    /clients/:id/settings          # Atualizar configurações
```

**POST /clients**
```json
// Request
{
  "name": "Empresa ABC",
  "legalName": "Empresa ABC Ltda",
  "document": "11.222.333/0001-44",
  "email": "contato@abc.com.br",
  "phone": "(11) 99999-8888"
}

// Response 201
{
  "id": "uuid",
  "name": "Empresa ABC",
  "status": "active",
  "activationCode": "a1b2c3d4-5678-90ab-cdef-123456-789012",
  "createdAt": "2026-06-25T10:00:00Z"
}
```

**GET /clients/:id/stats**
```json
// Response
{
  "totalPrinters": 45,
  "onlinePrinters": 38,
  "offlinePrinters": 5,
  "errorPrinters": 2,
  "activeAgents": 3,
  "totalJobsThisMonth": 12500,
  "totalPagesThisMonth": 87450,
  "openAlerts": 12,
  "lastSyncAt": "2026-06-25T10:00:00Z"
}
```

### Usuários

```
GET    /users                         # Listar usuários
POST   /users                         # Criar usuário (admin)
GET    /users/:id                     # Detalhes
PUT    /users/:id                     | Atualizar
DELETE /users/:id                     # Desativar
POST   /users/:id/clients             # Vincular a cliente
DELETE /users/:id/clients/:clientId   # Remover vínculo
PUT    /users/:id/clients/:clientId   # Alterar role no cliente
```

### Agentes

```
# Endpoints públicos (sem auth) — ativação inicial
POST   /agents/activate               # Ativar agente com código do cliente

# Endpoints do agente (auth: agent_token)
POST   /agents/:id/heartbeat          # Heartbeat
POST   /agents/:id/sync               # Envio de lote completo
POST   /agents/:id/printers           # Envio de impressoras
POST   /agents/:id/status             # Envio de status
POST   /agents/:id/counters           # Envio de contadores
POST   /agents/:id/events             # Envio de eventos
POST   /agents/:id/jobs               # Envio de jobs de impressão
POST   /agents/:id/logs               | Logs do agente

# Endpoints administrativos (auth: user token)
GET    /agents                        # Listar agentes (filtro: client_id, status)
GET    /agents/:id                    # Detalhes do agente
PUT    /agents/:id                    # Atualizar config
DELETE /agents/:id                    # Desativar
```

**POST /agents/activate**
```json
// Request
{
  "activationCode": "a1b2c3d4-5678-90ab-cdef-123456-789012",
  "hostname": "SRV-AGENTE-01",
  "osInfo": "Windows 11 Pro 23H2",
  "localIp": "192.168.1.100",
  "macAddress": "00:1A:2B:3C:4D:5E",
  "version": "1.0.0"
}

// Response 201
{
  "agentId": "uuid",
  "agentToken": "eyJ...",
  "tokenExpiresAt": "2026-07-25T10:00:00Z",
  "config": {
    "collectionIntervalSeconds": 300,
    "snmpCommunity": "public",
    "snmpVersion": "v2c"
  }
}
```

**POST /agents/:id/sync** (principal)
```json
// Request
{
  "timestamp": "2026-06-25T10:00:00Z",
  "heartbeat": {
    "cpuUsage": 12.5,
    "memoryUsage": 45.2,
    "diskFreeGb": 120
  },
  "printers": [
    {
      "ipAddress": "192.168.1.10",
      "macAddress": "00:1A:2B:3C:4D:5F",
      "hostname": "HP-LASERJET-01",
      "name": "HP LaserJet M404dn",
      "manufacturer": "HP",
      "model": "LaserJet M404dn",
      "serialNumber": "VNB3C12345",
      "location": "Sala 201",
      "firmware": "20240101",
      "status": "online",
      "statusDetail": "printing",
      "uptimeSeconds": 2592000,
      "isMonochrome": true
    }
  ],
  "counters": [
    {
      "printerIp": "192.168.1.10",
      "totalPages": 125000,
      "monoPages": 120000,
      "colorPages": 0,
      "copyPages": 5000,
      "scanPages": 3000,
      "duplexPages": 45000,
      "collectedAt": "2026-06-25T10:00:00Z"
    }
  ],
  "supplies": [
    {
      "printerIp": "192.168.1.10",
      "supplies": [
        { "type": "toner_black", "name": "HP 58A", "levelPercent": 65, "status": "ok" },
        { "type": "drum", "name": "Drum Unit", "levelPercent": 80, "status": "ok" }
      ]
    }
  ],
  "events": [
    {
      "printerIp": "192.168.1.10",
      "eventType": "toner_low",
      "severity": "warning",
      "description": "Black toner below 20%",
      "occurredAt": "2026-06-25T09:55:00Z"
    }
  ],
  "jobs": [
    {
      "jobId": "12345",
      "printerIp": "192.168.1.10",
      "documentName": "relatorio_mensal.pdf",
      "documentType": "pdf",
      "pages": 15,
      "copies": 1,
      "colorPages": 0,
      "monoPages": 15,
      "isDuplex": true,
      "username": "joao.silva",
      "computerName": "DESKTOP-ABC01",
      "jobStatus": "completed",
      "jobSizeBytes": 2457600,
      "printedAt": "2026-06-25T09:50:00Z"
    }
  ]
}

// Response 202
{
  "accepted": true,
  "processedItems": {
    "printers": 5,
    "counters": 5,
    "supplies": 5,
    "events": 2,
    "jobs": 15
  },
  "serverTime": "2026-06-25T10:00:05Z"
}
```

### Impressoras

```
GET    /printers                      # Listar (filtros: client_id, status, search, manufacturer)
GET    /printers/:id                  | Detalhes completos
PUT    /printers/:id                  # Atualizar (display_name, location, notes)
DELETE /printers/:id                  # Desativar
GET    /printers/:id/status-history   # Histórico de status
GET    /printers/:id/counter-history  # Histórico de contadores
GET    /printers/:id/supplies         # Suprimentos atuais
GET    /printers/:id/events           # Eventos (filtro: severity, is_resolved)
GET    /printers/:id/jobs             # Jobs da impressora
```

**GET /printers?client_id=uuid&status=warning&page=1&limit=50**
```json
// Response
{
  "data": [
    {
      "id": "uuid",
      "name": "HP LaserJet M404dn",
      "displayName": "Impressora Sala 201",
      "ipAddress": "192.168.1.10",
      "manufacturer": "HP",
      "model": "LaserJet M404dn",
      "serialNumber": "VNB3C12345",
      "status": "warning",
      "statusDetail": "toner_low",
      "lastContactAt": "2026-06-25T10:00:00Z",
      "totalPages": 125000,
      "supplies": [
        { "type": "toner_black", "levelPercent": 15, "status": "low" }
      ],
      "client": { "id": "uuid", "name": "Empresa ABC" }
    }
  ],
  "meta": { "total": 45, "page": 1, "limit": 50, "totalPages": 1 }
}
```

### Bilhetagem / Jobs

```
GET    /jobs                          # Listar jobs (filtros: client_id, printer_id, username, computer_name, date_from, date_to, document_type, job_status, sort)
GET    /jobs/export                   # Exportar CSV/XLSX/PDF (query params iguais)
GET    /jobs/stats                    # Estatísticas agregadas
GET    /jobs/stats/by-user            # Top usuários
GET    /jobs/stats/by-printer         # Top impressoras
GET    /jobs/stats/by-hour            # Volume por hora
GET    /jobs/stats/daily              # Volume diário no mês
GET    /jobs/stats/monthly            # Volume mensal no ano
```

**GET /jobs?client_id=uuid&date_from=2026-06-01&date_to=2026-06-25&page=1&limit=50**
```json
// Response
{
  "data": [
    {
      "id": 123456,
      "documentName": "relatorio_mensal.pdf",
      "pages": 15,
      "colorPages": 0,
      "monoPages": 15,
      "isDuplex": true,
      "username": "joao.silva",
      "computerName": "DESKTOP-ABC01",
      "printerName": "HP LaserJet M404dn",
      "printedAt": "2026-06-25T09:50:00Z",
      "clientName": "Empresa ABC"
    }
  ],
  "meta": { "total": 15000, "page": 1, "limit": 50, "totalPages": 300 },
  "summary": {
    "totalPages": 87450,
    "totalJobs": 15000,
    "colorPages": 12000,
    "monoPages": 75450,
    "estimatedCost": 4523.50
  }
}
```

### Alertas

```
GET    /alerts                        # Listar (filtros: client_id, printer_id, severity, status, date_from, date_to)
PUT    /alerts/:id/acknowledge        # Reconhecer
PUT    /alerts/:id/resolve            # Resolver
GET    /alerts/rules                  # Listar regras
POST   /alerts/rules                  # Criar regra
PUT    /alerts/rules/:id              # Editar regra
DELETE /alerts/rules/:id              # Excluir regra
```

**PUT /alerts/:id/resolve**
```json
// Request
{ "note": "Toner substituído pelo técnico" }

// Response 200
{
  "id": "uuid",
  "status": "resolved",
  "resolvedAt": "2026-06-25T10:30:00Z",
  "resolvedBy": { "id": "uuid", "name": "Admin" }
}
```

### Relatórios e Exportações

```
GET    /reports/printers-by-client    # CSV/XLSX/PDF
GET    /reports/printers-offline      # Impressoras offline
GET    /reports/supplies-low          # Suprimentos baixos
GET    /reports/counters-by-period    # Contadores por período
GET    /reports/errors-history        # Histórico de erros
GET    /reports/jobs-by-user          # Impressões por usuário
GET    /reports/jobs-by-printer       # Impressões por impressora
GET    /reports/client-ranking        | Ranking de clientes
GET    /reports/costs-by-client       # Custo por cliente
GET    /reports/costs-by-printer      # Custo por impressora
```

### Dashboard

```
GET    /dashboard/global              # Dashboard da operação (super_admin/admin)
GET    /dashboard/client/:clientId    # Dashboard do cliente
GET    /dashboard/printer/:printerId  # Dashboard da impressora
```

---

# ETAPA 6 — PROJETO DO AGENTE LOCAL

## 6.1 Stack do Agente

**Linguagem:** C# (.NET 8)
**Tipo:** Worker Service (Windows Service) + WPF App (configuração)
**SNMP Library:** #SNMP Library (NuGet: Leadtools.Snmp)
**Cache Local:** SQLite (Microsoft.Data.Sqlite)
**HTTP:** HttpClient + Polly (retry, circuit breaker)
**Log:** Serilog (file + console)

## 6.2 Arquitetura Interna do Agente

```
┌────────────────────────────────────────────────────────────────────────┐
│                      AGENTE .NET 8                                    │
│                                                                        │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐                   │
│  │ Config      │  │ Token       │  │ State       │                   │
│  │ Manager     │  │ Manager     │  │ Manager     │                   │
│  │ (appsettings │  │ (JWT store) │  │ (runtime    │                   │
│  │  + SQLite)  │  │             │  │  status)    │                   │
│  └─────────────┘  └─────────────┘  └─────────────┘                   │
│                                                                        │
│  ┌──────────────────────────────────────────────────────────────┐     │
│  │                    SCHEDULER (Quartz.NET)                     │     │
│  │  ┌───────────┐ ┌──────────┐ ┌──────────┐ ┌──────────────┐  │     │
│  │  │ Discovery │ │ SNMP     │ │ Job      │ │ Heartbeat    │  │     │
│  │  │ Job       │ │ Collector │ │ Collector│ │ Sender      │  │     │
│  │  │ (cada     │ │ (cada    │ │ (cada    │ │ (cada 60s)  │  │     │
│  │  │  10 min)  │ │  5 min)  │ │  2 min)  │ │             │  │     │
│  │  └───────────┘ └──────────┘ └──────────┘ └──────────────┘  │     │
│  └──────────────────────────────────────────────────────────────┘     │
│                                                                        │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐                   │
│  │ SNMP        │  │ Job         │  │ Network     │                   │
│  │ Scanner     │  │ Collector   │  │ Discovery   │                   │
│  │ Service     │  │ Service     │  │ Service     │                   │
│  │             │  │             │  │ (ARP, Ping) │                   │
│  └─────────────┘  └─────────────┘  └─────────────┘                   │
│                                                                        │
│  ┌──────────────────────────────────────────────────────────────┐     │
│  │                    SYNC ENGINE                                 │     │
│  │  ┌──────────┐  ┌──────────┐  ┌──────────┐  ┌──────────────┐ │     │
│  │  │ Queue    │  │ Batching │  │ HTTP     │  │ Retry/Backoff│ │     │
│  │  │ Manager  │  │ (compress)│ │ Sender   │  │ (Polly)      │ │     │
│  │  └──────────┘  └──────────┘  └──────────┘  └──────────────┘ │     │
│  └──────────────────────────────────────────────────────────────┘     │
│                                                                        │
│  ┌──────────────────────────────────────────────────────────────┐     │
│  │                    LOCAL STORE (SQLite)                       │     │
│  │  ┌──────────┐  ┌──────────┐  ┌──────────┐  ┌──────────────┐ │     │
│  │  │ Printers │  │ Counter  │  │ Pending  │  │ Sync Logs    │ │     │
│  │  │ Cache    │  │ Cache    │  │ Queue    │  │              │ │     │
│  │  └──────────┘  └──────────┘  └──────────┘  └──────────────┘ │     │
│  └──────────────────────────────────────────────────────────────┘     │
└────────────────────────────────────────────────────────────────────────┘
```

## 6.3 Serviços Internos

### ConfigManager
- Lê `appsettings.json` + SQLite `config` table
- Gerencia: server URL, activation code, collection interval, SNMP community, network ranges
- Interface WPF para o técnico alterar configurações

### TokenManager
- Armazena agent_token (criptografado em disco)
- Renova token automaticamente (refresh)
- Injeta token em todas as requisições HTTP

### NetworkDiscoveryService
- Escaneia rede local via: ARP table (SendARP), Ping sweep, SNMP broadcast
- Mantém lista de IPs conhecidos e faixas configuradas
- Detecta novos dispositivos e mudanças de IP
- Opção de scan agressivo (ARP scan) vs passivo (monitora tráfego SNMP)

### SnmpCollectorService
- Para cada impressora na lista:
  1. SNMP GET: sysName (.1.3.6.1.2.1.1.5), sysDescr (.1.3.6.1.2.1.1.1), sysLocation (.1.3.6.1.2.1.1.6)
  2. SNMP GET: prtGeneralCurrentLocalizationDeviceStatus (hrDeviceStatus)
  3. SNMP WALK: prtMarkerSuppliesTable para níveis de suprimentos
  4. SNMP WALK: prtMarkerTable para contadores de páginas
  5. SNMP GET: prtConsoleDisplayBufferText para mensagens de erro
- Timeout: 10s por consulta
- Retry: 2 tentativas
- Se falha em todas: marca offline

**MIBs principais consultadas:**
```
1.3.6.1.2.1.1       — System (sysName, sysDescr, sysLocation, sysUpTime)
1.3.6.1.2.1.2       — Interfaces (ifIndex, ifDescr, ifType, ifPhysAddress)
1.3.6.1.2.1.25.3.2 — hrDeviceTable (hrDeviceStatus, hrDeviceDescr)
1.3.6.1.2.1.25.3.5 — hrPrinterTable (hrPrinterStatus, hrPrinterDetectedErrorState)
1.3.6.1.2.1.43.5   — prtMarkerSuppliesTable (marcas, níveis de toner)
1.3.6.1.2.1.43.10  — prtMarkerTable (contadores de páginas)
1.3.6.1.2.1.43.11  — prtMarkerSuppliesType, prtMarkerSuppliesMaxCapacity, prtMarkerSuppliesLevel
1.3.6.1.2.1.43.12  — prtMarkerColorantTable
1.3.6.1.2.1.43.13  — prtConsoleDisplayBufferTable (mensagens de erro)
```

### JobCollectorService (Coleta de Bilhetagem)

**Estratégia escolhida: Coleta Híbrida em 3 camadas**

Devido à limitação de não haver servidor de impressão centralizado, o agente usa **múltiplas fontes simultaneamente** para capturar o máximo de jobs possível:

#### Fonte 1: Windows Event Log (Microsoft-Windows-PrintService/Operational)

É a fonte mais confiável em ambiente Windows. Cada trabalho de impressão gera eventos 307 (job printed) e 306 (job spooled) no log.

```csharp
// Leitura de eventos de impressão via EventLogReader
var query = new EventLogQuery(
    "Microsoft-Windows-PrintService/Operational",
    PathType.LogName,
    "*[System/EventID=307]"
);
using var reader = new EventLogReader(query);
// Evento 307 contém:
// - Document name
// - Printer name
// - User name
// - Total pages
// - Size in bytes
// - Computer name
```

**Event IDs relevantes:**
- 306: Job spooled (início)
- 307: Job printed (conclusão) — mais confiável
- 308: Job cancelled
- 309: Job deleted
- 310: Job error

**Dados extraídos do Event 307 XML:**
```xml
<EventData>
  <Data Name="JobId">12345</Data>
  <Data Name="PrinterName">HP LaserJet M404dn (redirected 2)</Data>
  <Data Name="DocumentName">relatorio_mensal.pdf</Data>
  <Data Name="UserName">DOMINIO\joao.silva</Data>
  <Data Name="Pages">15</Data>
  <Data Name="Size">2457600</Data>
  <Data Name="ComputerName">DESKTOP-ABC01</Data>
</EventData>
```

#### Fonte 2: WMI — Win32_PrintJob

Consulta direta à fila de impressão local e impressoras compartilhadas na rede.

```csharp
// WMI Query - captura jobs ativos e recentes
var wmiQuery = new WmiQuery("SELECT * FROM Win32_PrintJob");
var searcher = new ManagementObjectSearcher(wmiQuery);
foreach (ManagementObject job in searcher.Get())
{
    // Name format: "PrinterName, JobId"
    // TotalPages: pages
    // Document: document name
    // Owner: username
    // Status: "Printing", "Spooling", "Error", "Deleting"
}
```

**Limitação:** Só captura jobs ativos no momento da consulta. Jobs já concluídos não aparecem. Por isso, é necessário usar em combinação com Event Log.

#### Fonte 3: Performance Counters (Print Queue)

Contadores de performance fornecem estatísticas agregadas por impressora, complementando a bilhetagem individual.

```powershell
# Print Queue counters
\Print Queue(*)\Jobs
\Print Queue(*)\Total Pages Printed
\Print Queue(*)\Bytes Printed/sec
```

#### Fonte 4: Polling do Spool (PowerShell via API)

Para impressoras compartilhadas na rede, o agente pode consultar remotamente o spool Windows via:

```powershell
Get-WmiObject -Class Win32_PrintJob -ComputerName SERVER_NAME
```

#### Algoritmo de Coleta de Jobs:

```
A CADA 2 MINUTOS:
1.   lastCheck = última leitura do Event Log
2.   Eventos 307 desde lastCheck → extrai dados → print_jobs
3.   WMI Win32_PrintJob → jobs ativos → complementa
4.   Deduplica por (printer, jobId, printedAt)
5.   Tenta associar username e computador
     - Se username tem domínio, extrai apenas o nome
     - Se computador é IP, tenta resolver hostname
6.   Enfileira no sync queue (SQLite)
7.   Atualiza lastCheck
```

#### Limitações Técnicas e Mitigações:

| Limitação | Mitigação |
|-----------|-----------|
| Event Log não captura páginas coloridas vs mono | Estimar baseado no modelo da impressora (se mono, 100% mono); futuramente: análise PCL/PostScript |
| Event Log sem nome do computador de origem em alguns casos | Usar WMI como fallback; registrar como "unknown" |
| Jobs de impressão direta via IPP ou AirPrint podem não passar pelo spool Windows | Esses jobs aparecem nos contadores SNMP (total_pages) — conciliar via contadores |
| WMI remoto requer permissões de rede | Agente é executado com conta com privilégios locais; configurar DCOM |
| Volume alto de eventos (empresas grandes) | Batch processing, filtro por timestamp, retention local de 7 dias |

## 6.4 Fluxo de Sincronização

```
1. Sync Engine verifica: há dados pendentes? (SQLite: pending_queue)
2. Se sim:
   a. Monta lote (máx 500KB ou 50 itens)
   b. Comprime com GZip
   c. Envia para POST /agents/:id/sync
   d. Se sucesso (202):
      - Remove itens da pending_queue
      - Registra em sync_logs
   e. Se erro 401: tenta refresh token
   f. Se erro 429 (rate limit): aguarda Retry-After header
   g. Se erro 5xx ou timeout: tenta novamente com backoff
   h. Se erro de rede: mantém na fila, tenta no próximo ciclo
3. Se não há dados: envia heartbeat simples
```

## 6.5 Armazenamento Local (SQLite)

```sql
-- Tabela de configuração
CREATE TABLE IF NOT EXISTS config (
    key TEXT PRIMARY KEY,
    value TEXT NOT NULL
);

-- Cache de impressoras descobertas
CREATE TABLE IF NOT EXISTS discovered_printers (
    ip TEXT PRIMARY KEY,
    mac TEXT,
    hostname TEXT,
    name TEXT,
    manufacturer TEXT,
    model TEXT,
    serial TEXT,
    snmp_version TEXT,
    first_seen TEXT,
    last_seen TEXT,
    is_active INTEGER DEFAULT 1
);

-- Fila de sincronização
CREATE TABLE IF NOT EXISTS sync_queue (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    endpoint TEXT NOT NULL,        -- 'heartbeat', 'printers', 'counters', 'events', 'jobs'
    payload TEXT NOT NULL,         -- JSON string
    compressed INTEGER DEFAULT 0,
    status TEXT DEFAULT 'pending', -- pending, sending, failed
    retry_count INTEGER DEFAULT 0,
    last_error TEXT,
    next_retry_at TEXT,
    created_at TEXT DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_sync_queue_status ON sync_queue(status);
CREATE INDEX IF NOT EXISTS idx_sync_queue_next_retry ON sync_queue(next_retry_at);

-- Última posição lida do Event Log
CREATE TABLE IF NOT EXISTS event_log_cursor (
    log_name TEXT PRIMARY KEY,
    bookmark TEXT,                 -- XML bookmark do EventLogReader
    last_event_id INTEGER,
    last_event_time TEXT
);

-- Cache de contadores para detecção de incremento
CREATE TABLE IF NOT EXISTS counter_cache (
    printer_ip TEXT,
    metric TEXT,                   -- 'total_pages', 'mono_pages', etc.
    last_value INTEGER,
    last_collected TEXT,
    PRIMARY KEY (printer_ip, metric)
);

-- Log de sincronização
CREATE TABLE IF NOT EXISTS sync_history (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    sync_type TEXT NOT NULL,
    status TEXT NOT NULL,
    items_count INTEGER DEFAULT 0,
    error_message TEXT,
    synced_at TEXT DEFAULT (datetime('now'))
);
```

## 6.6 Tratamento Offline

1. Agente detecta falha de conexão (timeout, DNS resolution fail, etc.)
2. Todos os dados continuam sendo coletados normalmente
3. Pendências vão para `sync_queue` no SQLite
4. Sync Engine tenta a cada 30s, com backoff exponencial: 30s, 60s, 120s, 300s (máx)
5. Quando conexão restabelecida, envia lotes na ordem de criação
6. Se fila > 10MB, prioriza: primeiro heartbeats, depois status, depois jobs
7. Dados mais antigos que 7 dias são descartados da fila (log warn)

## 6.7 Tela de Configuração do Agente (WPF)

```
┌─────────────────────────────────────────────────┐
│  CONFIGURAÇÃO DO AGENTE DE MONITORAMENTO  v1.0 │
├─────────────────────────────────────────────────┤
│                                                   │
│  ● Status: ONLINE                  [Reconectar]  │
│                                                   │
│  ┌─────────────────────────────────────────────┐ │
│  │ Servidor:  https://api.impressora.io        │ │
│  │ Código:    a1b2c3d4-...-789012             │ │
│  │ Máquina:   DESKTOP-AGENTE-01               │ │
│  │ Agente ID: uuid                            │ │
│  └─────────────────────────────────────────────┘ │
│                                                   │
│  ┌─────────────────────────────────────────────┐ │
│  │ REDE E DESCOBERTA                           │ │
│  │ Faixa de IP: 192.168.1.0/24   [Alterar]    │ │
│  │ SNMP Community: public                      │ │
│  │ SNMP Version: v2c                           │ │
│  │ Intervalo coleta: 300 segundos              │ │
│  └─────────────────────────────────────────────┘ │
│                                                   │
│  ┌─────────────────────────────────────────────┐ │
│  │ BILHETAGEM                                   │ │
│  │ ☑ Coletar jobs de impressão (Event Log)     │ │
│  │ ☑ Coletar via WMI                            │ │
│  │ Intervalo: 120 segundos                     │ │
│  │ Reter logs locais: 7 dias                   │ │
│  └─────────────────────────────────────────────┘ │
│                                                   │
│  ┌─────────────────────────────────────────────┐ │
│  │ ESTATÍSTICAS                                │ │
│  │ Impressoras encontradas: 12                 │ │
│  │ Última sincronização: 10:00:05              │ │
│  │ Pendentes na fila: 0                        │ │
│  │ Total enviado hoje: 1.245 registros         │ │
│  └─────────────────────────────────────────────┘ │
│                                                   │
│  [Forçar Sincronização]  [Reescaneamento]        │
│  [Testar SNMP]          [Ver Logs]              │
│                                                   │
└─────────────────────────────────────────────────┘
```

## 6.8 Estrutura de Pastas do Agente

```
agent/
├── PrintMonitor.Agent/
│   ├── Program.cs                    # Entry point, Host builder
│   ├── Worker.cs                     # Background service principal
│   ├── appsettings.json
│   ├── appsettings.Development.json
│   │
│   ├── Services/
│   │   ├── ConfigManager.cs
│   │   ├── TokenManager.cs
│   │   ├── NetworkDiscoveryService.cs
│   │   ├── SnmpCollectorService.cs
│   │   ├── JobCollectorService.cs
│   │   ├── SyncEngine.cs
│   │   ├── HeartbeatService.cs
│   │   └── HealthCheckService.cs
│   │
│   ├── Collectors/
│   │   ├── SnmpScanner.cs
│   │   ├── SnmpParser.cs
│   │   ├── EventLogCollector.cs
│   │   ├── WmiJobCollector.cs
│   │   └── CounterCollector.cs
│   │
│   ├── Sync/
│   │   ├── SyncQueueManager.cs
│   │   ├── BatchBuilder.cs
│   │   ├── HttpSender.cs
│   │   └── RetryPolicy.cs
│   │
│   ├── Storage/
│   │   ├── LocalDatabase.cs          # SQLite wrapper
│   │   ├── PrinterCache.cs
│   │   └── CounterCache.cs
│   │
│   ├── Models/
│   │   ├── PrinterInfo.cs
│   │   ├── SupplyInfo.cs
│   │   ├── CounterInfo.cs
│   │   ├── JobInfo.cs
│   │   ├── EventInfo.cs
│   │   └── SyncPayload.cs
│   │
│   ├── Helpers/
│   │   ├── NetworkHelper.cs          # ARP, Ping, DNS resolve
│   │   ├── SnmpHelper.cs
│   │   ├── GZipHelper.cs
│   │   └── TokenHelper.cs
│   │
│   └── Extensions/
│       ├── ServiceCollectionExtensions.cs
│       └── HostExtensions.cs
│
├── PrintMonitor.Agent.Installer/
│   ├── installer.wxs                # WiX Toolset installer
│   └── Product.wxs
│
├── PrintMonitor.Configurator/        # WPF App
│   ├── MainWindow.xaml
│   ├── MainWindow.xaml.cs
│   ├── ViewModels/
│   │   ├── MainViewModel.cs
│   │   └── SettingsViewModel.cs
│   └── Services/
│       └── AgentServiceClient.cs     # Comunicação via pipe local
│
└── PrintMonitor.Agent.Tests/
    ├── SnmpParserTests.cs
    ├── BatchBuilderTests.cs
    └── SyncQueueTests.cs
```

---

# ETAPA 7 — UX/UI DO SISTEMA

## 7.1 Mapa de Telas

```
Login
└── Dashboard Global (Super Admin / Admin)
    ├── Clientes
    │   ├── Lista de Clientes
    │   │   └── Cadastro/Edição de Cliente
    │   └── Tela do Cliente
    │       ├── Dashboard do Cliente
    │       ├── Impressoras
    │       │   ├── Lista de Impressoras
    │       │   └── Detalhe da Impressora
    │       ├── Agentes
    │       │   ├── Lista de Agentes
    │       │   └── Detalhe do Agente
    │       ├── Usuários (se admin)
    │       │   ├── Lista de Usuários
    │       │   └── Cadastro/Edição de Usuário
    │       ├── Bilhetagem
    │       │   ├── Lista de Jobs
    │       │   ├── Relatórios de Impressão
    │       │   └── Estatísticas
    │       ├── Alertas
    │       │   ├── Painel de Alertas
    │       │   └── Regras de Alerta
    │       └── Configurações do Cliente
    └── Usuários Globais (Admin)
    └── Perfil do Usuário
```

## 7.2 Descrição de Cada Tela

### 1. Login
- Formulário: e-mail, senha, "lembrar-me", "esqueci senha"
- Background com branding da empresa
- Validação de campos com feedback imediato
- Após login, redireciona para dashboard conforme perfil
- Se multi-cliente, exibe seletor de cliente ativo (header)

### 2. Dashboard Global
- **Header:** seletor de cliente (dropdown), avatar do usuário, notificações
- **Cards superiores:** Total Clientes, Agentes Ativos, Impressoras, Alertas Abertos
- **Gráficos:**
  - Impressoras online/offline (donut chart)
  - Alertas por severidade (bar chart horizontal)
  - Volume de impressão nos últimos 12 meses (line chart)
  - Top 10 clientes por volume (bar chart)
- **Tabelas rápidas:**
  - Últimos alertas críticos
  - Impressoras com suprimento baixo
  - Clientes com mais impressoras offline

### 3. Lista de Clientes
- Tabela com: nome, CNPJ, status, total impressoras, agentes ativos, última atividade
- Filtros: status, nome (search), data de criação
- Ações: editar, ativar/desativar, gerar token, excluir
- Botão "Novo Cliente"
- Estado vazio: "Nenhum cliente cadastrado. Clique em Novo Cliente para começar."

### 4. Cadastro/Edição de Cliente
- Formulário dividido em seções:
  - **Dados básicos:** nome fantasia, razão social, CNPJ, email, telefone
  - **Endereço:** rua, número, cidade, estado, CEP
  - **Configurações:** intervalo de coleta, retenção de dados, limites
  - **Custos:** valor página mono, valor página colorida, moeda
  - **Observações:** texto livre
- Ao salvar, gera automaticamente código de ativação
- Exibe código de ativação em destaque (copiar com um clique)

### 5. Tela do Cliente (Dashboard do Cliente)
- **Cards:** Total Impressoras, Online, Offline, Alertas, Impressões Hoje/Mês
- **Gráficos de status:** pizza (status), barras (impressões por dia no mês)
- **Tabelas:**
  - Impressoras com alerta (toner baixo, offline)
  - Últimos 10 eventos
  - Top 5 usuários que mais imprimiram no mês
- **Ações rápidas:** ver impressoras, ver agentes, ver bilhetagem

### 6. Lista de Impressoras
- Tabela com: nome/IP, modelo, fabricante, status, última comunicação, total páginas, suprimentos
- Filtros: status, fabricante, modelo, search (nome/IP), agente
- Badges coloridos de status (verde=online, amarelo=warning, vermelho=offline, cinza=inativo)
- Indicadores de suprimento com barra de progresso colorida
- Ações: detalhes, editar nome/local, desativar
- Exportar lista para CSV

### 7. Detalhe da Impressora
- **Header:** nome, IP, modelo, status atual com badge
- **Aba "Informações":** fabricante, serial, firmware, localização, uptime, agente responsável
- **Aba "Suprimentos":** cards para cada suprimento com percentual, cor, status
- **Aba "Contadores":** gráfico de linha (total pages ao longo do tempo), tabela de leituras
- **Aba "Eventos":** tabela de eventos/histórico de erros, filtro por severidade
- **Aba "Jobs":** últimas impressões da impressora
- **Aba "Status":** timeline de mudanças de status

### 8. Painel de Suprimentos
- Grid de cards, um por suprimento crítico
- Cards coloridos: verde (>30%), amarelo (10-30%), vermelho (<10%)
- Agrupado por cliente/impressora
- Ações: "marcar como trocado" (resolve alerta)

### 9. Painel de Alertas
- Tabela: título, impressora, severidade (badge), status, data, ações
- Filtros: severidade, status, cliente, impressora, período
- Ações: reconhecer, resolver (com nota), silenciar
- Atalho para criar regras de alerta
- Sidebar com contagem por severidade

### 10. Bilhetagem de Impressão
- Tabela de jobs com: documento, usuário, computador, impressora, páginas, cor/mono, duplex, data
- Filtros combinados: cliente, período (date picker), usuário, impressora, computador, tipo documento
- Ordenação por qualquer coluna
- Paginação com totalizadores no topo
- **Resumo no topo:** Total de páginas, total jobs, páginas coloridas, mono, custo estimado
- Botões de exportação: CSV, XLSX, PDF
- Checkbox para seleção múltipla e exportação

### 11. Relatórios
- Menu de tipos de relatório (lateral esquerda)
- Cada relatório tem: seletor de cliente, período, gerar
- Pré-visualização na tela antes de exportar
- Gráficos agregados para relatórios de ranking
- Botão "Agendar" para relatórios recorrentes (futuro)

### 12. Bilhetagem — Estatísticas
- **Top Usuários:** bar chart horizontal com nomes e total de páginas
- **Top Impressoras:** bar chart
- **Volume por Hora:** heatmap ou line chart (identificar horários de pico)
- **Volume Diário:** bar chart do mês
- **Volume Mensal:** line chart do ano
- **Mono vs Colorido:** donut chart
- **Documentos mais impressos:** tabela

### 13. Lista de Agentes
- Tabela: nome, IP, versão, status online/offline, última comunicação, total impressoras descobertas
- Badge de status online/offline (verde/cinza)
- Ações: detalhes, desativar, ver logs

### 14. Detalhe do Agente
- Informações da máquina: hostname, OS, IP, MAC, versão
- Status: online/offline, última comunicação, última sincronização
- Impressoras descobertas por este agente (tabela vinculada)
- Logs de sincronização (tabela com data, tipo, status, itens, erro)
- Gráfico de quantidade de dados enviados por dia
- Ações: forçar sincronização, reescaneamento

### 15. Tela de Configurações do Cliente
- Seções colapsáveis: Coleta, Alertas, Custos, Retenção, Aparência
- Formulário com validação
- Salvamento com feedback toast

### 16. Perfil do Usuário
- Nome, email, avatar, alterar senha
- Preferências: timezone, formato de data, idioma (futuro)

## 7.3 Design System

**Base:** shadcn/ui (Radix primitives + Tailwind)
**Cores:** Brand primária (azul corporate), escala de cinza, cores semânticas (red, amber, green)
**Tipografia:** Inter (sans-serif), monospace para dados técnicos
**Componentes compartilhados:**
- DataTable (ordenação, filtro, paginação, seleção)
- StatusBadge
- MetricCard
- ChartContainer (wrapper para recharts)
- FilterBar
- ExportButton
- PageHeader (título + breadcrumbs + ações)

---

# ETAPA 8 — ROADMAP DE DESENVOLVIMENTO

## MVP (3-4 meses)

### Objetivo: Validar o produto com funcionalidades essenciais

**Backend:**
- [x] Setup do projeto NestJS + Prisma + PostgreSQL
- [x] Modelagem do banco (tabelas core: clients, users, agents, printers)
- [x] Autenticação JWT + refresh token
- [x] RBAC básico (super_admin, admin, client_manager, operator)
- [x] CRUD de clientes
- [x] CRUD de usuários + vínculo com clientes
- [x] Ativação de agente via código
- [x] Endpoint de sincronização de telemetria (POST /agents/:id/sync)
- [x] Recebimento e armazenamento de impressoras, status, contadores
- [x] Heartbeat do agente
- [x] Multi-tenant isolation (filtro client_id em todas as queries)

**Agente:**
- [x] Setup do .NET Worker Service
- [x] Ativação com código do cliente
- [x] Descoberta de rede (ARP scan + ping sweep)
- [x] Coleta SNMP básica (status, sysName, modelo, serial)
- [x] Coleta de suprimentos (toner levels)
- [x] Coleta de contadores (total pages)
- [x] Envio de telemetria para API
- [x] SQLite local para cache
- [x] Heartbeat periódico
- [x] WPF Configurator (tela de configuração simples)

**Frontend:**
- [x] Setup Next.js + Tailwind + shadcn/ui
- [x] Tela de login
- [x] Dashboard global (cards básicos)
- [x] Lista de clientes
- [x] Cadastro de cliente
- [x] Tela do cliente (dashboard simples)
- [x] Lista de impressoras
- [x] Detalhe da impressora (abas: info, suprimentos, contadores)

**Infra:**
- [x] Docker Compose para dev (API + Postgres + Redis)
- [x] Deploy AWS (ECS Fargate + RDS + ElastiCache)
- [x] CI/CD básico (GitHub Actions)

**MVP NÃO INCLUI:**
- Bilhetagem de impressão (jobs)
- Alertas com regras
- Módulo de relatórios avançados
- Exportação
- Atualização automática do agente
- WebSocket / tempo real

## Versão 2 (2-3 meses após MVP)

**Bilhetagem:**
- [x] Coleta de jobs via Event Log (agente)
- [x] Coleta de jobs via WMI (agente)
- [x] Endpoint de jobs na API
- [x] Armazenamento e indexação de jobs
- [x] Deduplicação de jobs
- [x] Tela de bilhetagem (listagem com filtros)
- [x] Estatísticas de impressão (top usuários, top impressoras)
- [x] Cálculo de custo estimado

**Alertas:**
- [x] CRUD de regras de alerta
- [x] Engine de alertas (worker que processa regras)
- [x] Alertas de toner baixo, offline, contador parado
- [x] Painel de alertas
- [x] Resolver alertas com nota

**Melhorias Agente:**
- [x] Coleta de eventos SNMP (erros, atolamentos)
- [x] Melhoria no Job Collector (WMI + Event Log combinados)
- [x] Compressão GZip dos lotes
- [x] Retry com backoff (Polly)
- [x] Tratamento offline robusto

**Frontend:**
- [x] Painel de alertas
- [x] Tela de bilhetagem com filtros
- [x] Gráficos de estatísticas de impressão
- [x] Detalhe da impressora com histórico (abas completas)
- [x] Tela de regras de alerta

## Versão 3 (2-3 meses após V2)

**Relatórios e Exportação:**
- [x] Todos os relatórios especificados
- [x] Exportação CSV/XLSX/PDF
- [x] Relatórios agendados (futuro)

**Agente:**
- [x] Auto-update
- [x] SNMP v3
- [x] Modo híbrido completo
- [x] Instalador MSI (WiX)
- [x] Monitoramento de performance (CPU/memória do agente)

**Melhorias:**
- [x] WebSocket para tempo real (notificações push)
- [x] 2FA (TOTP)
- [x] Webhooks para alertas
- [x] Notificação por e-mail
- [x] Logs de auditoria completos
- [x] Dashboard executivo (comparativo entre meses)
- [x] API pública (documentação OpenAPI)
- [x] Rate limiting por cliente
- [x] Internacionalização (i18n)

**Escalabilidade:**
- [x] TimescaleDB hypertables (contadores, status, jobs)
- [x] Partition listing mensal de print_jobs
- [x] Cache Redis para dashboards
- [x] Read replicas para consultas de relatórios
- [x] Worker de limpeza (data retention)

---

# ETAPA 9 — ESTRUTURA DE PASTAS DO PROJETO

```
impressora/
├── .github/
│   └── workflows/
│       ├── backend-ci.yml
│       ├── frontend-ci.yml
│       ├── agent-ci.yml
│       └── deploy.yml
│
├── backend/
│   ├── src/
│   │   ├── main.ts
│   │   ├── app.module.ts
│   │   │
│   │   ├── common/
│   │   │   ├── decorators/
│   │   │   │   ├── current-user.decorator.ts
│   │   │   │   ├── public.decorator.ts
│   │   │   │   ├── roles.decorator.ts
│   │   │   │   └── tenant-interceptor.decorator.ts
│   │   │   ├── guards/
│   │   │   │   ├── jwt-auth.guard.ts
│   │   │   │   ├── roles.guard.ts
│   │   │   │   └── tenant.guard.ts
│   │   │   ├── interceptors/
│   │   │   │   ├── tenant.interceptor.ts
│   │   │   │   ├── logging.interceptor.ts
│   │   │   │   └── transform.interceptor.ts
│   │   │   ├── filters/
│   │   │   │   └── http-exception.filter.ts
│   │   │   ├── pipes/
│   │   │   │   └── validation.pipe.ts
│   │   │   ├── middleware/
│   │   │   │   ├── tenant.middleware.ts
│   │   │   │   └── audit-log.middleware.ts
│   │   │   └── utils/
│   │   │       ├── pagination.ts
│   │   │       └── helpers.ts
│   │   │
│   │   ├── modules/
│   │   │   ├── auth/
│   │   │   │   ├── auth.module.ts
│   │   │   │   ├── auth.controller.ts
│   │   │   │   ├── auth.service.ts
│   │   │   │   ├── dto/
│   │   │   │   │   ├── login.dto.ts
│   │   │   │   │   ├── refresh.dto.ts
│   │   │   │   │   ├── forgot-password.dto.ts
│   │   │   │   │   └── reset-password.dto.ts
│   │   │   │   └── strategies/
│   │   │   │       ├── jwt.strategy.ts
│   │   │   │       └── jwt-refresh.strategy.ts
│   │   │   │
│   │   │   ├── users/
│   │   │   │   ├── users.module.ts
│   │   │   │   ├── users.controller.ts
│   │   │   │   ├── users.service.ts
│   │   │   │   ├── dto/
│   │   │   │   │   ├── create-user.dto.ts
│   │   │   │   │   ├── update-user.dto.ts
│   │   │   │   │   └── link-client.dto.ts
│   │   │   │   └── entities/
│   │   │   │       └── user.entity.ts
│   │   │   │
│   │   │   ├── clients/
│   │   │   │   ├── clients.module.ts
│   │   │   │   ├── clients.controller.ts
│   │   │   │   ├── clients.service.ts
│   │   │   │   ├── dto/
│   │   │   │   └── entities/
│   │   │   │
│   │   │   ├── agents/
│   │   │   │   ├── agents.module.ts
│   │   │   │   ├── agents.controller.ts
│   │   │   │   ├── agents.service.ts
│   │   │   │   ├── dto/
│   │   │   │   └── entities/
│   │   │   │
│   │   │   ├── printers/
│   │   │   │   ├── printers.module.ts
│   │   │   │   ├── printers.controller.ts
│   │   │   │   ├── printers.service.ts
│   │   │   │   ├── dto/
│   │   │   │   └── entities/
│   │   │   │
│   │   │   ├── jobs/
│   │   │   │   ├── jobs.module.ts
│   │   │   │   ├── jobs.controller.ts
│   │   │   │   ├── jobs.service.ts
│   │   │   │   ├── dto/
│   │   │   │   └── entities/
│   │   │   │
│   │   │   ├── alerts/
│   │   │   │   ├── alerts.module.ts
│   │   │   │   ├── alerts.controller.ts
│   │   │   │   ├── alerts.service.ts
│   │   │   │   ├── dto/
│   │   │   │   └── entities/
│   │   │   │
│   │   │   ├── dashboard/
│   │   │   │   ├── dashboard.module.ts
│   │   │   │   ├── dashboard.controller.ts
│   │   │   │   └── dashboard.service.ts
│   │   │   │
│   │   │   ├── reports/
│   │   │   │   ├── reports.module.ts
│   │   │   │   ├── reports.controller.ts
│   │   │   │   ├── reports.service.ts
│   │   │   │   └── exporters/
│   │   │   │       ├── csv.exporter.ts
│   │   │   │       ├── xlsx.exporter.ts
│   │   │   │       └── pdf.exporter.ts
│   │   │   │
│   │   │   └── audit/
│   │   │       ├── audit.module.ts
│   │   │       └── audit.service.ts
│   │   │
│   │   ├── queue/
│   │   │   ├── queue.module.ts
│   │   │   ├── producers/
│   │   │   │   ├── sync.producer.ts
│   │   │   │   └── alert.producer.ts
│   │   │   └── consumers/
│   │   │       ├── sync.consumer.ts
│   │   │       └── alert.consumer.ts
│   │   │
│   │   ├── database/
│   │   │   ├── prisma/
│   │   │   │   ├── schema.prisma
│   │   │   │   ├── migrations/
│   │   │   │   └── seed.ts
│   │   │   └── database.module.ts
│   │   │
│   │   └── config/
│   │       ├── config.module.ts
│   │       └── config.schema.ts
│   │
│   ├── test/
│   │   ├── unit/
│   │   └── e2e/
│   │
│   ├── docker-compose.yml
│   ├── Dockerfile
│   ├── .env.example
│   ├── tsconfig.json
│   ├── nest-cli.json
│   └── package.json
│
├── frontend/
│   ├── src/
│   │   ├── app/
│   │   │   ├── layout.tsx
│   │   │   ├── page.tsx
│   │   │   ├── login/
│   │   │   ├── forgot-password/
│   │   │   ├── reset-password/
│   │   │   │
│   │   │   ├── (dashboard)/
│   │   │   │   ├── layout.tsx           # Sidebar + Header
│   │   │   │   ├── dashboard/
│   │   │   │   ├── clients/
│   │   │   │   │   ├── page.tsx         # Lista
│   │   │   │   │   ├── new/page.tsx     # Criar
│   │   │   │   │   ├── [id]/page.tsx    # Dashboard cliente
│   │   │   │   │   ├── [id]/edit/page.tsx
│   │   │   │   │   ├── [id]/printers/
│   │   │   │   │   ├── [id]/printers/[printerId]/
│   │   │   │   │   ├── [id]/agents/
│   │   │   │   │   ├── [id]/agents/[agentId]/
│   │   │   │   │   ├── [id]/users/
│   │   │   │   │   ├── [id]/jobs/
│   │   │   │   │   ├── [id]/alerts/
│   │   │   │   │   └── [id]/settings/
│   │   │   │   ├── users/
│   │   │   │   ├── alerts/
│   │   │   │   ├── reports/
│   │   │   │   └── profile/
│   │   │   │
│   │   │   └── api/                    # API routes (BFF)
│   │   │
│   │   ├── components/
│   │   │   ├── ui/                     # shadcn/ui components
│   │   │   ├── layout/
│   │   │   │   ├── sidebar.tsx
│   │   │   │   ├── header.tsx
│   │   │   │   └── client-selector.tsx
│   │   │   ├── tables/
│   │   │   │   ├── data-table.tsx
│   │   │   │   └── columns.tsx
│   │   │   ├── charts/
│   │   │   │   ├── donut-chart.tsx
│   │   │   │   ├── bar-chart.tsx
│   │   │   │   ├── line-chart.tsx
│   │   │   │   └── stat-card.tsx
│   │   │   ├── filters/
│   │   │   │   └── filter-bar.tsx
│   │   │   └── shared/
│   │   │       ├── status-badge.tsx
│   │   │       ├── supply-indicator.tsx
│   │   │       ├── export-button.tsx
│   │   │       └── empty-state.tsx
│   │   │
│   │   ├── hooks/
│   │   │   ├── use-auth.ts
│   │   │   ├── use-clients.ts
│   │   │   └── use-pagination.ts
│   │   │
│   │   ├── lib/
│   │   │   ├── api.ts                  # Axios instance
│   │   │   ├── auth.ts
│   │   │   └── utils.ts
│   │   │
│   │   ├── stores/
│   │   │   ├── auth-store.ts
│   │   │   └── client-store.ts
│   │   │
│   │   └── types/
│   │       ├── client.ts
│   │       ├── printer.ts
│   │       ├── agent.ts
│   │       ├── job.ts
│   │       └── alert.ts
│   │
│   ├── public/
│   ├── tailwind.config.ts
│   ├── next.config.js
│   ├── tsconfig.json
│   └── package.json
│
├── agent/
│   └── (conforme estrutura detalhada na Etapa 6.8)
│
├── infra/
│   ├── docker/
│   │   ├── Dockerfile.api
│   │   ├── Dockerfile.frontend
│   │   └── docker-compose.yml
│   ├── terraform/
│   │   ├── main.tf
│   │   ├── variables.tf
│   │   ├── outputs.tf
│   │   ├── ecs/
│   │   ├── rds/
│   │   ├── redis/
│   │   └── s3/
│   └── kubernetes/                    # Futuro
│       └── ...
│
├── docs/
│   ├── api/
│   │   └── openapi.yaml
│   ├── architecture.md
│   └── agent-setup.md
│
├── .gitignore
└── README.md
```

---

# ETAPA 10 — PLANO DE IMPLEMENTAÇÃO

## 10.1 Ordem de Desenvolvimento (MVP)

| Sprint | Duração | Foco | Entregas |
|--------|---------|------|----------|
| **Sprint 1** | 2 semanas | Setup + Auth | Projeto NestJS estruturado, Prisma com schema inicial, Docker Compose, Autenticação JWT, RBAC, CRUD de usuários |
| **Sprint 2** | 2 semanas | Clientes | CRUD de clientes, geração de token de ativação, vínculo de usuários a clientes, multi-tenant isolation |
| **Sprint 3** | 3 semanas | Agente (parte 1) | Setup .NET Worker, ativação com código, descoberta de rede, SNMP básico, SQLite local, heartbeat |
| **Sprint 4** | 2 semanas | API de Telemetria | Endpoint de sync, recebimento de impressoras/status/contadores/suprimentos, persistência, upsert |
| **Sprint 5** | 3 semanas | Agente (parte 2) | Coleta completa de status/suprimentos/contadores/eventos, fila offline, retry, WPF configurador |
| **Sprint 6** | 2 semanas | Frontend Básico | Login, dashboard global, lista de clientes, cadastro cliente, tela do cliente |
| **Sprint 7** | 2 semanas | Frontend Impressoras | Lista de impressoras, detalhe da impressora (abas info/suprimentos/contadores), dashboard cliente |
| **Sprint 8** | 1 semana | Integração + QA | Teste completo de ponta a ponta, deploy AWS, CI/CD, ajustes finais |

**Total MVP: ~17 semanas (4 meses)**

## 10.2 Prioridades

1. **Autenticação e multi-tenant** — base de tudo
2. **Cliente + token de ativação** — dependência para agente
3. **Agente (coleta SNMP)** — funcionalidade core
4. **API de telemetria + persistência** — onde os dados ficam
5. **Frontend de visualização** — entrega valor ao usuário
6. **Melhorias contínuas** — bilhetagem, alertas, relatórios

## 10.3 Riscos Técnicos e Mitigações

| Risco | Probabilidade | Impacto | Mitigação |
|-------|--------------|---------|-----------|
| SNMP desabilitado em impressoras | Alta | Médio | Agente detecta e reporta; documentação orienta ativação |
| Event Log sem dados de páginas coloridas/mono | Alta | Médio | Estimar por modelo; futuro: análise de PCL |
| WMI remoto bloqueado por políticas de rede | Média | Alto | Fallback para Event Log local; documentar requisitos de rede |
| Volume alto de jobs (milhões/mês) | Média | Alto | Partition listing, TimescaleDB, arquivamento automático |
| Agente consome muitos recursos na máquina do cliente | Média | Médio | Configurável; modo econômico com intervalos maiores |
| Concorrência de múltiplos agentes no mesmo cliente | Baixa | Médio | Merge por serial/MAC; última atualização vence |
| Token de agente expirado sem renovação | Média | Alto | Refresh automático com retry; alerta no dashboard |
| LGPD — dados de usuários reais de impressão | Alta | Médio | Política de retenção configurável; anonimização opcional; termos de uso |

## 10.4 Decisões Técnicas Tomadas

| Decisão | Escolha | Motivo |
|---------|---------|--------|
| Backend | NestJS + TypeScript | Tipagem forte, modular, ecossistema maduro |
| ORM | Prisma | Type-safe, migrations automáticas, bom para multi-tenant |
| Frontend | Next.js 14 + Tailwind + shadcn/ui | SSR, performance, design system rápido |
| Agente | .NET 8 Worker Service | Acesso nativo Windows, SNMP library, baixo consumo |
| DB | PostgreSQL 16 + TimescaleDB | RLS nativo, hypertables para séries temporais |
| Fila | Bull + Redis | Robusto, retry, agendamento |
| Cache | Redis | Sessões, rate limit, cache de dashboards |
| Multi-tenant | Coluna client_id + RLS | Simples, performático, testado |
| Comunicação agente | HTTPS REST + GZip + JWT | Universal, seguro, compacto |
| Coleta de jobs | Event Log + WMI + Performance Counters | Cobertura máxima sem servidor central |
| Logs do agente | Serilog + SQLite | Estruturado, local, sem dependência |
| Instalação agente | WiX Toolset (MSI) | Instalação silenciosa, Windows Service |
| Autenticação | JWT + Refresh Token | Stateless, seguro, padrão |
| Deploy | AWS ECS Fargate + RDS + ElastiCache | Serverless containers, gerenciado |

---

# ANEXO: ESTRATÉGIA DE COLETA DE JOBS (DETALHAMENTO)

## Cenário: Sem Servidor de Impressão Central

### Problema
Em ambientes sem um servidor Windows Print Server centralizado, cada estação imprime diretamente para a impressora de rede (via TCP/IP). Não há um único ponto onde todos os jobs são registrados.

### Solução Proposta: Coleta Híbrida Distribuída

O agente usa **todas as fontes disponíveis simultaneamente**:

#### 1. Event Log Local (Microsoft-Windows-PrintService/Operational)
- Captura jobs de impressão originados **da própria máquina** onde o agente está instalado
- Dados: nome documento, usuário, páginas, tamanho, impressora destino
- Event ID 307 é o mais confiável (job concluído)
- **Cobertura:** apenas a máquina do agente

#### 2. WMI Remoto (Win32_PrintJob)
- Consulta impressoras de rede e máquinas da rede
- Captura jobs ativos no momento da consulta
- **Cobertura:** toda a rede, se houver permissões
- **Limitação:** só jobs ativos/em spool

#### 3. Monitoramento de Compartilhamento de Impressoras (opcional)
- Se impressoras são compartilhadas via Windows, o agente pode consultar a fila de impressão compartilhada
- Usa `Get-Printer` PowerShell + Win32_PrintJob WMI

#### 4. Contadores SNMP (fallback)
- O contador de páginas da impressora (total, mono, color) fornece o volume agregado
- Útil para reconciliar com jobs coletados individualmente
- Se a soma dos jobs não bater com o incremento do contador, há jobs não capturados

### Estratégia Recomendada para Produção

```
Em cada cliente:
1. Instalar o agente em UM computador que permanece ligado 24/7
   (ideal: um servidor de domínio, estação de TI, ou máquina dedicada)

2. Se possível, instalar agentes adicionais em máquinas-chave
   (estações de usuários que mais imprimem)

3. O agente principal coleta:
   - SNMP: status, suprimentos, contadores (de todas as impressoras)
   - Event Log: jobs da própria máquina
   - WMI remoto: jobs de outras máquinas na rede (se houver permissão)

4. No dashboard, apresentar:
   - Jobs com usuário identificado (via Event Log/WMI)
   - Volume total via contadores SNMP (diferença entre leituras)
   - Taxa de cobertura: jobs identificados / páginas totais SNMP

5. Se a taxa de cobertura for baixa (< 80%), recomendar:
   - Configurar o Print Service Event Log via GPO em todas as máquinas
   - Ou instalar agente em mais máquinas
```

### GPO Recomendada para Clientes

Para maximizar a cobertura sem instalar agente em todas as máquinas:

```
Configuração do Computador > 
  Políticas > 
    Modelos Administrativos > 
      Sistema > 
        Gerenciamento de Eventos > 
          Configuração do provedor de eventos:
            - Microsoft-Windows-PrintService/Operational
            - Habilitar log
            - Tamanho máximo: 1MB
            - Reter eventos conforme necessário
```

Isso garante que todas as máquinas do domínio registrem eventos de impressão, que podem ser consultados remotamente via WMI/Event Log pelo agente principal.
