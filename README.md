# Exercise Movement Library (React + Three.js)

Production-quality trainer demo for exercise movement visualization using a single rigged humanoid model and procedural skeletal animation.

## Stack

- React + TypeScript + Vite
- Three.js via React Three Fiber + Drei
- Tailwind CSS
- Local exercise data in `src/data/moves.ts`
- No backend

## Setup

```bash
npm install
npm run dev
```

Open the Vite URL (usually `http://localhost:5173`).

Production build:

```bash
npm run build
npm run preview
```

## Asset Setup

1. Put a rigged humanoid model at:
   - `/public/models/humanoid.glb`
2. Optional additional characters:
   - `/public/characters/a.glb`
   - `/public/characters/b.glb`
3. The app ignores embedded animation clips and drives motion procedurally in code.
4. If a selected character file is missing or rig bone mapping fails, the app automatically switches to fallback mannequin mode.

## Adding Characters

1. Put a rigged character GLB in `/public/characters/`.
2. Add a record in `src/data/characters.ts`:
   - `id`, `name`, `url`, and optional `scale`, `rotationY`, `yOffset`, `defaultFlipFacing`
3. Select the character in Library or Move pages.
4. Use Move page "Character tuning" controls to tune scale/height/rotation:
   - Scale, Y Offset, Rotation Y
   - Values are saved per character in localStorage.
5. Procedural animation remains the driver for all movement; no external animation clips are required.

## Procedural Animation Architecture

- Rig discovery + normalized map: `src/lib/rig.ts`
- Procedural pose/timeline engine: `src/lib/procedural.ts`
- Grounding stabilization (feet/hands/none): `src/lib/grounding.ts`
- Auto-fit + trainer camera presets: `src/lib/cameraFit.ts`

Viewer integration is in `src/components/Viewer3D.tsx`.

## Features

- Library page:
  - Search and category filters
  - Exercise cards with low-cost animated preview on hover
- Move page:
  - Global character picker
  - Procedural looping animation from normalized rig bones
  - Play/Pause, speed (0.25x–2.0x)
  - Camera presets: Front, Side, 45°, Top, Vertical
  - Reset Camera
  - Flip Facing toggle (saved per character)
  - Character tuning (scale / y-offset / rotation)
  - Mesh / skeleton / joints toggles
  - Target muscle highlight overlays
  - Rep counter based on normalized loop wrap detection
  - Phase overlay from move phase data
  - Status: `Rig loaded` or fallback notice
- Export:
  - GIF (primary)
  - MP4 best-effort via `MediaRecorder` (browser dependent)
  - PNG sequence ZIP fallback (deterministic 60-frame loop capture)

## Add a New Move

1. Add a new record in `src/data/moves.ts` with at least:
   - `slug`, `title`, `category`, `steps`, `coachingCues`, `commonMistakes`
2. Add motion metadata on the move:
   - `phases`, `recommendedPreset`, `groundMode`, and optional `animatorKey`
3. Implement or map an animator in `src/lib/procedural.ts`:
   - Add a new timeline animator or map slug to an existing `animatorKey`
4. Verify in UI:
   - Animation loop, rep counting, phases, camera, and export buttons

## Manual Verification Checklist

- [ ] `npm run dev` starts successfully
- [ ] `npm run build` passes
- [ ] Viewer shows `Rig loaded` with valid humanoid rig
- [ ] Missing `humanoid.glb` switches to fallback mannequin
- [ ] Missing `/public/characters/a.glb` or `/public/characters/b.glb` switches to fallback mannequin when selected
- [ ] Unmapped rig bones switch to fallback mannequin
- [ ] Character picker updates Library previews and Move viewer
- [ ] Character tuning persists per character
- [ ] Camera auto-fit + presets + reset work
- [ ] Flip Facing toggles orientation
- [ ] Rep counter increments exactly once per loop wrap
- [ ] Phase label changes in sync with normalized time
- [ ] GIF export works
- [ ] MP4 works where supported; otherwise fallback message is clear
- [ ] PNG ZIP export downloads frame_0001.. sequence

## Credits / Attribution

- RiggedFigure © 2017 Cesium, licensed under [CC BY 4.0](https://creativecommons.org/licenses/by/4.0/).
- In-app attribution is shown in the global footer.
# Exercise-App
