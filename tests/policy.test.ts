import { describe, expect, it } from "vitest";
import type { OnboardingState } from "../src/context.js";
import { checkOrchestratorDecision, evaluatePolicy } from "../src/policy/policy.js";
import type { OrchestratorOutput } from "../src/schemas/index.js";

const request = {
  prospect_name: "Ana Perez",
  document_id: "1712345678",
  product: "cuenta_ahorros" as const,
};

function stateWith(partial: Partial<OnboardingState> = {}): OnboardingState {
  return {
    request,
    identity: { verified: true, confidence: 0.97 },
    risk: { risk_level: "low", matches: [] },
    documentation: {
      product: "cuenta_ahorros",
      required_documents: [{ code: "CEDULA", name: "ID", description: "ID card" }],
      policy_notes: [],
    },
    trace: [],
    ...partial,
  };
}

function output(status: OrchestratorOutput["status"]): OrchestratorOutput {
  return { status, reasons: [], mitigation: null, customer_message: "msg" };
}

describe("evaluatePolicy", () => {
  it("approves a verified low-risk prospect", () => {
    expect(evaluatePolicy(stateWith()).decision).toBe("approved");
  });

  it("escalates when identity is missing", () => {
    const result = evaluatePolicy(stateWith({ identity: undefined }));

    expect(result.decision).toBe("escalated");
    expect(result.reasons.join(" ")).toMatch(/identity/i);
  });

  it("escalates when risk is missing", () => {
    const result = evaluatePolicy(stateWith({ risk: undefined }));

    expect(result.decision).toBe("escalated");
    expect(result.reasons.join(" ")).toMatch(/risk/i);
  });

  it("escalates when identity confidence is below 0.8", () => {
    const result = evaluatePolicy(stateWith({ identity: { verified: true, confidence: 0.62 } }));

    expect(result.decision).toBe("escalated");
  });

  it("approves at the 0.8 confidence boundary", () => {
    const result = evaluatePolicy(stateWith({ identity: { verified: true, confidence: 0.8 } }));

    expect(result.decision).toBe("approved");
  });

  it("escalates low-confidence identity even when verified is false", () => {
    const result = evaluatePolicy(stateWith({ identity: { verified: false, confidence: 0.5 } }));

    expect(result.decision).toBe("escalated");
  });

  it("rejects a confidently failed identity check", () => {
    const result = evaluatePolicy(stateWith({ identity: { verified: false, confidence: 0.95 } }));

    expect(result.decision).toBe("rejected");
  });

  it("escalates high risk", () => {
    const result = evaluatePolicy(
      stateWith({
        risk: {
          risk_level: "high",
          matches: [{ list: "OFAC-SDN-MOCK", matched_name: "Pedro Riesgo", score: 0.9 }],
        },
      }),
    );

    expect(result.decision).toBe("escalated");
  });

  it("prefers escalation over rejection when both apply", () => {
    const result = evaluatePolicy(
      stateWith({
        identity: { verified: false, confidence: 0.95 },
        risk: { risk_level: "high", matches: [] },
      }),
    );

    expect(result.decision).toBe("escalated");
    expect(result.reasons.length).toBeGreaterThanOrEqual(2);
  });

  it("approves medium risk and notes enhanced due diligence", () => {
    const result = evaluatePolicy(
      stateWith({ risk: { risk_level: "medium", matches: [] } }),
    );

    expect(result.decision).toBe("approved");
    expect(result.reasons.join(" ")).toMatch(/enhanced due diligence/i);
  });
});

describe("checkOrchestratorDecision", () => {
  it("accepts approved when policy approves and documentation exists", () => {
    expect(checkOrchestratorDecision(stateWith(), output("approved")).tripwire).toBe(false);
  });

  it("trips when approved but policy escalates", () => {
    const state = stateWith({ identity: { verified: true, confidence: 0.62 } });
    const result = checkOrchestratorDecision(state, output("approved"));

    expect(result.tripwire).toBe(true);
    expect(result.reasons.length).toBeGreaterThan(0);
  });

  it("trips when approved but policy rejects", () => {
    const state = stateWith({ identity: { verified: false, confidence: 0.95 } });

    expect(checkOrchestratorDecision(state, output("approved")).tripwire).toBe(true);
  });

  it("trips when approved without documentation in state", () => {
    const state = stateWith({ documentation: undefined });

    expect(checkOrchestratorDecision(state, output("approved")).tripwire).toBe(true);
  });

  it("allows a conservative escalation when policy approves", () => {
    expect(checkOrchestratorDecision(stateWith(), output("escalated")).tripwire).toBe(false);
  });

  it("trips on a rejection the policy does not support", () => {
    expect(checkOrchestratorDecision(stateWith(), output("rejected")).tripwire).toBe(true);
  });

  it("trips when the model rejects but policy only requires escalation", () => {
    const state = stateWith({ identity: { verified: true, confidence: 0.62 } });

    expect(checkOrchestratorDecision(state, output("rejected")).tripwire).toBe(true);
  });

  it("allows escalation when policy rejects", () => {
    const state = stateWith({ identity: { verified: false, confidence: 0.95 } });

    expect(checkOrchestratorDecision(state, output("escalated")).tripwire).toBe(false);
  });

  it("accepts a matching escalation", () => {
    const state = stateWith({ risk: { risk_level: "high", matches: [] } });

    expect(checkOrchestratorDecision(state, output("escalated")).tripwire).toBe(false);
  });
});
