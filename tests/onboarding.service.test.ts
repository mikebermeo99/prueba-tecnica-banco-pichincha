import { describe, expect, it } from "vitest";
import { startOnboarding } from "../src/onboarding/service.js";
import { scriptedProvider } from "./helpers/scenarios.js";

const base = { prospect_name: "Ana Perez", document_id: "1712345678", product: "cuenta_ahorros" as const };

describe("startOnboarding (scripted models, no network)", () => {
  it("approves a verified low-risk prospect with documents from tool state", async () => {
    const { provider } = scriptedProvider();

    const result = await startOnboarding(base, { modelProvider: provider });

    expect(result.status).toBe("approved");
    expect(result.documents.map((d) => d.code)).toEqual(["CEDULA", "UTILITY_BILL"]);
    expect(result.customer_message).toMatch(/Estimado cliente/);
    expect(result.onboarding_id).toMatch(/^[0-9a-f-]{36}$/);
    expect(result.trace.map((t) => t.step)).toEqual(
      expect.arrayContaining(["verify_identity", "check_risk_lists", "prepare_documentation"]),
    );
  });

  it("escalates a doubtful identity (confidence 0.62) with a mitigation and ticket", async () => {
    const { provider } = scriptedProvider();

    const result = await startOnboarding({ ...base, document_id: "1712345670" }, { modelProvider: provider });

    expect(result.status).toBe("escalated");
    expect(result.mitigation?.proposed_actions.length).toBeGreaterThan(0);
    expect(result.documents).toEqual([]);
    expect(result.trace.map((t) => t.step)).toContain("escalate_to_human");
  });

  it("escalates a high-risk prospect", async () => {
    const { provider } = scriptedProvider();

    const result = await startOnboarding(
      { ...base, prospect_name: "Pedro Riesgo" },
      { modelProvider: provider },
    );

    expect(result.status).toBe("escalated");
    expect(result.reasons.join(" ")).toMatch(/risk/i);
  });

  it("rejects a confidently failed identity", async () => {
    const { provider } = scriptedProvider();

    const result = await startOnboarding({ ...base, document_id: "1712345679" }, { modelProvider: provider });

    expect(result.status).toBe("rejected");
  });

  it("overrides an LLM that claims approved when policy disagrees (guardrail tripwire)", async () => {
    const { provider } = scriptedProvider("always_approves");

    const result = await startOnboarding({ ...base, document_id: "1712345670" }, { modelProvider: provider });

    expect(result.status).toBe("escalated");
    expect(result.mitigation).not.toBeNull();
    expect(result.trace.some((t) => t.step === "failure" && /guardrail/i.test(t.detail))).toBe(true);
  });

  it("fails safe to escalated when max turns are exceeded", async () => {
    const { provider } = scriptedProvider("loops");

    const result = await startOnboarding(base, { modelProvider: provider, maxTurns: 2 });

    expect(result.status).toBe("escalated");
    expect(result.customer_message).toMatch(/especialista/i);
  });

  it("fails safe to escalated on model errors", async () => {
    const { provider } = scriptedProvider("throws");

    const result = await startOnboarding(base, { modelProvider: provider });

    expect(result.status).toBe("escalated");
    expect(result.trace.some((t) => t.step === "failure")).toBe(true);
  });
});
