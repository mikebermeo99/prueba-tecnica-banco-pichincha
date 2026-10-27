import type { OnboardingState } from "../context.js";
import type { OrchestratorOutput, Status } from "../schemas/index.js";

export const MIN_IDENTITY_CONFIDENCE = 0.8;

export interface PolicyOutcome {
  decision: Status;
  reasons: string[];
}

/**
 * Deterministic bank policy over real tool results. Escalation wins over rejection:
 * a prospect with a risk-list hit goes to compliance rather than getting an automatic "no".
 */
export function evaluatePolicy(state: OnboardingState): PolicyOutcome {
  const reasons: string[] = [];
  let escalate = false;
  let reject = false;

  const { identity, risk } = state;

  if (!identity) {
    escalate = true;
    reasons.push("Incomplete verification: identity check was not completed.");
  } else if (identity.confidence < MIN_IDENTITY_CONFIDENCE) {
    escalate = true;
    reasons.push(
      `Identity confidence ${identity.confidence} is below the ${MIN_IDENTITY_CONFIDENCE} threshold.`,
    );
  } else if (!identity.verified) {
    reject = true;
    reasons.push(`Identity verification failed with confidence ${identity.confidence}.`);
  }

  if (!risk) {
    escalate = true;
    reasons.push("Incomplete verification: risk list check was not completed.");
  } else if (risk.risk_level === "high") {
    escalate = true;
    reasons.push("High risk: risk list match requires compliance review.");
  } else if (risk.risk_level === "medium") {
    reasons.push("Medium risk: enhanced due diligence applies.");
  }

  const decision: Status = escalate ? "escalated" : reject ? "rejected" : "approved";
  if (decision === "approved" && reasons.length === 0) {
    reasons.push("Identity verified and no risk list matches.");
  }
  return { decision, reasons };
}

export interface GuardrailVerdict {
  tripwire: boolean;
  reasons: string[];
}

// What the LLM may answer for each policy decision: it can be more conservative, never less.
const ALLOWED: Record<Status, Status[]> = {
  approved: ["approved", "escalated"],
  escalated: ["escalated"],
  rejected: ["rejected", "escalated"],
};

export function checkOrchestratorDecision(
  state: OnboardingState,
  output: OrchestratorOutput,
): GuardrailVerdict {
  const policy = evaluatePolicy(state);
  const reasons: string[] = [];

  if (!ALLOWED[policy.decision].includes(output.status)) {
    reasons.push(
      `Orchestrator answered "${output.status}" but policy decision is "${policy.decision}".`,
    );
  }
  if (output.status === "approved" && !state.documentation) {
    reasons.push("Orchestrator answered \"approved\" without prepared documentation.");
  }

  return { tripwire: reasons.length > 0, reasons };
}
