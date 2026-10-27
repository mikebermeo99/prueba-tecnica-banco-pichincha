import { describe, expect, it } from "vitest";
import {
  checkRiskLists,
  prepareDocumentation,
  verifyIdentity,
} from "../src/tools/mocks.js";

describe("verifyIdentity", () => {
  it("returns low confidence for documents ending in 0", () => {
    expect(verifyIdentity("1712345670")).toEqual({ verified: true, confidence: 0.62 });
  });

  it("rejects with high confidence for documents ending in 9", () => {
    expect(verifyIdentity("1712345679")).toEqual({ verified: false, confidence: 0.95 });
  });

  it("verifies with high confidence otherwise", () => {
    expect(verifyIdentity("1712345678")).toEqual({ verified: true, confidence: 0.97 });
  });

  it("is deterministic", () => {
    expect(verifyIdentity("1712345671")).toEqual(verifyIdentity("1712345671"));
  });
});

describe("checkRiskLists", () => {
  it("flags names containing 'riesgo' (case-insensitive) as high risk", () => {
    const result = checkRiskLists("Pedro RIESGO Lopez", "1712345678");

    expect(result.risk_level).toBe("high");
    expect(result.matches).toHaveLength(1);
    expect(result.matches[0]).toMatchObject({ list: "OFAC-SDN-MOCK" });
  });

  it("flags documents ending in 5 as medium risk with a low-score PEP match", () => {
    const result = checkRiskLists("Ana Perez", "1712345675");

    expect(result.risk_level).toBe("medium");
    expect(result.matches).toHaveLength(1);
    expect(result.matches[0]?.score).toBeLessThan(0.5);
  });

  it("returns low risk without matches otherwise", () => {
    expect(checkRiskLists("Ana Perez", "1712345678")).toEqual({
      risk_level: "low",
      matches: [],
    });
  });

  it("gives name matches precedence over document matches", () => {
    expect(checkRiskLists("Riesgo", "1712345675").risk_level).toBe("high");
  });
});

describe("prepareDocumentation", () => {
  const client = { prospect_name: "Ana Perez", document_id: "1712345678" };
  const codes = (product: Parameters<typeof prepareDocumentation>[0]) =>
    prepareDocumentation(product, client).required_documents.map((d) => d.code);

  it("requires ID and utility bill for savings", () => {
    expect(codes("cuenta_ahorros")).toEqual(["CEDULA", "UTILITY_BILL"]);
  });

  it("adds income proof and references for checking", () => {
    expect(codes("cuenta_corriente")).toEqual([
      "CEDULA",
      "UTILITY_BILL",
      "INCOME_PROOF",
      "REFERENCES",
    ]);
  });

  it("adds income proof and credit bureau authorization for credit cards", () => {
    expect(codes("tarjeta_credito")).toEqual([
      "CEDULA",
      "UTILITY_BILL",
      "INCOME_PROOF",
      "CREDIT_BUREAU_AUTH",
    ]);
  });

  it("echoes the product and includes policy notes", () => {
    const result = prepareDocumentation("tarjeta_credito", client);

    expect(result.product).toBe("tarjeta_credito");
    expect(result.policy_notes.length).toBeGreaterThan(0);
  });
});
