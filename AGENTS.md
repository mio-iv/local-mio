# AGENTS.md

## Purpose
Build and maintain a small, polished three-stage browser 3D game: the cute tabletop robot ちょぼ explores a cozy room and collects glowing parts.

## Team
- Agent 1: lead, architecture, integration, memory, final QA.
- Agent 2: `src/environment.ts` only; scene environment, furniture, lighting helpers and colliders.
- Agent 3: `src/robot.ts` and `src/gameplay.ts`; robot, controller, camera, collectibles and game loop helpers.
- Agent 4: `src/ui.ts` and `src/style.css`; HUD, onboarding, accessibility, feedback, responsive polish and QA notes.

## Rules
- TypeScript + Three.js + Vite; keep dependencies minimal.
- Generate visuals from Geometry, Canvas, CSS and code only. No binary images, textures, video or external 3D models.
- Do not add network services, backend, auth, persistence, analytics or deployment.
- Do not edit or expose `.env` files.
- Do not commit, push, create PRs or deploy.
- Preserve module ownership during parallel work. Agent 1 integrates in `src/main.ts`.
- Run typecheck/build, then browser-test the playable loop and console.

## Durable memory
At every milestone or material design change update `SPEC.md`, `PLAN.md`, `STATUS.md`, and/or `DECISIONS.md`. A new agent must read these files before continuing.

## Completion
The local game must launch, render the cozy room and original robot ちょぼ, support clear keyboard controls and camera follow, progress through three gently harder stages, return to the title after stage 3, allow all collectibles to be reached, show collection feedback and joyful completion states, play procedural calm BGM after explicit user activation, resize safely, build cleanly, and emit no major console errors.
