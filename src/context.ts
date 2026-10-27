import type {
  DocumentationResult,
  IdentityResult,
  OnboardingRequest,
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
}

export function addTrace(
  state: OnboardingState,
  agent: string,
  step: string,
  detail: string,
): void {
  state.trace.push({ at: new Date().toISOString(), agent, step, detail });
}
