import { createApp } from "./src/app.js";

// Sole Express entry if the leftover Vercel project `graced-flow-server`
// (Root Directory = server/) is ever built. That project is skipped via
// ignoreCommand in vercel.json so it does not fail GitHub CI; the live
// church site is the root `graced-flow` project.
const app = createApp();
export default app;
