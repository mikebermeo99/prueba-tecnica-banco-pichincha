import type { Agent, RunContext } from "@openai/agents";
import { documentationAgent } from "../agents/documentation.agent.js";
import { identityAgent } from "../agents/identity.agent.js";
import { orchestratorAgent } from "../agents/orchestrator.agent.js";
import { responseAgent } from "../agents/response.agent.js";
import { riskAgent } from "../agents/risk.agent.js";
import { emitStep, type OnboardingState } from "../context.js";

const LABELS: Array<[Agent<OnboardingState, any>, string, string, string]> = [
  [orchestratorAgent, "orchestrator", "Orchestrator started coordinating the case", "Orchestrator finished"],
  [identityAgent, "identity_agent", "Identity verification started", "Identity verification finished"],
  [riskAgent, "risk_agent", "Risk list screening started", "Risk list screening finished"],
  [documentationAgent, "documentation_agent", "Documentation preparation started", "Documentation preparation finished"],
  [responseAgent, "response_agent", "Customer response started", "Customer response finished"],
];

let attached = false;

/**
 * Agents are module singletons (also when nested via `asTool`), but the SDK passes the
 * per-run RunContext to their lifecycle events. We dispatch through `context.emit`, so
 * nothing about a run is ever stored on the shared agent instances.
 */
export function attachProgressHooks(): void {
  if (attached) return;
  attached = true;
  for (const [agent, name, started, completed] of LABELS) {
    agent.on("agent_start", (ctx: RunContext<OnboardingState>) => emitStep(ctx.context, name, "started", started));
    agent.on("agent_end", (ctx: RunContext<OnboardingState>) => emitStep(ctx.context, name, "completed", completed));
  }
}
