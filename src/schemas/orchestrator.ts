import { z } from "zod";
import { MitigationSchema, StatusSchema } from "./agents.js";
import { RequiredDocumentSchema } from "./results.js";

export const OrchestratorOutputSchema = z.object({
  status: StatusSchema,
  reasons: z.array(z.string()),
  mitigation: MitigationSchema.nullable(),
  customer_message: z.string(),
});
export type OrchestratorOutput = z.infer<typeof OrchestratorOutputSchema>;

export const TraceEntrySchema = z.object({
  at: z.string(),
  agent: z.string(),
  step: z.string(),
  detail: z.string(),
});
export type TraceEntry = z.infer<typeof TraceEntrySchema>;

// Final API result. `documents` comes from tool state, never from LLM text.
export const OnboardingResultSchema = z.object({
  onboarding_id: z.string(),
  status: StatusSchema,
  reasons: z.array(z.string()),
  mitigation: MitigationSchema.nullable(),
  documents: z.array(RequiredDocumentSchema),
  customer_message: z.string(),
  trace: z.array(TraceEntrySchema),
});
export type OnboardingResult = z.infer<typeof OnboardingResultSchema>;
