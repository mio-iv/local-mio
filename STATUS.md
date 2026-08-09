# Project Status

## Current Milestone
Milestone 16 — smartphone-capable local review build ready.

## Completed
- Repository inspection and no-conflict module structure.
- Vite/TypeScript/Three.js project metadata.
- Durable memory baseline and formal specification.
- Cozy 18×14 room, furniture, warm lighting, shadows and bounded colliders.
- Original rounded robot ちょぼ with a procedural CanvasTexture face and four animation moods.
- Camera-relative movement, furniture collision, orbit/chase camera and occlusion shortening.
- Reachable glowing collectibles, pickup bursts, counters and clear celebrations.
- Responsive onboarding/HUD with keyboard focus, ARIA, high-contrast and reduced-motion support.
- Multi-agent integration QA and fixes for camera collider height, restart state, focus and UI contrast.
- Renamed the robot and all product-facing references to ちょぼ.
- Three curated stages with 3, 4 and 5 reachable parts and gently increasing route coverage.
- Stage-clear transitions and complete reset to the original title after Stage 3.
- Calm procedural Web Audio BGM with short scheduling and safe start/stop behavior; no audio asset required.
- Title starts only from its explicit button or Enter; arbitrary clicks and Space do not start.
- Random yawn/thinking gestures after 3–5 seconds of continuous idle time, cancelled by movement and non-idle moods.
- Touch-first controls: left virtual joystick plus right camera-turn buttons with pointer capture and deadzones.
- Portrait/landscape layouts, safe-area insets, dynamic viewport height and touch-friendly target sizes.
- Mobile performance profile: DPR 1.25 cap, non-MSAA rendering and 512² PCF shadows on coarse-pointer devices.
- Compact-landscape hint placement and timing to preserve the 3D play view.

## In Progress
- User review on a physical iOS or Android device.

## Next
- Play through all three stages on a phone in portrait and landscape orientation.

## Known Issues
- Vite reports a non-fatal ~542 kB minified chunk warning because Three.js is bundled as the core engine (gzip ~142 kB).
- The Browser control skill reported zero connected browsers, so automated visual/audio interaction QA remains unavailable. Static state-transition review, collision reachability, HTTP and build checks passed.
- Physical-device touch feel and device-specific WebGL performance still require user review.
- Trusted-LAN access is currently disabled. The server is bound to PC-only localhost; `npm run dev:lan` must not be used again without explicit approval.

## Test Status
- `npm install`: passed; 0 vulnerabilities.
- `npm run typecheck`: passed with strict TypeScript.
- Smartphone `npm run build`: passed; 12 modules transformed, gzip JS ~145 kB.
- Local dev route: HTTP 200 at `http://127.0.0.1:5173/`.
- Collision reachability: 0.1-grid review confirms all 12 collectible centers across three stages are reachable.
- Forbidden former-name scan: no product/source/document references remain (package-lock integrity strings excluded as opaque hashes).
- Integrated static QA: start gating, Stage 1→2→3→title state, focus/inert, audio gesture timing and resource disposal reviewed with no P1 findings.
- Mobile static QA: joystick normalization/reset, camera buttons, modal input lock, safe areas, orientation layout and reduced render settings reviewed with no P1 findings.
- Git whitespace check: passed before final memory update.
- Browser runtime discovery: unavailable (0 connected browsers); manual user review remains.

## Local Run Instructions
The dev server is currently running at `http://127.0.0.1:5173/`.

PC-only: `npm run dev`. The optional `npm run dev:lan` command remains available for a future explicitly approved temporary LAN preview.
