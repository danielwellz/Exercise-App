# Animation Engine Notes

- Active runtime path:
  1. Move selected in `src/pages/Move.tsx`
  2. `Viewer3D` (`RigCharacter`) resolves animator + normalized rig
  3. `useFrame` advances normalized time each frame
  4. `getAnimator(...).animate(...)` applies timeline pose to rig bones
  5. `applyGroundingOffset(...)` keeps contact markers on ground plane

- Fallback runtime:
  - `FallbackMannequin` in `Viewer3D` animates a procedural primitive mannequin if rig mapping fails.

- Legacy/unused candidate:
  - `src/lib/animations.ts` (clip-loader / AnimationMixer helpers) is present but currently not imported by the active viewer path.
