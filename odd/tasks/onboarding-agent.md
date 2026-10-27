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
- Models: small model for sub-agents, large model for orchestrator (user request: "luna" / "terra 6.1"). "terra 6.1" not found in any source; third-party sources list `gpt-5.6-luna` / `gpt-5.6-terra` (no official OpenAI page found). Configurable via `SUBAGENT_MODEL` / `ORCHESTRATOR_MODEL`, defaults `gpt-5.6-luna` / `gpt-5.6-terra`; confirm with `GET /v1/models` once the key is available.
- Tracing export to OpenAI disabled by default (PII: names, document IDs); opt-in via `OPENAI_AGENTS_TRACING=1`.
- Tools cross-check LLM-supplied args (document_id, name, product) against the request in `RunContext`; mismatch is rejected and traced.
- Fail-safe: any agent/runtime failure or guardrail trip → `escalated`, never `approved`.

## TDD
- Mode: strict (source: global agent config `Strict TDD Mode: enabled`).
- Runner: `npx vitest run`.

## Delivery
- Strategy: `single-pr` (exception to ~400-line budget): quick technical test, no remote/PR yet, user asked for agility. Forecast ~900 authored lines; one work-unit commit per task keeps history reviewable.
- RDD: off (global) — ordinary checks only.

## Tasks
- [x] T1 Scaffold: git, TS, Express 5 app factory, `/health`, static `public/`, vitest + supertest, App Service-ready scripts. Route: inline (mechanical config files). Evidence: RED (missing `src/app.ts` import) → GREEN 2/2 tests; `typecheck` OK; `build` OK; `PORT=3999 node dist/server.js` → `/health` `{"status":"ok"}`. Commit: see git log `feat: scaffold onboarding service`. Note: `.env.example` blocked by local permission settings; env vars go in README.
- [x] T2 zod schemas + mock tools + `policy.ts` (TDD on rules). Route: delegated writer. Evidence: RED (3 new test files failed on missing modules) → GREEN 39/39 tests (`npx vitest run`); `npm run typecheck` OK; `npm run build` OK. Policy precedence: escalated > rejected (high risk + failed identity goes to compliance). Guardrail allows model to be more conservative only (approved→{approved,escalated}, escalated→{escalated}, rejected→{rejected,escalated}). Commit: see git log `feat: add schemas, mock tools and policy rules`.
- [x] T3 Four sub-agents with prompts and typed outputs (+ SDK tools in `src/tools/index.ts`, scripted `FakeModel` helper in `tests/helpers/fakeModel.ts`). Route: delegated writer. Evidence: tools tests RED (missing module) → GREEN 8/8; agents tests written with implementation then RED re-observed by temporarily moving `src/agents/*.ts` away (missing module) → GREEN 7/7; full `npx vitest run` 54/54; `npm run typecheck` OK; `npm run build` OK. Verified: nested `asTool` runs receive the parent RunContext (same `context` object). Commit: see git log `feat: add specialized sub-agents`.
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
- T1, T2, T3 done. Authored lines on branch: ~700 (T2 incl. tests).

## Next step
T4 (orchestrator + guardrail). Tests use a scripted fake Model; no API key needed. T7 blocked on Azure params + authorization.
