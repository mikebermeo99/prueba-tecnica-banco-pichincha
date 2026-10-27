import { Agent } from "@openai/agents";
import { config } from "../config.js";
import type { OnboardingState } from "../context.js";
import { IdentityAgentOutputSchema } from "../schemas/index.js";
import { verifyIdentityTool } from "../tools/index.js";

export const identityAgent = new Agent<OnboardingState, typeof IdentityAgentOutputSchema>({
  name: "identity_agent",
  model: config.subagentModel,
  instructions: (runContext) => `You are an identity verification agent for a bank's digital onboarding.
Based on document_id: ${runContext.context.request.document_id}
verify the identity of the prospect. A confidence below 0.8 requires escalation (set requires_escalation=true).
A verified=false result with high confidence is a failed verification, not an ambiguity.
Available tools: verify_identity(document_id). Call it exactly once with the document_id above.
Report only what the tool returned; never invent or adjust verified or confidence.`,
  tools: [verifyIdentityTool],
  outputType: IdentityAgentOutputSchema,
});
