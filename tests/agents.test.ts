import { RunContext, Runner } from "@openai/agents";
import { describe, expect, it } from "vitest";
import { documentationAgent } from "../src/agents/documentation.agent.js";
import { identityAgent } from "../src/agents/identity.agent.js";
import { responseAgent } from "../src/agents/response.agent.js";
import { riskAgent } from "../src/agents/risk.agent.js";
import type { OnboardingState } from "../src/context.js";
import { FakeModel, FakeModelProvider, sayJson, toolCall, toolResults } from "./helpers/fakeModel.js";

const state = (): OnboardingState => ({
  request: { prospect_name: "Ana Perez", document_id: "1712345678", product: "cuenta_ahorros" },
  trace: [],
});

describe("sub-agent tool allowlists", () => {
  it.each([
    [identityAgent, ["verify_identity"]],
    [riskAgent, ["check_risk_lists"]],
    [documentationAgent, ["prepare_documentation"]],
    [responseAgent, []],
  ])("%s exposes only its own tools", (agent, expected) => {
    expect(agent.tools.map((t) => t.name)).toEqual(expected);
  });
});

describe("dynamic instructions", () => {
  it("inject request references from the run context", async () => {
    const ctx = new RunContext(state());

    expect(await identityAgent.getSystemPrompt(ctx)).toContain("1712345678");
    expect(await riskAgent.getSystemPrompt(ctx)).toContain("Ana Perez");
    expect(await documentationAgent.getSystemPrompt(ctx)).toContain("cuenta_ahorros");
  });

  it("response agent embeds collected state and requires Spanish", async () => {
    const s = state();
    s.escalation = { ticket_id: "ESC-ABC12345", reason: "r", severity: "high" };
    s.documentation = {
      product: "cuenta_ahorros",
      required_documents: [{ code: "CEDULA", name: "National ID", description: "Copy of ID" }],
      policy_notes: [],
    };

    const prompt = await responseAgent.getSystemPrompt(new RunContext(s));

    expect(prompt).toContain("Spanish");
    expect(prompt).toContain("ESC-ABC12345");
    expect(prompt).toContain("National ID");
  });
});

describe("identity agent run with a scripted model", () => {
  it("calls its tool, writes state and returns the typed output", async () => {
    const s = state();
    const model = new FakeModel((req) => {
      const results = toolResults(req);
      if (!("verify_identity" in results)) {
        return [toolCall("verify_identity", { document_id: "1712345678" })];
      }
      return [sayJson({ verified: true, confidence: 0.97, requires_escalation: false, summary: "ok" })];
    });
    const runner = new Runner({
      modelProvider: new FakeModelProvider({ [identityAgent.model as string]: model }),
      tracingDisabled: true,
    });

    const result = await runner.run(identityAgent, "verify", { context: s });

    expect(result.finalOutput).toMatchObject({ verified: true, requires_escalation: false });
    expect(s.identity).toEqual({ verified: true, confidence: 0.97 });
  });
});
