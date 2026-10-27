import type {
  DocumentationResult,
  IdentityResult,
  Product,
  RequiredDocument,
  RiskResult,
} from "../schemas/index.js";

// Deterministic stand-ins for the bank's backend services; the last digit drives the scenario.

export function verifyIdentity(documentId: string): IdentityResult {
  if (documentId.endsWith("0")) return { verified: true, confidence: 0.62 };
  if (documentId.endsWith("9")) return { verified: false, confidence: 0.95 };
  return { verified: true, confidence: 0.97 };
}

export function checkRiskLists(name: string, documentId: string): RiskResult {
  if (/riesgo/i.test(name)) {
    return {
      risk_level: "high",
      matches: [{ list: "OFAC-SDN-MOCK", matched_name: name, score: 0.92 }],
    };
  }
  if (documentId.endsWith("5")) {
    return {
      risk_level: "medium",
      matches: [{ list: "PEP-MOCK", matched_name: name, score: 0.35 }],
    };
  }
  return { risk_level: "low", matches: [] };
}

const CEDULA: RequiredDocument = {
  code: "CEDULA",
  name: "National ID (cédula)",
  description: "Valid copy of the national ID card, both sides.",
};
const UTILITY_BILL: RequiredDocument = {
  code: "UTILITY_BILL",
  name: "Utility bill",
  description: "Water, electricity or phone bill from the last 3 months.",
};
const INCOME_PROOF: RequiredDocument = {
  code: "INCOME_PROOF",
  name: "Proof of income",
  description: "Last 3 payslips or tax return.",
};
const REFERENCES: RequiredDocument = {
  code: "REFERENCES",
  name: "Commercial references",
  description: "Two commercial or bank references.",
};
const CREDIT_BUREAU_AUTH: RequiredDocument = {
  code: "CREDIT_BUREAU_AUTH",
  name: "Credit bureau authorization",
  description: "Signed authorization to query the credit bureau.",
};

const CATALOG: Record<Product, { documents: RequiredDocument[]; notes: string[] }> = {
  cuenta_ahorros: {
    documents: [CEDULA, UTILITY_BILL],
    notes: ["Minimum opening deposit applies."],
  },
  cuenta_corriente: {
    documents: [CEDULA, UTILITY_BILL, INCOME_PROOF, REFERENCES],
    notes: ["Checkbook issuance requires a clean banking history."],
  },
  tarjeta_credito: {
    documents: [CEDULA, UTILITY_BILL, INCOME_PROOF, CREDIT_BUREAU_AUTH],
    notes: ["Credit limit is subject to credit bureau results."],
  },
};

export function prepareDocumentation(
  product: Product,
  _clientData: { prospect_name: string; document_id: string },
): DocumentationResult {
  const entry = CATALOG[product];
  return {
    product,
    required_documents: entry.documents,
    policy_notes: entry.notes,
  };
}
