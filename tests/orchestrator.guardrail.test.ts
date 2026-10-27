import { OutputGuardrailTripwireTriggered, Runner } from "@openai/agents";
import { describe, expect, it } from "vitest";
import { orchestratorAgent } from "../src/agents/orchestrator.agent.js";
import type { OnboardingState } from "../src/context.js";
import { scriptedProvider } from "./helpers/scenarios.js";

const stateFor = (document_id: string): OnboardingState => ({
  request: { prospect_name: "Ana Perez", document_id, product: "cuenta_ahorros" },
  trace: [],
});

describe("orchestrator policy guardrail (real Runner, scripted models)", () => {
  it("throws a tripwire when the LLM approves against the tool results", async () => {
    const { provider } = scriptedProvider("always_approves");
    const runner = new Runner({ modelProvider: provider, tracingDisabled: true });
    const state = stateFor("1712345670");

    await expect(runner.run(orchestratorAgent, "go", { context: state })).rejects.toBeInstanceOf(
      OutputGuardrailTripwireTriggered,
    );
    expect(state.identity?.confidence).toBe(0.62);
    expect(state.trace.some((t) => t.step === "tripwire")).toBe(true);
  });

  it("lets a faithful decision through and shares state with nested agent runs", async () => {
    const { provider, orchestrator, subagents } = scriptedProvider("faithful");
    const runner = new Runner({ modelProvider: provider, tracingDisabled: true });
    const state = stateFor("1712345678");

    const result = await runner.run(orchestratorAgent, "go", { context: state });

    expect(result.finalOutput?.status).toBe("approved");
    expect(state.documentation).toBeDefined();
    expect(orchestrator.requests.length).toBeGreaterThan(0);
    expect(subagents.requests.length).toBeGreaterThan(0);
  });

  it("exposes only the escalation tool and the four sub-agents to the orchestrator", () => {
    expect(orchestratorAgent.tools.map((t) => t.name).sort()).toEqual([
      "escalate_to_human",
      "run_customer_response",
      "run_documentation_preparation",
      "run_identity_verification",
      "run_risk_screening",
    ]);
  });
});
