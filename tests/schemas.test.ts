import { describe, expect, it } from "vitest";
import { OnboardingRequestSchema } from "../src/schemas/index.js";

const valid = {
  prospect_name: "Ana Perez",
  document_id: "1712345678",
  product: "cuenta_ahorros",
};

describe("OnboardingRequestSchema", () => {
  it("accepts a valid request and trims the name", () => {
    const parsed = OnboardingRequestSchema.parse({ ...valid, prospect_name: "  Ana Perez  " });

    expect(parsed.prospect_name).toBe("Ana Perez");
  });

  it.each([
    ["short name", { prospect_name: "Al" }],
    ["long name", { prospect_name: "a".repeat(121) }],
    ["short document", { document_id: "171234567" }],
    ["non-numeric document", { document_id: "17123456AB" }],
    ["unknown product", { product: "prestamo" }],
  ])("rejects %s", (_label, override) => {
    expect(OnboardingRequestSchema.safeParse({ ...valid, ...override }).success).toBe(false);
  });
});
