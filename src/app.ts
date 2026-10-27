import path from "node:path";
import express, { type Express } from "express";

// Works from both src/ (tsx, vitest) and dist/ (compiled), since both sit next to public/.
const PUBLIC_DIR = path.resolve(import.meta.dirname, "..", "public");

export function createApp(): Express {
  const app = express();

  app.use(express.json());
  app.use(express.static(PUBLIC_DIR));

  app.get("/health", (_req, res) => {
    res.json({ status: "ok" });
  });

  return app;
}
