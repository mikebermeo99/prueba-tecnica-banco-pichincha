# Digital Onboarding Agent

Multi-agent digital onboarding service for a bank. An LLM **orchestrator** coordinates four specialized **sub-agents** (identity, risk lists, documentation, customer response). Bank policy is deterministic and enforced in code, so the LLM can never approve a case that policy would escalate.

Stack: TypeScript, Express 5, zod v4, OpenAI Agents SDK (`@openai/agents`).

## Architecture

```
POST /api/v1/onboarding/start
        |
        v
  Orchestrator (LLM) --- output guardrail: policy.ts vs RunContext state
        | asTool()
        +--> identity_agent   -> verify_identity
        +--> risk_agent       -> check_risk_lists
        +--> docs_agent       -> prepare_documentation
        +--> response_agent   -> (no tools; writes customer message)
        +--> escalate_to_human (orchestrator tool)
                |
          RunContext (shared state written by tool execute functions)
```

- **Sub-agents as tools**: each is exposed to the orchestrator via `agent.asTool()`.
- **Per-agent tool allowlist**: each sub-agent only receives its own tools.
- **RunContext state**: tool `execute` functions write real results (identity, risk, documents, escalation) and the trace; LLM claims are never trusted as facts.
- **Argument cross-check**: tools compare LLM-supplied `document_id`, name and product against the original request; mismatches are rejected and traced.
- **Policy output guardrail**: the orchestrator answer is checked against `evaluatePolicy(state)`. The model may be more conservative, never less. A tripwire yields `escalated`.
- **Fail-safe**: any agent/runtime failure or guardrail trip returns `escalated` (with a ticket), never `approved`.

## Policy rules

| Condition | Decision |
|---|---|
| Identity or risk check not completed | `escalated` |
| Identity confidence < 0.8 | `escalated` |
| Risk level `high` | `escalated` (compliance review) |
| Identity not verified (confidence >= 0.8) | `rejected` |
| Risk level `medium` | allowed, enhanced due diligence noted |
| Otherwise | `approved` |

Precedence: `escalated` > `rejected` > `approved`. `approved` also requires prepared documentation.

## Mock scenarios

Mocks are deterministic (`src/tools/mocks.ts`). Valid `document_id` has 10 digits.

| Input | Result |
|---|---|
| `document_id` `1712345678` | identity ok (0.97), low risk: `approved` |
| `document_id` ending in `0` | identity confidence 0.62: `escalated` |
| `document_id` ending in `9` | identity not verified: `rejected` |
| `document_id` ending in `5` | medium risk: `approved` with due-diligence note |
| name containing "Riesgo" | high risk (mock OFAC match): `escalated` |

Products: `cuenta_ahorros`, `cuenta_corriente`, `tarjeta_credito`.

## Configuration

| Variable | Default | Purpose |
|---|---|---|
| `OPENAI_API_KEY` | - | Required for real runs (not for tests) |
| `ORCHESTRATOR_MODEL` | `gpt-6.1-terra` | Orchestrator model |
| `SUBAGENT_MODEL` | `gpt-6-luna` | Sub-agent model |
| `MAX_TURNS` | `12` | Max agent turns per run |
| `OPENAI_AGENTS_TRACING` | off | Set to `1` to export traces to OpenAI (contains names and IDs) |
| `PORT` | `3000` | HTTP port |

Locally, a `.env` file is loaded via Node `--env-file-if-exists` (no dotenv). On Azure, use App Settings.

## Scripts

```bash
npm install
npm run dev        # tsx watch, loads .env
npm run build      # compile to dist/
npm start          # node dist/server.js
npm test           # vitest run (no network, scripted fake model)
npm run typecheck
```

Open `http://localhost:<PORT>/` for the demo UI.

## Example

```bash
curl -X POST http://localhost:3000/api/v1/onboarding/start \
  -H 'Content-Type: application/json' \
  -d '{"prospect_name":"Maria Fernanda Lopez","document_id":"1712345678","product":"cuenta_ahorros"}'
```

Response: `{ onboarding_id, status, reasons[], mitigation, documents[], customer_message, trace[] }`. Invalid input returns `400 { error: "invalid_request", issues }`.

## Tests

Tests use a scripted fake model (`tests/helpers/fakeModel.ts`), so they need no API key or network. They cover schemas, mocks, policy, tool allowlists, the guardrail, the service fail-safe and the endpoint scenarios.

## Deployment (Azure App Service)

See T7 (pending): deploy script using the `az` CLI, to be run once subscription, resource group, app name and region are provided.
