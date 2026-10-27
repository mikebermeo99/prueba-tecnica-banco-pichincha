export interface AppConfig {
  orchestratorModel: string;
  subagentModel: string;
  maxTurns: number;
  /** Trace export sends names and document IDs to OpenAI, so it is opt-in. */
  tracingEnabled: boolean;
}

export function loadConfig(env: NodeJS.ProcessEnv = process.env): AppConfig {
  const maxTurns = Number(env.MAX_TURNS);

  return {
    orchestratorModel: env.ORCHESTRATOR_MODEL || "gpt-6.1-terra",
    subagentModel: env.SUBAGENT_MODEL || "gpt-6-luna",
    maxTurns: Number.isInteger(maxTurns) && maxTurns > 0 ? maxTurns : 12,
    tracingEnabled: env.OPENAI_AGENTS_TRACING === "1",
  };
}

export const config = loadConfig();
