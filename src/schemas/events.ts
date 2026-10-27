import { z } from "zod";
import { OnboardingResultSchema } from "./orchestrator.js";

// Real-time progress events streamed to the UI (SSE). One discriminated union on `type`.

export const ProgressAgentSchema = z.enum([
  "orchestrator",
  "identity",
  "risk",
  "documentation",
  "response",
  "policy",
]);
export type ProgressAgent = z.infer<typeof ProgressAgentSchema>;

export const ProgressPhaseSchema = z.enum(["started", "progress", "completed", "failed"]);
export type ProgressPhase = z.infer<typeof ProgressPhaseSchema>;

export const StepEventSchema = z.object({
  type: z.literal("step"),
  at: z.string(),
  agent: ProgressAgentSchema,
  phase: ProgressPhaseSchema,
  detail: z.string(),
});
export type StepEvent = z.infer<typeof StepEventSchema>;

export const ResultEventSchema = z.object({
  type: z.literal("result"),
  result: OnboardingResultSchema,
});
export type ResultEvent = z.infer<typeof ResultEventSchema>;

export const ProgressEventSchema = z.discriminatedUnion("type", [StepEventSchema, ResultEventSchema]);
export type ProgressEvent = z.infer<typeof ProgressEventSchema>;
