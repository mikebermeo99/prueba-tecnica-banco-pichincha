# Feature: onboarding-agent

## Objective
Multi-agent digital onboarding service: an LLM orchestrator agent coordinates four specialized sub-agents (identity, risk lists, documentation/policies, customer response), controls which tools each one can use, keeps state between steps, and mitigates uncertainty (escalation / proposed solution).

## Problem / Why
Technical test for the bank. The orchestrator must be an LLM agent (not plain code), but bank policy rules (identity confidence < 0.8 → escalate, risk `high` → escalate) must be deterministic and auditable.

## Scope
- `POST /api/v1/onboarding/start` with `{ prospect_name, document_id, product }`.
- Mock tools: `verify_identity`, `check_risk_lists`, `prepare_documentation`, plus `escalate_to_human`.
- Sub-agents exposed to the orchestrator via `agent.asTool()`; each sub-agent only receives its allowlisted tools.
- Shared state in `RunContext`, written by tool `execute` functions (real results, not LLM claims).
- Output guardrail on the orchestrator enforcing policy rules against `RunContext`.
- Simple HTML front end.
- Deployable to Azure App Service (Node, Linux) via `az` CLI.

## Constraints
- TypeScript, zod v4 for all JSON validation, `@openai/agents` (OpenAI Agents SDK).
- Artifacts in English.
- Azure commands are NOT executed without explicit user authorization (subscription, resource group, app name, region).

## Decisions
- Orchestrator = LLM agent with sub-agents as tools; policy enforced in code as a guardrail (user rejected code-only orchestrator).
- `typescript@5.9` chosen over 7.x for toolchain stability.
- Env loading via Node `--env-file-if-exists` (no dotenv); App Service uses App Settings.

## TDD
- Mode: strict (source: global agent config `Strict TDD Mode: enabled`).
- Runner: `npx vitest run`.

## Delivery
- Strategy: `ask-on-risk`. Forecast ~900 authored lines total → will ask chain strategy before exceeding ~400 on the branch.
- RDD: off (global) — ordinary checks only.

## Tasks
- [x] T1 Scaffold: git, TS, Express 5 app factory, `/health`, static `public/`, vitest + supertest, App Service-ready scripts. Route: inline (mechanical config files). Evidence: RED (missing `src/app.ts` import) → GREEN 2/2 tests; `typecheck` OK; `build` OK; `PORT=3999 node dist/server.js` → `/health` `{"status":"ok"}`. Commit: see git log `feat: scaffold onboarding service`. Note: `.env.example` blocked by local permission settings; env vars go in README.
- [ ] T2 zod schemas + mock tools + `policy.ts` (TDD on rules). Route: TBD.
- [ ] T3 Four sub-agents with prompts and typed outputs. Route: TBD.
- [ ] T4 Orchestrator agent + policy output guardrail + `escalate_to_human`. Route: TBD.
- [ ] T5 Endpoint wiring + e2e tests per scenario (approved, doubtful identity, high risk) with mocked model. Route: TBD.
- [ ] T6 `public/index.html` UI + README.
- [ ] T7 Azure App Service deploy script (`az`), pending user-provided params and authorization.

## Acceptance criteria
- Valid request returns `{ status, reasons[], mitigation?, documents?, customer_message, trace[] }`.
- Confidence < 0.8 or risk `high` can never yield `approved` (guardrail-enforced).
- Each sub-agent can only call its allowlisted tools.
- `npm run build && npm start` works with `PORT` from env.

## Progress
- T1 done. Authored lines on branch: ~150.

## Next step
T2 (needs OPENAI_API_KEY / OPENAI_MODEL only from T3 onward; T2 is model-free). T7 blocked on Azure params + authorization.
