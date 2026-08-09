# Product Specification

## Concept
`ちょぼと ひみつのパーツ` is a calm third-person 3D exploration game. A palm-sized original robot named ちょぼ explores an oversized pastel bedroom and gathers glowing starlight parts.

## Stage progression
- Stage 1: three nearby parts introduce movement and collection.
- Stage 2: four parts spread exploration toward the room edges.
- Stage 3: five parts use slightly less obvious furniture-side routes without a sudden difficulty spike.
- Clearing a stage opens an explicit continue screen. Clearing stage 3 returns to the original title screen and resets progress to stage 1.

## Robot
White, soft-plastic, rounded mascot proportions with a large cyan display face. Idle, move, collect and clear animations are joined by random yawn/thinking gestures. Random gestures occur after 3–5 seconds of continuous stillness and never while walking.

## Controls and camera
WASD or arrows move relative to the view; Q/E or mouse drag rotates the third-person camera. Only the title button or Enter starts the game. Clicking elsewhere and Space do not start it.

## Audio
Calm procedural BGM is generated with the Web Audio API after the explicit start action. No external audio file is required.

## Room and art direction
Warm, compact, toy-like bedroom made entirely from Three.js geometry. Warm cream, pale wood, mint, cyan, blush and butter yellow; soft shadows and low contrast. No external/binary art assets.

## Objective and feedback
Approaching a glowing part collects it, updates the HUD and triggers particles/expression feedback. Each stage ends clearly, and stage 3 completion returns to the title.

## Technical constraints
Vite + strict TypeScript + Three.js. Desktop Chrome/Edge target; responsive canvas/HUD. Geometry collision, capped pixel ratio, modest shadows and particles. No backend, persistence, APIs or deployment.
