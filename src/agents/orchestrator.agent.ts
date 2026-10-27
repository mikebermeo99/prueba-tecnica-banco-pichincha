import { Agent, type OutputGuardrail } from "@openai/agents";
import { config } from "../config.js";
import { addTrace, emitStep, type OnboardingState } from "../context.js";
import { checkOrchestratorDecision } from "../policy/policy.js";
import { OrchestratorOutputSchema } from "../schemas/index.js";
import { escalateToHumanTool } from "../tools/index.js";
import { documentationAgent } from "./documentation.agent.js";
import { identityAgent } from "./identity.agent.js";
import { ResponseAgentInputSchema, responseAgent } from "./response.agent.js";
import { riskAgent } from "./risk.agent.js";

// Sub-agent output is handed back to the orchestrator as JSON text.
const asJson = (run: { finalOutput?: unknown }) => JSON.stringify(run.finalOutput ?? null);

/** Policy lives in code: the LLM orchestrates, but cannot approve what the tools did not support. */
export const policyGuardrail: OutputGuardrail<typeof OrchestratorOutputSchema, OnboardingState> = {
  name: "bank_policy_guardrail",
  execute: async ({ agentOutput, context }) => {
    const verdict = checkOrchestratorDecision(context.context, agentOutput);
    if (verdict.tripwire) {
      addTrace(context.context, "policy_guardrail", "tripwire", verdict.reasons.join(" "), "failed");
    } else {
      emitStep(context.context, "policy_guardrail", "completed", "Decision consistent with bank policy");
    }
    return { tripwireTriggered: verdict.tripwire, outputInfo: verdict.reasons };
  },
};

export const orchestratorAgent = new Agent<OnboardingState, typeof OrchestratorOutputSchema>({
  name: "onboarding_orchestrator",
  model: config.orchestratorModel,
  instructions: (runContext) => {
    const { prospect_name, document_id, product } = runContext.context.request;
    return `You are the orchestrator of a bank's digital onboarding process.
Prospect: "${prospect_name}", document_id ${document_id}, requested product: ${product}.

Procedure:
1. Call run_identity_verification and run_risk_screening first (you may call them in the same turn).
2. Only if there is no blocking issue (identity confidence >= 0.8 and verified, risk level not high), call run_documentation_preparation.
3. If there is a failure or any ambiguity (low identity confidence, high risk, incomplete checks), propose a concrete mitigation, for example biometric re-verification, an in-branch visit, or compliance manual review, and call escalate_to_human with the reason and severity. A confidently failed identity check is a rejection, not an escalation.
4. Finally call run_customer_response, passing the status, reasons and mitigation you decided, then reply with the structured output, reusing the customer_message it returned.

Rules:
- Base your decision only on tool results. Never claim approval without them.
- A bank policy guardrail checks your final answer against the tool results; an unsupported "approved" is discarded.
- status "approved" requires prepared documentation. mitigation is null when approved.`;
  },
  tools: [
    identityAgent.asTool({
      toolName: "run_identity_verification",
      toolDescription: "Run the identity verification agent for the prospect. Returns verified, confidence and requires_escalation.",
      customOutputExtractor: asJson,
    }),
    riskAgent.asTool({
      toolName: "run_risk_screening",
      toolDescription: "Run the risk list screening agent for the prospect. Returns risk_level, matches and requires_escalation.",
      customOutputExtractor: asJson,
    }),
    documentationAgent.asTool({
      toolName: "run_documentation_preparation",
      toolDescription: "Run the documentation agent to get required documents for the requested product. Only call when there is no blocking issue.",
      customOutputExtractor: asJson,
    }),
    responseAgent.asTool({
      toolName: "run_customer_response",
      toolDescription: "Write the Spanish customer message for the decision you made. Pass status, reasons and mitigation.",
      parameters: ResponseAgentInputSchema,
      customOutputExtractor: asJson,
    }),
    escalateToHumanTool,
  ],
  outputType: OrchestratorOutputSchema,
  outputGuardrails: [policyGuardrail],
});
