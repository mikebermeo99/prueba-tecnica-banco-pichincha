import { afterEach, describe, expect, it, vi } from "vitest";
import { startOnboarding } from "../src/onboarding/service.js";
import { FakeModel, FakeModelProvider } from "./helpers/fakeModel.js";

const base = { prospect_name: "Ana Perez", document_id: "1712345678", product: "cuenta_ahorros" as const };

describe("startOnboarding failure logging", () => {
  afterEach(() => vi.restoreAllMocks());

  it("logs the provider error message server-side but keeps it out of the response", async () => {
    const errorLog = vi.spyOn(console, "error").mockImplementation(() => {});
    const failing = new FakeModel(() => {
      throw new Error("The model `gpt-x` does not exist");
    });
    const provider = new FakeModelProvider(new Proxy({}, { get: () => failing }));

    const result = await startOnboarding(base, { modelProvider: provider });

    expect(result.status).toBe("escalated");
    expect(errorLog).toHaveBeenCalledWith(expect.stringContaining("The model `gpt-x` does not exist"));
    expect(JSON.stringify(result)).not.toContain("does not exist");
  });
});
