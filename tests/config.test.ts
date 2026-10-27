import { describe, expect, it } from "vitest";
import { loadConfig } from "../src/config.js";

describe("loadConfig", () => {
  it("defaults to a large orchestrator model and a small sub-agent model", () => {
    const config = loadConfig({});

    expect(config.orchestratorModel).toBe("gpt-6.1-terra");
    expect(config.subagentModel).toBe("gpt-6-luna");
  });

  it("lets env vars override the models", () => {
    const config = loadConfig({ ORCHESTRATOR_MODEL: "big", SUBAGENT_MODEL: "small" });

    expect(config.orchestratorModel).toBe("big");
    expect(config.subagentModel).toBe("small");
  });
});
