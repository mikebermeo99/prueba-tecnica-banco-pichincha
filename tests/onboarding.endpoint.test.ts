import request from "supertest";
import { describe, expect, it } from "vitest";
import { createApp } from "../src/app.js";
import { ProgressEventSchema } from "../src/schemas/index.js";
import { scriptedProvider } from "./helpers/scenarios.js";

const valid = { prospect_name: "Ana Perez", document_id: "1712345678", product: "cuenta_ahorros" };
const post = (body: unknown, behavior?: Parameters<typeof scriptedProvider>[0]) =>
  request(createApp({ onboarding: { modelProvider: scriptedProvider(behavior).provider } }))
    .post("/api/v1/onboarding/start")
    .send(body as object);

describe("POST /api/v1/onboarding/start", () => {
  it.each([
    ["short document", { ...valid, document_id: "123" }],
    ["unknown product", { ...valid, product: "prestamo" }],
    ["missing name", { document_id: valid.document_id, product: valid.product }],
    ["empty body", {}],
  ])("returns 400 with issues for %s", async (_label, body) => {
    const res = await post(body);

    expect(res.status).toBe(400);
    expect(res.body.issues.length).toBeGreaterThan(0);
  });

  it("returns 400 for a non-JSON body", async () => {
    const res = await request(createApp())
      .post("/api/v1/onboarding/start")
      .set("Content-Type", "application/json")
      .send("not json");

    expect(res.status).toBe(400);
  });

  it("approves a verified low-risk prospect", async () => {
    const res = await post(valid);

    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({ status: "approved", mitigation: null });
    expect(res.body.documents).toHaveLength(2);
    expect(res.body.trace.length).toBeGreaterThan(0);
  });

  it("escalates a doubtful identity", async () => {
    const res = await post({ ...valid, document_id: "1712345670" });

    expect(res.status).toBe(200);
    expect(res.body.status).toBe("escalated");
    expect(res.body.mitigation.proposed_actions.length).toBeGreaterThan(0);
  });

  it("escalates a high-risk name", async () => {
    const res = await post({ ...valid, prospect_name: "Pedro Riesgo" });

    expect(res.body.status).toBe("escalated");
  });

  it("never approves when the LLM claims approval against policy", async () => {
    const res = await post({ ...valid, document_id: "1712345670" }, "always_approves");

    expect(res.status).toBe(200);
    expect(res.body.status).toBe("escalated");
  });
});

describe("POST /api/v1/onboarding/stream", () => {
  const stream = (body: unknown, behavior?: Parameters<typeof scriptedProvider>[0]) =>
    request(createApp({ onboarding: { modelProvider: scriptedProvider(behavior).provider } }))
      .post("/api/v1/onboarding/stream")
      .send(body as object);

  it("returns 400 JSON before streaming for an invalid body", async () => {
    const res = await stream({ ...valid, document_id: "1" });

    expect(res.status).toBe(400);
    expect(res.headers["content-type"]).toMatch(/application\/json/);
    expect(res.body.issues.length).toBeGreaterThan(0);
  });

  it("streams schema-valid SSE frames ending with the result", async () => {
    const res = await stream(valid).buffer(true).parse((r, cb) => {
      let data = "";
      r.setEncoding("utf8");
      r.on("data", (c: string) => (data += c));
      r.on("end", () => cb(null, data));
    });

    expect(res.status).toBe(200);
    expect(res.headers["content-type"]).toMatch(/text\/event-stream/);
    expect(res.headers["cache-control"]).toBe("no-cache");
    expect(res.headers["x-accel-buffering"]).toBe("no");
    const frames = (res.body as string).split("\n\n").filter(Boolean);
    const events = frames.map((f) => {
      expect(f.startsWith("data: ")).toBe(true);
      return ProgressEventSchema.parse(JSON.parse(f.slice(6)));
    });
    expect(events.length).toBeGreaterThan(2);
    const last = events.at(-1);
    expect(last?.type).toBe("result");
    expect(last?.type === "result" && last.result.status).toBe("approved");
    expect(events.filter((e) => e.type === "result")).toHaveLength(1);
  });
});
