import { Agent } from "@openai/agents";
import { z } from "zod";
import { config } from "../config.js";
import type { OnboardingState } from "../context.js";
import { MitigationSchema, ResponseAgentOutputSchema, StatusSchema } from "../schemas/index.js";

// The orchestrator decides; this agent only communicates the decision it is handed.
export const ResponseAgentInputSchema = z.object({
  status: StatusSchema,
  reasons: z.array(z.string()),
  mitigation: MitigationSchema.nullable(),
});

export const responseAgent = new Agent<OnboardingState, typeof ResponseAgentOutputSchema>({
  name: "response_agent",
  model: config.subagentModel,
  instructions: (runContext) => {
    const { request, documentation, escalation } = runContext.context;
    const documents = documentation
      ? documentation.required_documents.map((d) => `- ${d.name}: ${d.description}`).join("\n")
      : "(not prepared)";
    return `You are a customer response agent for a bank's digital onboarding.
Write the message shown to the prospect, in neutral and professional Spanish.
You do NOT decide whether the prospect is suitable: communicate exactly the status, reasons and mitigation you receive as input.
Never reveal risk list matches, scores, or internal policy thresholds to the customer.
Prospect: ${request.prospect_name}. Product: ${request.product}.
Escalation ticket: ${escalation?.ticket_id ?? "none"}.
Required documents:
${documents}
If status is "approved", list the required documents and next steps. If "escalated", explain that a specialist will review the case (mention the ticket if present) and describe the proposed mitigation. If "rejected", explain politely that the application cannot continue.
This agent has no tools.`;
  },
  tools: [],
  outputType: ResponseAgentOutputSchema,
});
