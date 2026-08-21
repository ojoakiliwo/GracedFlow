# GracedFlow

A lightweight task flow tracker. It ships as a small full-stack TypeScript app:

- **`server/`** — an Express + TypeScript JSON API (in-memory task store).
- **`client/`** — a Vite + React + TypeScript single-page app.

The project is an npm workspaces monorepo, so a single `npm install` at the root
installs everything.

## Prerequisites

- Node.js `>= 20` (developed against Node 22)
- npm `>= 9`

## Getting started

```bash
npm install        # install all workspaces
npm run dev        # run API (:3001) and client (:5173) together
```

Then open http://localhost:5173. The Vite dev server proxies `/api/*` requests
to the API on port `3001`.

### Run the services individually

```bash
npm run dev:server   # API only, on http://localhost:3001
npm run dev:client   # client only, on http://localhost:5173
```

## Common commands

| Command | Description |
| --- | --- |
| `npm run dev` | Run the API and client together |
| `npm run build` | Type-check + build the server and client |
| `npm test` | Run the server API tests (Vitest) |
| `npm run typecheck` | Type-check both workspaces |

## API

Base URL: `http://localhost:3001`

| Method | Path | Description |
| --- | --- | --- |
| `GET` | `/api/health` | Health check |
| `GET` | `/api/tasks` | List tasks |
| `POST` | `/api/tasks` | Create a task `{ "title": string, "status"? }` |
| `PATCH` | `/api/tasks/:id` | Update status `{ "status": "todo" \| "in_progress" \| "done" }` |
| `DELETE` | `/api/tasks/:id` | Delete a task |

## Cloud Agent environment

`.cursor/environment.json` configures the Cloud Agent dev environment:

- `install`: `npm install`
- `terminals`: runs the `server` and `client` dev servers
- `ports`: exposes `5173` (client) and `3001` (server)
