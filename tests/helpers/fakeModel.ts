import type { AgentOutputItem, Model, ModelProvider, ModelRequest, ModelResponse } from "@openai/agents";
import { Usage } from "@openai/agents";

export type Handler = (request: ModelRequest) => AgentOutputItem[] | Promise<AgentOutputItem[]>;

/** Scripted model: no network. The handler sees the full request and decides the next output items. */
export class FakeModel implements Model {
  readonly requests: ModelRequest[] = [];

  constructor(private readonly handler: Handler) {}

  async getResponse(request: ModelRequest): Promise<ModelResponse> {
    this.requests.push(request);
    return { usage: new Usage(), output: await this.handler(request) };
  }

  getStreamedResponse(): never {
    throw new Error("FakeModel does not support streaming");
  }
}

/** Routes by model name, so the orchestrator and sub-agents can be scripted independently. */
export class FakeModelProvider implements ModelProvider {
  constructor(private readonly models: Record<string, Model>) {}

  getModel(name?: string): Model {
    const model = name ? this.models[name] : undefined;
    if (!model) throw new Error(`FakeModelProvider: no model for "${name}"`);
    return model;
  }
}

export function toolCall(name: string, args: object, callId = `call_${name}`): AgentOutputItem {
  return {
    type: "function_call",
    callId,
    name,
    arguments: JSON.stringify(args),
    status: "completed",
  };
}

export function say(text: string): AgentOutputItem {
  return {
    type: "message",
    role: "assistant",
    status: "completed",
    content: [{ type: "output_text", text }],
  };
}

export function sayJson(value: object): AgentOutputItem {
  return say(JSON.stringify(value));
}

/** Outputs of tool calls already executed in this run, by tool name. */
export function toolResults(request: ModelRequest): Record<string, unknown> {
  const items = Array.isArray(request.input) ? request.input : [];
  const names = new Map<string, string>();
  for (const item of items) {
    if (item.type === "function_call") names.set(item.callId, item.name);
  }
  const results: Record<string, unknown> = {};
  for (const item of items) {
    if (item.type !== "function_call_result") continue;
    const raw = typeof item.output === "string" ? item.output : (item.output as { text?: string }).text;
    const name = names.get(item.callId) ?? item.name;
    try {
      results[name] = JSON.parse(raw ?? "");
    } catch {
      results[name] = raw;
    }
  }
  return results;
}
