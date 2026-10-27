import { Agent } from "@openai/agents";
import { config } from "../config.js";
import type { OnboardingState } from "../context.js";
import { RiskAgentOutputSchema } from "../schemas/index.js";
import { checkRiskListsTool } from "../tools/index.js";

export const riskAgent = new Agent<OnboardingState, typeof RiskAgentOutputSchema>({
  name: "risk_agent",
  model: config.subagentModel,
  instructions: (runContext) => {
    const { prospect_name, document_id } = runContext.context.request;
    return `You are a risk list screening agent for a bank's digital onboarding.
Screen the prospect "${prospect_name}" with document_id ${document_id} against the risk lists.
A risk_level of "high" requires escalation (set requires_escalation=true); "medium" calls for enhanced due diligence.
Available tools: check_risk_lists(name, document_id). Call it exactly once with the values above.
Report only what the tool returned; never invent or downgrade matches or risk_level.`;
  },
  tools: [checkRiskListsTool],
  outputType: RiskAgentOutputSchema,
});
