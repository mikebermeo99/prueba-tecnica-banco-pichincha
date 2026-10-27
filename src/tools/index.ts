import { randomUUID } from "node:crypto";
import { type RunContext, tool } from "@openai/agents";
import { z } from "zod";
import { addTrace, type OnboardingState } from "../context.js";
import {
  DocumentationResultSchema,
  IdentityResultSchema,
  ProductSchema,
  RiskResultSchema,
} from "../schemas/index.js";
import { checkRiskLists, prepareDocumentation, verifyIdentity } from "./mocks.js";

type Ctx = RunContext<OnboardingState> | undefined;

function requireState(ctx: Ctx): OnboardingState {
  if (!ctx) throw new Error("Tool invoked without onboarding context");
  return ctx.context;
}

const normalizeName = (name: string) => name.trim().replace(/\s+/g, " ").toLowerCase();

/**
 * The LLM supplies tool arguments, so it could try to verify someone else. Every
 * identifying argument is compared with the original request; mismatches are
 * returned to the model as an error and traced, and nothing is written to state.
 */
function crossCheck(
  state: OnboardingState,
  toolName: string,
  args: { document_id?: string; name?: string; product?: string },
): { error: string } | null {
  const { request } = state;
  const mismatches: string[] = [];
  if (args.document_id !== undefined && args.document_id !== request.document_id) {
    mismatches.push("document_id");
  }
  if (args.name !== undefined && normalizeName(args.name) !== normalizeName(request.prospect_name)) {
    mismatches.push("name");
  }
  if (args.product !== undefined && args.product !== request.product) {
    mismatches.push("product");
  }
  if (mismatches.length === 0) return null;

  addTrace(state, toolName, "rejected_tool_call", `Arguments do not match request: ${mismatches.join(", ")}`);
  return {
    error: `Rejected: ${mismatches.join(", ")} does not match the onboarding request. Use the values from your instructions.`,
  };
}

export const verifyIdentityTool = tool({
  name: "verify_identity",
  description: "Verify the identity of the prospect from their document_id. Returns verified and confidence (0..1).",
  parameters: z.object({ document_id: z.string() }),
  execute: ({ document_id }, ctx: Ctx) => {
    const state = requireState(ctx);
    const rejection = crossCheck(state, "verify_identity", { document_id });
    if (rejection) return rejection;

    state.identity = IdentityResultSchema.parse(verifyIdentity(document_id));
    addTrace(
      state,
      "identity_agent",
      "verify_identity",
      `verified=${state.identity.verified} confidence=${state.identity.confidence}`,
    );
    return state.identity;
  },
});

export const checkRiskListsTool = tool({
  name: "check_risk_lists",
  description: "Screen the prospect against sanctions, PEP and internal risk lists. Returns risk_level and matches.",
  parameters: z.object({ name: z.string(), document_id: z.string() }),
  execute: ({ name, document_id }, ctx: Ctx) => {
    const state = requireState(ctx);
    const rejection = crossCheck(state, "check_risk_lists", { name, document_id });
    if (rejection) return rejection;

    state.risk = RiskResultSchema.parse(checkRiskLists(name, document_id));
    addTrace(
      state,
      "risk_agent",
      "check_risk_lists",
      `risk_level=${state.risk.risk_level} matches=${state.risk.matches.length}`,
    );
    return state.risk;
  },
});

export const prepareDocumentationTool = tool({
  name: "prepare_documentation",
  description: "Get the required documents and policy notes for the requested product.",
  parameters: z.object({
    product: ProductSchema,
    prospect_name: z.string(),
    document_id: z.string(),
  }),
  execute: ({ product, prospect_name, document_id }, ctx: Ctx) => {
    const state = requireState(ctx);
    const rejection = crossCheck(state, "prepare_documentation", {
      product,
      name: prospect_name,
      document_id,
    });
    if (rejection) return rejection;

    state.documentation = DocumentationResultSchema.parse(
      prepareDocumentation(product, { prospect_name, document_id }),
    );
    addTrace(
      state,
      "documentation_agent",
      "prepare_documentation",
      `${state.documentation.required_documents.length} documents for ${product}`,
    );
    return state.documentation;
  },
});

export const escalateToHumanTool = tool({
  name: "escalate_to_human",
  description: "Open an escalation ticket for manual review by a human analyst. Returns the ticket_id.",
  parameters: z.object({ reason: z.string(), severity: z.enum(["medium", "high"]) }),
  execute: ({ reason, severity }, ctx: Ctx) => {
    const state = requireState(ctx);
    const ticket_id = `ESC-${randomUUID().slice(0, 8).toUpperCase()}`;

    state.escalation = { ticket_id, reason, severity };
    addTrace(state, "orchestrator", "escalate_to_human", `${ticket_id} severity=${severity}: ${reason}`);
    return { ticket_id, severity };
  },
});
