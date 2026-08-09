# Design Decisions

## Architecture
**Decision:** Framework-free Vite TypeScript with separate environment, robot/gameplay, UI and integration modules.  
**Reason:** Matches the requested stack and prevents multi-agent file conflicts.  
**Trade-off:** Agent 1 must explicitly wire module APIs.

## Assets
**Decision:** All visuals use Three.js geometry, procedural canvas drawing, particles and CSS.  
**Reason:** The specification prohibits external/binary art.  
**Trade-off:** Stylization is favored over asset-level realism.

## Collision
**Decision:** 2D circle-vs-AABB movement collision against simplified furniture footprints and room bounds.  
**Reason:** Stable, fast and appropriate for a flat room.  
**Trade-off:** Visual meshes and collision shapes are intentionally approximate.

## Camera
**Decision:** Smooth orbiting third-person chase camera, keyboard/mouse yaw, bounded to the room.  
**Reason:** Keeps ちょぼ visible while making movement predictable.  
**Trade-off:** No complex mesh raycast occlusion system.

## Robot face
**Decision:** CanvasTexture expression display authored at runtime.  
**Reason:** Supports expressive, crisp emotions without image assets.  
**Trade-off:** Texture is updated only when expression/blink state changes.

## Dependencies
**Decision:** Add only `three`, its TypeScript declarations, `vite`, and `typescript`.  
**Reason:** The experience needs WebGL rendering and a local toolchain, but no app framework.  
**Trade-off:** UI and controls are custom code.

## Integration and restart
**Decision:** UI owns start/restart keyboard events; gameplay owns movement keys and exposes deterministic `reset()`.  
**Reason:** Prevents duplicated R-key state transitions and lets modal focus/visibility reset atomically.  
**Trade-off:** Gameplay depends on the small HUD event contract wired in `main.ts`.

## Camera colliders
**Decision:** Reuse movement AABBs for camera shortening, but give each furniture collider a realistic height.  
**Reason:** Avoids low cushions and boxes behaving like floor-to-ceiling camera walls.  
**Trade-off:** Collision volumes remain intentionally simplified.

## Accessibility
**Decision:** Use modal `inert` state, explicit canvas focus restoration, darker action colors, responsive UI and reduced 3D motion when requested by the OS.  
**Reason:** Keeps the keyboard path and important feedback perceivable without changing the simple game loop.  
**Trade-off:** Reduced-motion mode retains minimal movement needed to communicate play state.

## Three-stage structure
**Decision:** Reuse the cozy room and increase collectible count/reach gradually across three curated layouts.  
**Reason:** Provides progression without an abrupt difficulty jump or unnecessary environment duplication.  
**Trade-off:** Difficulty comes from route coverage and placement rather than new mechanics.

## BGM
**Decision:** Generate a calm looping soundtrack with Web Audio oscillators after explicit start.  
**Reason:** Meets the audio request while preserving the no-external-binary-asset rule.  
**Trade-off:** The music is intentionally simple and synthesized rather than recorded. Notes use a short scheduler so stage changes take effect within about one beat.

## Title activation
**Decision:** Start only from the visible button or Enter key.  
**Reason:** Prevents accidental starts caused by touching the overlay.  
**Trade-off:** Space and arbitrary clicks intentionally do nothing on the title screen.

## Smartphone controls
**Decision:** Use a left virtual joystick plus two right camera-turn buttons on touch-first devices, while preserving keyboard and mouse controls.
**Reason:** Provides discoverable two-thumb control without requiring gestures that conflict with browser navigation.
**Trade-off:** Camera pitch remains fixed to keep the mobile scheme simple and stable.

## Mobile rendering
**Decision:** Coarse-pointer devices use a 1.25 DPR cap, no renderer MSAA, PCF shadows and a 512² directional shadow map.
**Reason:** Keeps the cozy 3D scene responsive on mid-range and lower-cost phones.
**Trade-off:** Edges and shadows are slightly less smooth than on desktop.

## Reversible trusted-LAN preview
**Decision:** Keep `npm run dev` loopback-only and add a separate `npm run dev:lan` command that binds to `0.0.0.0` only when explicitly chosen.
**Reason:** Allows phone testing on the same Wi-Fi while making later revocation clear and immediate.
**Trade-off:** While the LAN command runs, other devices on that trusted local network can request the development site.
