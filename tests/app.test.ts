import request from "supertest";
import { describe, expect, it } from "vitest";
import { createApp } from "../src/app.js";

describe("app", () => {
  it("responds to the health check", async () => {
    const res = await request(createApp()).get("/health");

    expect(res.status).toBe(200);
    expect(res.body).toEqual({ status: "ok" });
  });

  it("serves the static front end", async () => {
    const res = await request(createApp()).get("/");

    expect(res.status).toBe(200);
    expect(res.headers["content-type"]).toMatch(/text\/html/);
  });
});

describe("front end", () => {
  it("serves the onboarding form wired to the stream endpoint", async () => {
    const res = await request(createApp()).get("/");

    expect(res.text).toContain("/api/v1/onboarding/stream");
    for (const agent of ["Orquestador", "Verificación de identidad", "Listas de riesgo"]) {
      expect(res.text).toContain(agent);
    }
    for (const field of ["prospect_name", "document_id", "product"]) {
      expect(res.text).toContain(`name="${field}"`);
    }
    for (const product of ["cuenta_ahorros", "cuenta_corriente", "tarjeta_credito"]) {
      expect(res.text).toContain(`value="${product}"`);
    }
  });
});
