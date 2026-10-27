import { Agent } from "@openai/agents";
import { config } from "../config.js";
import type { OnboardingState } from "../context.js";
import { DocsAgentOutputSchema } from "../schemas/index.js";
import { prepareDocumentationTool } from "../tools/index.js";

export const documentationAgent = new Agent<OnboardingState, typeof DocsAgentOutputSchema>({
  name: "documentation_agent",
  model: config.subagentModel,
  instructions: (runContext) => {
    const { prospect_name, document_id, product } = runContext.context.request;
    return `You are a documentation and policies agent for a bank's digital onboarding.
Determine the documents the prospect must provide for product "${product}".
Prospect: "${prospect_name}", document_id ${document_id}.
Available tools: prepare_documentation(product, prospect_name, document_id). Call it exactly once with the values above.
Return the required documents exactly as the tool returned them and summarize the policy notes.`;
  },
  tools: [prepareDocumentationTool],
  outputType: DocsAgentOutputSchema,
});
