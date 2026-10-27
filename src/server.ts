import { createApp } from "./app.js";

// Azure App Service injects PORT; fall back for local development.
const port = Number(process.env.PORT ?? 3000);

createApp().listen(port, () => {
  console.log(`onboarding-agent listening on http://localhost:${port}`);
});
