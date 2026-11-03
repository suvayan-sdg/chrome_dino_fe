# Dino Race — Chrome-Dino-style 4-player PvP racing game (client)

React + Vite + TypeScript. Static app deployed to GitHub Pages.
Socket.IO connects to the Render server (configured via `VITE_SERVER_URL`).

## Sync note (two-repo setup)

The obstacle-generation logic that must match the server is duplicated here from
the server repo under `src/shared/`. Keep these in sync when tuning constants or
obstacle layout:

- `src/shared/constants.ts`
- `src/shared/obstacles.ts`

(The server repo has its own copy of the same two files.)

## Local setup

1. `cd client`
2. `npm install`
3. Create a local `.env` file (not committed):

   ```
   VITE_SERVER_URL=http://localhost:4000
   ```

4. `npm run dev`

   Client opens at http://localhost:5173 and connects to the server at `VITE_SERVER_URL`.

## Build

`npm run build` → `dist/`.

## Preview the built app locally (before pushing to GitHub Pages)

If you just want to open the built static app yourself:

1. `cd client`
2. `npm run build`
3. Serve the `dist` folder however you like, for example:

   - Python: `python3 -m http.server 9876 --bind 127.0.0.1 -d dist`
   - Node: `npx serve dist -l 9876`
   - Or any static file server that serves `dist/index.html`.

4. Open http://127.0.0.1:9876.

Important: the preview is static. It still tries to connect to the server at
`VITE_SERVER_URL`. For a local preview to do anything useful, the server must be
running locally and reachable at that origin (default `http://localhost:4000`).

If you want to preview with the real Render server instead, rebuild with
`VITE_SERVER_URL` set to the Render origin (see env section) before serving `dist/`.

## Deploy (GitHub Pages)

Two common options:

### Option A — gh-pages package (recommended for this repo)
1. Create a repo (e.g. `chrome_dino_fe`) and push the source.
2. Set `VITE_SERVER_URL` at build time (see env section). For GitHub Pages you can
   pass it via an `.env` file that is NOT committed, or via a build-step that writes
   it from a GitHub Actions secret.
3. `npm run build`
4. `npx gh-pages -d dist` — pushes `dist` to the `gh-pages` branch.

Then enable GitHub Pages to serve the `gh-pages` branch in repo Settings → Pages.

### Option B — GitHub Pages "Deploy from branch"
1. Keep `dist` out of the repo. Add a build step (GitHub Actions or CI) that runs
   `npm run build` and deploys the `dist` folder to a branch such as `gh-pages`.
2. Point GitHub Pages at that branch.

Socket.IO from the static page reaches the Render server over WebSocket; CORS must
allow the GitHub Pages origin (see server README / `.env.example` `CLIENT_ORIGIN`).

## Env

Only build-time env is needed:

- `VITE_SERVER_URL` — Render server origin (e.g. `https://chrome-dino-be.onrender.com`).
  For local dev use `http://localhost:4000`. This is NOT committed; set it locally or
  via CI secret.

Gameplay tuning constants live in `src/shared/constants.ts`, duplicated from the
server copy — not in env.
