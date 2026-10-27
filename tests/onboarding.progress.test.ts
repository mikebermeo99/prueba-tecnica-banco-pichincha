import { describe, expect, it } from "vitest";
import { startOnboarding } from "../src/onboarding/service.js";
import { type ProgressEvent, ProgressEventSchema } from "../src/schemas/index.js";
import { scriptedProvider } from "./helpers/scenarios.js";

const base = { prospect_name: "Ana Perez", document_id: "1712345678", product: "cuenta_ahorros" as const };

async function collect(request: typeof base, behavior?: Parameters<typeof scriptedProvider>[0]) {
  const events: ProgressEvent[] = [];
  const result = await startOnboarding(request, {
    modelProvider: scriptedProvider(behavior).provider,
    onEvent: (e) => events.push(e),
  });
  return { events, result };
}

const key = (e: ProgressEvent) => (e.type === "step" ? `${e.agent}:${e.phase}` : "result");
const indexOf = (events: ProgressEvent[], k: string) => events.map(key).indexOf(k);

describe("startOnboarding progress events", () => {
  it("emits ordered, schema-valid events ending in the result (approved)", async () => {
    const { events, result } = await collect(base);

    for (const e of events) expect(ProgressEventSchema.safeParse(e).success).toBe(true);
    const last = events.at(-1);
    expect(last).toEqual({ type: "result", result });
    expect(events.filter((e) => e.type === "result")).toHaveLength(1);

    const order = [
      "orchestrator:started",
      "identity:started",
      "identity:completed",
      "risk:started",
      "risk:completed",
      "documentation:started",
      "documentation:completed",
      "response:started",
      "response:completed",
      "orchestrator:completed",
      "result",
    ].map((k) => indexOf(events, k)) as number[];
    const before = (a: number, b: number) => expect(order[a] as number).toBeLessThan(order[b] as number);
    expect(order.every((i) => i >= 0)).toBe(true);
    before(0, 1);
    before(1, 2);
    before(5, 6);
    before(2, 5);
    before(8, 10);
    expect(events.some((e) => e.type === "step" && e.agent === "policy" && e.phase === "completed")).toBe(true);
  });

  it("emits the escalation ticket as a step for a doubtful identity", async () => {
    const { events } = await collect({ ...base, document_id: "1712345670" });

    const steps = events.filter((e) => e.type === "step");
    expect(steps.some((e) => /ESC-/.test(e.detail))).toBe(true);
    expect(events.map(key)).not.toContain("documentation:started");
  });

  it("emits policy failure and orchestrator failure on guardrail trip", async () => {
    const { events, result } = await collect({ ...base, document_id: "1712345670" }, "always_approves");

    expect(result.status).toBe("escalated");
    expect(events.map(key)).toContain("policy:failed");
    expect(events.map(key)).toContain("orchestrator:failed");
    expect(events.at(-1)?.type).toBe("result");
  });

  it("does not mix events between concurrent runs", async () => {
    const [a, b] = await Promise.all([
      collect(base),
      collect({ prospect_name: "Pedro Riesgo", document_id: "1712345679", product: "cuenta_ahorros" }),
    ]);

    const text = (evs: ProgressEvent[]) => JSON.stringify(evs.filter((e) => e.type === "step"));
    expect(text(a.events)).not.toContain("1712345679");
    expect(a.events.filter((e) => e.type === "result")).toHaveLength(1);
    expect(b.events.filter((e) => e.type === "result")).toHaveLength(1);
    const ra = a.events.find((e) => e.type === "result");
    const rb = b.events.find((e) => e.type === "result");
    expect(ra?.type === "result" && ra.result.onboarding_id).toBe(a.result.onboarding_id);
    expect(rb?.type === "result" && rb.result.onboarding_id).toBe(b.result.onboarding_id);
    expect(a.result.onboarding_id).not.toBe(b.result.onboarding_id);
  });

  it("keeps working when the listener throws", async () => {
    const result = await startOnboarding(base, {
      modelProvider: scriptedProvider().provider,
      onEvent: () => {
        throw new Error("boom");
      },
    });
    expect(result.status).toBe("approved");
  });
});
