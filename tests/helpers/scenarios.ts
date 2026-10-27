import type { ModelRequest } from "@openai/agents";
import { config } from "../../src/config.js";
import { FakeModel, FakeModelProvider, say, sayJson, toolCall, toolResults, userText } from "./fakeModel.js";

/** Sub-agent model: mimics a well-behaved LLM that calls its single tool, then reports it. */
function subagentHandler(request: ModelRequest) {
  const instructions = request.systemInstructions ?? "";
  const toolNames = request.tools.map((t) => t.name);
  const results = toolResults(request);
  const doc = /(\d{10})/.exec(instructions)?.[1] ?? "";

  if (toolNames.includes("verify_identity")) {
    const r = results.verify_identity as { verified: boolean; confidence: number } | undefined;
    if (!r) return [toolCall("verify_identity", { document_id: doc })];
    return [sayJson({ ...r, requires_escalation: r.confidence < 0.8, summary: "identity checked" })];
  }
  if (toolNames.includes("check_risk_lists")) {
    const name = /screen the prospect "(.+?)" with/i.exec(instructions)?.[1] ?? "";
    const r = results.check_risk_lists as { risk_level: string; matches: unknown[] } | undefined;
    if (!r) return [toolCall("check_risk_lists", { name, document_id: doc })];
    return [sayJson({ ...r, requires_escalation: r.risk_level === "high", summary: "risk checked" })];
  }
  if (toolNames.includes("prepare_documentation")) {
    const product = /product "(\w+)"/.exec(instructions)?.[1] ?? "";
    const name = /Prospect: "(.+?)"/.exec(instructions)?.[1] ?? "";
    const r = results.prepare_documentation as { required_documents: unknown[] } | undefined;
    if (!r) return [toolCall("prepare_documentation", { product, prospect_name: name, document_id: doc })];
    return [sayJson({ required_documents: r.required_documents, summary: "documents prepared" })];
  }
  // Response agent: no tools. It echoes the status it was handed, in Spanish.
  const status = /"status":\s*"(\w+)"/.exec(userText(request))?.[1] ?? "unknown";
  return [sayJson({ customer_message: `Estimado cliente, el estado de su solicitud es: ${status}.` })];
}

export type OrchestratorBehavior = "faithful" | "always_approves" | "loops" | "throws";

const TOOL = {
  identity: "run_identity_verification",
  risk: "run_risk_screening",
  docs: "run_documentation_preparation",
  response: "run_customer_response",
  escalate: "escalate_to_human",
} as const;

function orchestratorHandler(behavior: OrchestratorBehavior) {
  return (request: ModelRequest) => {
    if (behavior === "throws") throw new Error("simulated network failure");
    if (behavior === "loops") return [toolCall(TOOL.identity, { input: "again" }, `call_${Math.random()}`)];

    const r = toolResults(request);
    const json = (k: string) => r[k] as Record<string, unknown> | undefined;

    if (!(TOOL.identity in r) || !(TOOL.risk in r)) {
      return [
        toolCall(TOOL.identity, { input: "verify the prospect" }),
        toolCall(TOOL.risk, { input: "screen the prospect" }),
      ];
    }

    const identity = json(TOOL.identity) as { verified: boolean; confidence: number };
    const risk = json(TOOL.risk) as { risk_level: string };
    const blocked = identity.confidence < 0.8 || !identity.verified || risk.risk_level === "high";
    const lies = behavior === "always_approves";

    let status: "approved" | "rejected" | "escalated" = "approved";
    let mitigation: { issue: string; proposed_actions: string[] } | null = null;
    if (blocked && !lies) {
      status = identity.verified === false && identity.confidence >= 0.8 ? "rejected" : "escalated";
      if (risk.risk_level === "high") status = "escalated";
      if (status === "escalated") {
        mitigation = {
          issue: "Verification could not be completed automatically",
          proposed_actions: ["Biometric re-verification", "In-branch visit", "Compliance manual review"],
        };
        if (!(TOOL.escalate in r)) {
          return [toolCall(TOOL.escalate, { reason: mitigation.issue, severity: "high" })];
        }
      }
    }

    if (status === "approved" && !(TOOL.docs in r)) {
      return [toolCall(TOOL.docs, { input: "prepare documentation" })];
    }
    if (!(TOOL.response in r)) {
      return [toolCall(TOOL.response, { status, reasons: ["decision"], mitigation })];
    }
    const message = (r[TOOL.response] as { customer_message: string }).customer_message;
    return [sayJson({ status, reasons: ["decision by orchestrator"], mitigation, customer_message: message })];
  };
}

export function scriptedProvider(behavior: OrchestratorBehavior = "faithful") {
  const orchestrator = new FakeModel(orchestratorHandler(behavior));
  const subagents = new FakeModel(subagentHandler);
  const provider = new FakeModelProvider({
    [config.orchestratorModel]: orchestrator,
    [config.subagentModel]: subagents,
  });
  return { provider, orchestrator, subagents };
}

export { say };
