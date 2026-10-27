import { randomUUID } from "node:crypto";
import {
  MaxTurnsExceededError,
  type ModelProvider,
  OutputGuardrailTripwireTriggered,
  Runner,
  setTracingDisabled,
} from "@openai/agents";
import { orchestratorAgent } from "../agents/orchestrator.agent.js";
import { config } from "../config.js";
import { addTrace, type OnboardingState } from "../context.js";
import { evaluatePolicy } from "../policy/policy.js";
import type { Mitigation, OnboardingRequest, OnboardingResult } from "../schemas/index.js";
import { openEscalation } from "../tools/index.js";

// Global switch too, so nested agent-tool runs never export traces unless opted in.
setTracingDisabled(!config.tracingEnabled);

export interface StartOnboardingOptions {
  /** Injected in tests to avoid the network. */
  modelProvider?: ModelProvider;
  maxTurns?: number;
}

const FAILSAFE_MITIGATION: Mitigation = {
  issue: "The automated onboarding process could not be completed reliably.",
  proposed_actions: [
    "Manual review by an onboarding specialist",
    "Contact the customer to confirm their data and, if needed, schedule an in-branch visit",
  ],
};

function failureKind(error: unknown): string {
  if (error instanceof OutputGuardrailTripwireTriggered) return "guardrail";
  if (error instanceof MaxTurnsExceededError) return "max_turns";
  return "runtime_error";
}

function failureDetail(error: unknown): string {
  if (error instanceof OutputGuardrailTripwireTriggered) {
    const info = error.result.output.outputInfo;
    return `Policy guardrail rejected the orchestrator output: ${Array.isArray(info) ? info.join(" ") : String(info)}`;
  }
  // Only the error class: provider messages may echo request data.
  return error instanceof Error ? error.constructor.name : "unknown error";
}

export async function startOnboarding(
  request: OnboardingRequest,
  options: StartOnboardingOptions = {},
): Promise<OnboardingResult> {
  const onboarding_id = randomUUID();
  const state: OnboardingState = { request, trace: [] };
  addTrace(state, "service", "start", `onboarding ${onboarding_id} for ${request.product}`);

  const runner = new Runner({
    modelProvider: options.modelProvider,
    tracingDisabled: !config.tracingEnabled,
  });

  try {
    const result = await runner.run(orchestratorAgent, "Start the onboarding process.", {
      context: state,
      maxTurns: options.maxTurns ?? config.maxTurns,
    });
    const output = result.finalOutput;
    if (!output) throw new Error("Orchestrator returned no structured output");

    const policy = evaluatePolicy(state);
    const reasons = [
      ...(policy.decision === output.status ? policy.reasons : []),
      ...output.reasons,
    ];
    addTrace(state, "service", "completed", `status=${output.status}`);

    return {
      onboarding_id,
      status: output.status,
      reasons: [...new Set(reasons)],
      mitigation: output.mitigation,
      documents: state.documentation?.required_documents ?? [],
      customer_message: output.customer_message,
      trace: state.trace,
    };
  } catch (error) {
    return failSafe(onboarding_id, state, error);
  }
}

/** Any failure ends in a human review, never an approval. */
function failSafe(onboarding_id: string, state: OnboardingState, error: unknown): OnboardingResult {
  addTrace(state, "service", "failure", `${failureKind(error)}: ${failureDetail(error)}`);

  const policy = evaluatePolicy(state);
  const reasons = [
    "Automated onboarding could not be completed; the case was escalated for manual review.",
    ...(policy.decision === "approved" ? [] : policy.reasons),
  ];
  const ticket =
    state.escalation?.ticket_id ??
    openEscalation(state, "service", reasons[0] ?? "fail-safe", "high");

  return {
    onboarding_id,
    status: "escalated",
    reasons,
    mitigation: FAILSAFE_MITIGATION,
    documents: state.documentation?.required_documents ?? [],
    customer_message: `Estimado cliente, no pudimos completar su solicitud de forma automática. Un especialista revisará su caso y se pondrá en contacto con usted. Número de referencia: ${ticket}.`,
    trace: state.trace,
  };
}
