import type {
  DocumentationResult,
  IdentityResult,
  OnboardingRequest,
  ProgressAgent,
  ProgressEvent,
  ProgressPhase,
  RiskResult,
  TraceEntry,
} from "./schemas/index.js";

export interface Escalation {
  ticket_id: string;
  reason: string;
  severity: "medium" | "high";
}

/** Shared run state: written by tool `execute` functions, so it holds real results, not LLM claims. */
export interface OnboardingState {
  request: OnboardingRequest;
  identity?: IdentityResult;
  risk?: RiskResult;
  documentation?: DocumentationResult;
  escalation?: Escalation;
  trace: TraceEntry[];
  /** Per-run progress listener. Lives on the run state, so concurrent runs never share it. */
  emit?: (event: ProgressEvent) => void;
}

const AGENT_BY_NAME: Record<string, ProgressAgent> = {
  onboarding_orchestrator: "orchestrator",
  orchestrator: "orchestrator",
  service: "orchestrator",
  identity_agent: "identity",
  verify_identity: "identity",
  risk_agent: "risk",
  check_risk_lists: "risk",
  documentation_agent: "documentation",
  prepare_documentation: "documentation",
  response_agent: "response",
  policy_guardrail: "policy",
  bank_policy_guardrail: "policy",
};

/** Single exit point for progress events; a failing listener must never break the run. */
export function emitStep(
  state: OnboardingState,
  agent: string,
  phase: ProgressPhase,
  detail: string,
): void {
  try {
    state.emit?.({
      type: "step",
      at: new Date().toISOString(),
      agent: AGENT_BY_NAME[agent] ?? "orchestrator",
      phase,
      detail,
    });
  } catch {
    // ignore listener errors (e.g. a closed client connection)
  }
}

export function addTrace(
  state: OnboardingState,
  agent: string,
  step: string,
  detail: string,
  phase: ProgressPhase = "progress",
): void {
  state.trace.push({ at: new Date().toISOString(), agent, step, detail });
  emitStep(state, agent, phase, `${step}: ${detail}`);
}
