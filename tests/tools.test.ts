import { RunContext } from "@openai/agents";
import { describe, expect, it } from "vitest";
import type { OnboardingState } from "../src/context.js";
import {
  checkRiskListsTool,
  escalateToHumanTool,
  prepareDocumentationTool,
  verifyIdentityTool,
} from "../src/tools/index.js";

function newContext(overrides: Partial<OnboardingState["request"]> = {}) {
  const state: OnboardingState = {
    request: {
      prospect_name: "Ana Perez",
      document_id: "1712345678",
      product: "cuenta_ahorros",
      ...overrides,
    },
    trace: [],
  };
  return { state, ctx: new RunContext<OnboardingState>(state) };
}

const call = async (
  t: { invoke: (c: RunContext<OnboardingState>, input: string) => Promise<unknown> },
  ctx: RunContext<OnboardingState>,
  args: object,
) => {
  const out = await t.invoke(ctx, JSON.stringify(args));
  return typeof out === "string" ? JSON.parse(out) : out;
};

describe("verify_identity", () => {
  it("writes the validated result and a trace entry to state", async () => {
    const { state, ctx } = newContext();

    const out = await call(verifyIdentityTool, ctx, { document_id: "1712345678" });

    expect(out).toEqual({ verified: true, confidence: 0.97 });
    expect(state.identity).toEqual({ verified: true, confidence: 0.97 });
    expect(state.trace.map((t) => t.step)).toContain("verify_identity");
  });

  it("rejects a document_id that differs from the request and does not touch state", async () => {
    const { state, ctx } = newContext();

    const out = await call(verifyIdentityTool, ctx, { document_id: "0987654321" });

    expect(out).toMatchObject({ error: expect.stringMatching(/does not match/i) });
    expect(state.identity).toBeUndefined();
    expect(state.trace.at(-1)?.step).toBe("rejected_tool_call");
  });
});

describe("check_risk_lists", () => {
  it("writes risk result to state", async () => {
    const { state, ctx } = newContext({ prospect_name: "Pedro Riesgo" });

    await call(checkRiskListsTool, ctx, { name: "Pedro Riesgo", document_id: "1712345678" });

    expect(state.risk?.risk_level).toBe("high");
  });

  it("tolerates case and whitespace differences in the name", async () => {
    const { state, ctx } = newContext();

    await call(checkRiskListsTool, ctx, { name: "  ana   PEREZ ", document_id: "1712345678" });

    expect(state.risk?.risk_level).toBe("low");
  });

  it("rejects a different name (cannot screen someone else to get a cleaner result)", async () => {
    const { state, ctx } = newContext({ prospect_name: "Pedro Riesgo" });

    const out = await call(checkRiskListsTool, ctx, { name: "Ana Perez", document_id: "1712345678" });

    expect(out).toMatchObject({ error: expect.any(String) });
    expect(state.risk).toBeUndefined();
  });
});

describe("prepare_documentation", () => {
  it("writes documentation to state", async () => {
    const { state, ctx } = newContext();

    await call(prepareDocumentationTool, ctx, {
      product: "cuenta_ahorros",
      prospect_name: "Ana Perez",
      document_id: "1712345678",
    });

    expect(state.documentation?.required_documents.map((d) => d.code)).toEqual([
      "CEDULA",
      "UTILITY_BILL",
    ]);
  });

  it("rejects a product that differs from the request", async () => {
    const { state, ctx } = newContext();

    const out = await call(prepareDocumentationTool, ctx, {
      product: "tarjeta_credito",
      prospect_name: "Ana Perez",
      document_id: "1712345678",
    });

    expect(out).toMatchObject({ error: expect.any(String) });
    expect(state.documentation).toBeUndefined();
  });
});

describe("escalate_to_human", () => {
  it("creates an ESC- ticket in state", async () => {
    const { state, ctx } = newContext();

    const out = await call(escalateToHumanTool, ctx, {
      reason: "Low identity confidence",
      severity: "medium",
    });

    expect(out.ticket_id).toMatch(/^ESC-[A-Z0-9]{6,}$/);
    expect(state.escalation).toEqual({
      ticket_id: out.ticket_id,
      reason: "Low identity confidence",
      severity: "medium",
    });
  });
});
