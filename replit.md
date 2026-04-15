# Workspace

## Overview

pnpm workspace monorepo using TypeScript. Contains the ALaunchi Minecraft modpack launcher.

## Stack

- **Monorepo tool**: pnpm workspaces
- **Node.js version**: 24
- **Package manager**: pnpm
- **TypeScript version**: 5.9
- **Frontend**: React + Vite (artifacts/alaunchi)
- **Desktop**: Electron (electron/ directory in alaunchi artifact)
- **State management**: Zustand
- **Animations**: Framer Motion
- **API framework**: Express 5 (api-server)
- **Database**: PostgreSQL + Drizzle ORM
- **Validation**: Zod (`zod/v4`), `drizzle-zod`
- **API codegen**: Orval (from OpenAPI spec)
- **Build**: esbuild (CJS bundle)

## ALaunchi — Key Files

- `artifacts/alaunchi/src/pages/` — App screens (login, home, admin, settings)
- `artifacts/alaunchi/src/services/github.ts` — GitHub API integration (modpack data)
- `artifacts/alaunchi/src/services/electron.ts` — Electron IPC bridge (native operations)
- `artifacts/alaunchi/src/hooks/use-auth.ts` — Auth state (Zustand)
- `artifacts/alaunchi/src/hooks/use-modpacks.ts` — Modpack state (Zustand)
- `artifacts/alaunchi/electron/main.js` — Electron main process (Minecraft launcher, file system, MS OAuth)
- `artifacts/alaunchi/electron/preload.js` — Electron preload (IPC bridge)
- `artifacts/alaunchi/electron-builder.yml` — Desktop app packaging config
- `artifacts/alaunchi/ELECTRON_BUILD.md` — Instructions to build as desktop app

## ALaunchi — GitHub repo structure (for modpacks data)

Admin sets GitHub repo URL in Settings. The repo must have:
- `modpacks.json` — list of all modpacks  
- `modpacks/<id>/manifest.json` — per-modpack file manifest
- GitHub Releases — actual mod files (JARs, ZIPs)

## Key Commands

- `pnpm run typecheck` — full typecheck across all packages
- `pnpm run build` — typecheck + build all packages
- `pnpm --filter @workspace/api-spec run codegen` — regenerate API hooks and Zod schemas from OpenAPI spec
- `pnpm --filter @workspace/db run push` — push DB schema changes (dev only)
- `pnpm --filter @workspace/api-server run dev` — run API server locally

See the `pnpm-workspace` skill for workspace structure, TypeScript setup, and package details.
