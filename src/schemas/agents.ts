import { z } from "zod";
import { RequiredDocumentSchema, RiskLevelSchema, RiskMatchSchema } from "./results.js";

// Structured outputs of the sub-agents (`outputType`).

export const IdentityAgentOutputSchema = z.object({
  verified: z.boolean(),
  confidence: z.number().min(0).max(1),
  requires_escalation: z.boolean(),
  summary: z.string(),
});
export type IdentityAgentOutput = z.infer<typeof IdentityAgentOutputSchema>;

export const RiskAgentOutputSchema = z.object({
  risk_level: RiskLevelSchema,
  matches: z.array(RiskMatchSchema),
  requires_escalation: z.boolean(),
  summary: z.string(),
});
export type RiskAgentOutput = z.infer<typeof RiskAgentOutputSchema>;

export const DocsAgentOutputSchema = z.object({
  required_documents: z.array(RequiredDocumentSchema),
  summary: z.string(),
});
export type DocsAgentOutput = z.infer<typeof DocsAgentOutputSchema>;

export const ResponseAgentOutputSchema = z.object({
  customer_message: z.string(),
});
export type ResponseAgentOutput = z.infer<typeof ResponseAgentOutputSchema>;

// Input of the response agent tool: the orchestrator passes the decision to communicate.
export const StatusSchema = z.enum(["approved", "rejected", "escalated"]);
export type Status = z.infer<typeof StatusSchema>;

export const MitigationSchema = z.object({
  issue: z.string(),
  proposed_actions: z.array(z.string()),
});
export type Mitigation = z.infer<typeof MitigationSchema>;
