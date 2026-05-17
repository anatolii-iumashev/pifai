# Protocol Agents for AI — Протоколы для AI-агентов (2025-2026)

**Раздел:** Техологии, стандарты, интеграции  
**Дата обновления:** 2026-05-17  
**Статус:** Обзор экосистемы протоколов

---

## Что такое AI Agent Protocols

**AI Agent Protocol** — стандартизированный способ для автономных агентов:
- Идентифицировать друг друга
- Описывать возможности
- Communicate (общаться)
- Координировать задачи

**Цель:** Быть для агентов тем же, чем HTTP/TCP/IP стали для веба — общей тканью для интероперабельности, безопасности и масштаба.

---

## Ключевые протоколы (2025-2026)

### 1. A2A (Agent2Agent) — Google

**Описание:** Открытый стандарт для безопасной коллаборации между автономными агентами across frameworks, vendors, domains.

**Технические детали:**
- HTTP + JSON-RPC сообщения
- **Agent Card** — манифест на well-known URL
- Описывает: capabilities, interaction modes, auth requirements, endpoints

**Использование:** Discovery и delegation across ecosystems.

**Ссылка:** [Google A2A Spec](https://github.com/google/A2A)

---

### 2. ANP (Agent Network Protocol)

**Описание:** Open-source коммуникационный протокол для создания эффективной, безопасной, открытой сети AI агентов.

**Ключевые особенности:**
- **DID-based identity layer** (`did:wba`)
- **Meta-protocol negotiation** — агенты аутентифицируются и согласовывают, какой протокол использовать (A2A, ACP, custom)
- Позиционируется как substrate для множественных агентских протоколов

**Ссылка:** [agent-network-protocol.com](https://agent-network-protocol.com)

---

### 3. MCP (Model Context Protocol)

**Описание:** Стандартизирует, как LLM/агенты подключаются к tools, APIs, local data.

**Аналогия:** «USB-C для tool и data access»

**Использование:**
- Подключение к внешним инструментам
- Доступ к структурированным данным
- Локальные file system operations

**Ссылка:** [Anthropic MCP](https://modelcontextprotocol.io)

---

### 4. Agentic Commerce Protocols

#### ACP (Agentic Commerce Protocol)
- Agent-driven shopping и payments
- Instant checkout в chat интерфейсах (Stripe integration)

#### UCP (Universal Commerce Protocol)
- Search-to-buy flows
- Google AI Mode + Shopify ecosystems

#### AP2 (Agent Payments Protocol)
- User intent с verifiable credentials («mandates»)
- Специфицирует, что агент может тратить от имени пользователя
- Auditable consent logs, regulatory compliance

---

### 5. W3C AI Agent Protocol CG

**Описание:** Community Group запущен Agent Network Protocol сообществом для определения open, interoperable protocols.

**Цель:** Чтобы агенты могли «discover, connect, and collaborate on the internet».

**Draft technical framework покрывает:**
- Agent identity and authentication
- Discovery and description
- Inter-agent communication
- Security/privacy
- Interoperability с existing web standards

**Ссылка:** [W3C AI Agent Protocol CG](https://www.w3.org/groups/cg/ai-agent-protocol)

---

## Стек протоколов (2025-2026)

```
┌─────────────────────────────────────────────────┐
│              Application Layer                   │
│  (Vertical Agents: Marketing, Support, Code)    │
├─────────────────────────────────────────────────┤
│           Commerce & Payments Layer              │
│  ACP │ UCP │ AP2 │ AMP (nano-transactions)     │
├─────────────────────────────────────────────────┤
│        Communication & Orchestration Layer       │
│  ANP │ A2A │ Matrix/XMPP │ Proprietary          │
├─────────────────────────────────────────────────┤
│         Discovery & Description Layer            │
│  Agent Cards │ Registries │ OASF │ W3C metadata │
├─────────────────────────────────────────────────┤
│            Identity & Trust Layer                │
│  DIDs (did:wba) │ Verifiable Credentials        │
│  Consent/Mandate Logs                            │
├─────────────────────────────────────────────────┤
│           Tool & Data Access Layer               │
│  MCP │ WebMCP │ Custom Tool Interfaces          │
└─────────────────────────────────────────────────┘
```

---

## Для чего это нужно ПиФ

### Интеграция AI-агентов

ПиФ использует **локальные скиллы** (`.agents/skills/`). В будущем можно интегрировать:

1. **MCP** — для подключения к внешним инструментам (календарь, почта, CRM)
2. **A2A** — для коммуникации с другими AI-агентами (например, агент-календарь, агент-почта)
3. **ANP** — для identity и discovery в открытой сети агентов

### Пример использования MCP в ПиФ:

```typescript
// Подключение к календарю через MCP
import { MCPServer } from '@modelcontextprotocol/sdk';

const calendarServer = new MCPServer({
  name: 'google-calendar',
  tools: ['list-events', 'create-event', 'update-event']
});

// Агент ПиФ может планировать сессии с пользователем
```

---

## Маркетинговые implications

### Для websites в 2026:

Сайты должны стать **agent-readable и agent-transactable**:

| Протокол | Для чего |
|----------|----------|
| **MCP** | Tool/data access для агентов |
| **ACP** | Chat-to-buy shopping flows |
| **A2A** | Multi-agent coordination |
| **UCP** | Search-to-buy из AI search engines |
| **AP2** | Payment authorization для агентов |
| **WebMCP** | Web-native context/tool access |

**Тренд:** Сайты превращаются из static pages в surfaces, которые autonomous buyers могут browse, evaluate и purchase без manual browser interaction.

---

## Безопасность и доверие

### Ключевые требования 2026:

1. **Audit trails** — логов всех действий агента
2. **Policy controls** — правила, что агент может/не может делать
3. **Human checkpoints** — точки для human approval
4. **Source evidence** — откуда агент взял информацию
5. **Verifiable credentials** — мандаты на действия от имени пользователя

**Почему важно:** Buyers care less about «autonomy» hype и more about whether agent can run safely in production.

---

## Taxonomy протоколов (Survey 2025)

### По назначению:

| Тип | Примеры | Описание |
|-----|---------|----------|
| **Context-oriented** | MCP, WebMCP | Доступ к контексту и инструментам |
| **Inter-agent** | A2A, ANP | Коммуникация между агентами |
| **Commerce** | ACP, UCP, AP2 | Торговля и платежи |
| **Identity** | DID, W3C VC | Идентификация и доверие |

### По широте:

| Тип | Примеры | Описание |
|-----|---------|----------|
| **General-purpose** | A2A, ANP, MCP | Для любых агентов |
| **Domain-specific** | AP2 (payments), AMP (mobile) | Для конкретных доменов |

---

## Ecosystem initiatives

### IAB Tech Lab (2026)
- «Agentifying» advertising standards
- Agentic Protocol SDKs для ad/marketing infrastructure

### SaaS + Blockchain
- Recording tool calls on-chain
- Automated revenue sharing
- Verifiable execution for agent operations

### Ant International — AMP
- Agentic Mobile Protocol для mobile commerce
- Nano-transactions (до 0.000001 units)
- High-frequency agent-to-agent settlement

---

## Что использовать для ПиФ сейчас

### ✅ Рекомендуется:

1. **MCP** — для локальных tools (календарь, заметки, файлы)
2. **Локальные скиллы** — пока достаточно (`.agents/skills/`)
3. **Следить за A2A** — для будущей inter-agent коммуникации

### ⏳ На будущее:

1. **ANP** — когда выйдет в production
2. **W3C AI Agent Protocol** — когда станет стандартом
3. **AP2/ACP** — если будут платежи через агентов

---

## Ресурсы

### Документация:
- [W3C AI Agent Protocol CG](https://www.w3.org/groups/cg/ai-agent-protocol)
- [Agent Network Protocol](https://agent-network-protocol.com)
- [Model Context Protocol](https://modelcontextprotocol.io)
- [Google A2A](https://github.com/google/A2A)

### Исследования:
- «Survey of AI Agent Protocols» (2025) — taxonomy и evaluation
- «2026 AI Agent Trends» — Google Cloud, Vellum
- «Agentic Commerce Protocols» — Stripe, Shopify

### Implementation:
- [Python MCP SDK](https://github.com/modelcontextprotocol/python-sdk)
- [TypeScript MCP SDK](https://github.com/modelcontextprotocol/typescript-sdk)
- [ANP Reference Implementation](https://github.com/agent-network-protocol/reference)

---

## Глоссарий

| Термин | Определение |
|--------|-------------|
| **Agent Card** | Манифест агента (capabilities, endpoints, auth) |
| **DID** | Decentralized Identifier — децентрализованный ID |
| **Verifiable Credential** | Криптографически верифицируемый документ |
| **Mandate** | Мандат на действия от имени пользователя |
| **Audit Trail** | Лог всех действий агента для compliance |
| **Human Checkpoint** | Точка для human approval в workflow |

---

**См. также:**
- `MARKETING.md` — позиционирование AI-продуктов
- `PRODUCT.md` — спецификация AI-агентов
- `.agents/skills/` — локальные скиллы ПиФ
