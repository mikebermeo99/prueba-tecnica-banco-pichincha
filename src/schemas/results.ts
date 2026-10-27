import { z } from "zod";
import { ProductSchema } from "./request.js";

// Tool results. Optional fields are avoided: OpenAI strict schemas want `.nullable()`.

export const IdentityResultSchema = z.object({
  verified: z.boolean(),
  confidence: z.number().min(0).max(1),
});
export type IdentityResult = z.infer<typeof IdentityResultSchema>;

export const RiskLevelSchema = z.enum(["low", "medium", "high"]);
export type RiskLevel = z.infer<typeof RiskLevelSchema>;

export const RiskMatchSchema = z.object({
  list: z.string(),
  matched_name: z.string(),
  score: z.number().min(0).max(1),
});
export type RiskMatch = z.infer<typeof RiskMatchSchema>;

export const RiskResultSchema = z.object({
  risk_level: RiskLevelSchema,
  matches: z.array(RiskMatchSchema),
});
export type RiskResult = z.infer<typeof RiskResultSchema>;

export const RequiredDocumentSchema = z.object({
  code: z.string(),
  name: z.string(),
  description: z.string(),
});
export type RequiredDocument = z.infer<typeof RequiredDocumentSchema>;

export const DocumentationResultSchema = z.object({
  product: ProductSchema,
  required_documents: z.array(RequiredDocumentSchema),
  policy_notes: z.array(z.string()),
});
export type DocumentationResult = z.infer<typeof DocumentationResultSchema>;
