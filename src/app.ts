import path from "node:path";
import express, { type Express } from "express";
import { type StartOnboardingOptions, startOnboarding } from "./onboarding/service.js";
import { OnboardingRequestSchema, type ProgressEvent } from "./schemas/index.js";

// Works from both src/ (tsx, vitest) and dist/ (compiled), since both sit next to public/.
const PUBLIC_DIR = path.resolve(import.meta.dirname, "..", "public");

export interface AppOptions {
  /** Lets tests inject a model provider so no request reaches the network. */
  onboarding?: StartOnboardingOptions;
}

export function createApp(options: AppOptions = {}): Express {
  const app = express();

  app.use(express.json());
  app.use(express.static(PUBLIC_DIR));

  app.get("/health", (_req, res) => {
    res.json({ status: "ok" });
  });

  app.post("/api/v1/onboarding/start", async (req, res) => {
    const parsed = OnboardingRequestSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: "invalid_request", issues: parsed.error.issues });
      return;
    }
    res.json(await startOnboarding(parsed.data, options.onboarding));
  });

  // Same validation as /start, but progress is streamed as Server-Sent Events (data: <json>\n\n).
  app.post("/api/v1/onboarding/stream", async (req, res) => {
    const parsed = OnboardingRequestSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: "invalid_request", issues: parsed.error.issues });
      return;
    }
    res.status(200).set({
      "Content-Type": "text/event-stream; charset=utf-8",
      "Cache-Control": "no-cache",
      Connection: "keep-alive",
      "X-Accel-Buffering": "no",
    });
    res.flushHeaders();

    let open = true;
    res.on("close", () => {
      open = false;
    });
    const write = (event: ProgressEvent) => {
      if (open && !res.writableEnded) res.write(`data: ${JSON.stringify(event)}\n\n`);
    };
    try {
      // The result event is emitted by the service and is always the last one.
      await startOnboarding(parsed.data, { ...options.onboarding, onEvent: write });
    } finally {
      if (!res.writableEnded) res.end();
    }
  });

  // Malformed JSON bodies are client errors, not 500s.
  app.use((err: unknown, _req: express.Request, res: express.Response, next: express.NextFunction) => {
    if (err instanceof SyntaxError) {
      res.status(400).json({ error: "invalid_request", issues: [{ message: "Body is not valid JSON" }] });
      return;
    }
    next(err);
  });

  return app;
}
