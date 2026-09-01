import { createApp } from "./src/app.js";

// Sole Express entry for the leftover Vercel project `graced-flow-server`
// (Root Directory = server/). Vercel also treats src/app.ts and src/index.ts
// as entries when they default-export an app or call app.listen — keep those
// files free of both so this project deploys as one function.
const app = createApp();
export default app;
