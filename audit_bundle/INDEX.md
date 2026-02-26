# Move/Exercise Animation Audit Bundle

## Scope
This bundle extracts the code/data paths that define exercises/moves and animate a character rig at runtime, including rig mapping, rest-pose normalization, and grounding behavior.

## Primary entrypoint
- **Per-frame animation update entrypoint:** `RigCharacter` `useFrame` in `src/components/Viewer3D.tsx:1072`
- Core per-frame calls in that loop:
  1. `animator.animate(rig, normalized, delta, ...)` (`src/components/Viewer3D.tsx:1089`)
  2. `applyGroundingOffset(...)` (`src/components/Viewer3D.tsx:1094`)

## Select Move -> Update Loop -> Rig Transform Call Chain (active)
1. Move is selected from route slug in `src/pages/Move.tsx:40-42` using `moveBySlug`.
2. `Move` passes selected `move` into `<Viewer3D ... />` (`src/pages/Move.tsx:291`).
3. `Viewer3D` -> `SceneRoot` -> `RigCharacter` builds rig via `buildNormalizedRig(modelRoot)` (`src/components/Viewer3D.tsx:886`).
4. Animator is resolved by `getAnimator(move.slug, move.animatorKey)` (`src/components/Viewer3D.tsx:885`).
5. On each frame (`useFrame`), normalized loop time is advanced and passed to animator (`src/components/Viewer3D.tsx:1072-1091`).
6. Animator path calls `applyPose` in `src/lib/procedural.ts:105`, which writes local `bone.quaternion` values relative to stored rest quaternions.
7. Grounding adjusts root Y after pose application via marker world Y sampling (`src/lib/grounding.ts:42`).

## Move/Exercise Data Shape
Defined in `src/data/moves.ts:20` (`ExerciseMove`):
- `slug`: unique id used in routing and animator lookup
- `title`, `category`, `difficulty`: metadata for UI and filtering
- `steps`, `coachingCues`, `commonMistakes`, `targetMuscles`: coaching data
- `defaultCameraPreset`, `recommendedPreset`: camera behavior
- `animationName`, `animatorKey`: animation lookup IDs
- `phaseLabels`, `phases`: normalized phase timeline labels
- `modelRotationY`, `groundMode`: per-move runtime transform/grounding behavior

Derived runtime fields in `src/data/moves.ts`:
- `derivePhases` (`:553`) -> normalized phase labels
- `deriveGroundMode` (`:543`) -> `'feet' | 'hands' | 'none'`
- `animatorKeyBySlug` map (`:494`) -> procedural animator key mapping
- Exported `moves` (`:567`) and `moveBySlug` (`:576`)

## Timing System (tempo/phase model)
- No BPM/tempo schema found; timing is loop-duration based.
- Loop model:
  - `localClockRef += (delta * speed) / animator.loopDuration` in `Viewer3D`.
  - Time normalized to `[0,1)` and wrapped each cycle.
- Phase model:
  - `move.phases` (derived from `phaseLabels.start`) identifies active phase label by threshold compare.
- Animator definitions set per-move `loopDuration` in `src/lib/procedural.ts` timeline definitions.

## Blending / Interpolation Utilities
Primary interpolation code in `src/lib/procedural.ts`:
- `poseBlend(...)`: linear interpolation of Euler offset triplets per bone.
- `createTimelineAnimator(...)`: interpolates between keyframes by segment.
- Default easing: `cubicInOut` (used when keyframe does not specify easing).
- Common override easing: `smoothstep` on many keyframes.
- Quaternion blending/application:
  - Rest quaternion + Euler offset composed into target.
  - `bone.quaternion.slerp(target, alpha)` when `alpha < 1`; full copy when `alpha ~= 1`.

## Coordinate-Space Conventions
- Bone pose offsets are authored as local Euler XYZ radians and applied in local bone space relative to captured rest quaternions (`src/lib/procedural.ts`).
- Character/world transforms are applied at wrapper root (`scale`, `rotation.y`, `position.y`) in `Viewer3D`.
- Grounding computes marker **world-space Y** and adjusts root `position.y` toward plane `y=0`.
- Facing axis assumption: yaw rotation around Y (`modelRotationY`, optional flip adds `Math.PI`).

## Rig Mapping + Rest-Pose Normalization
Implemented in `src/lib/rig.ts`:
- Detects skeleton from skinned meshes; chooses primary skeleton by max bone count.
- Detects rig family (`mixamo`, `custom`, `unknown`).
- Multi-stage mapping:
  1. Mixamo-specific lookup mapping
  2. Fuzzy regex-based mapping
  3. Joint-chain fallback (`torso_joint_*`, `arm_joint_*`, `leg_joint_*`)
  4. Structural spine/chest/head fallbacks
- Fails to `null` rig if critical mapped bones are missing.
- Captures `restPoseQuats` via `buildRestPose` and uses those as neutral baseline during pose application.

## Grounding / Foot Lock / IK Findings
- Found: simple grounding offset in `src/lib/grounding.ts`.
- Behavior:
  - Uses feet (and optionally hands) marker set.
  - Computes minimum world-space marker Y.
  - Applies smoothed correction to root Y.
  - Includes an airborne guard for `mode='feet'` to avoid downward snap in jump/jog phases.
- Not found:
  - Foot lock state machine
  - Pelvis compensation module
  - IK feet solver / inverse kinematics
  - Raycast floor / collision floor query

## Active vs Unused/Legacy Candidates
- **Active / used**
  - `src/data/moves.ts`
  - `src/pages/Move.tsx`
  - `src/components/Viewer3D.tsx`
  - `src/lib/procedural.ts`
  - `src/lib/rig.ts`
  - `src/lib/grounding.ts`
  - `src/data/characters.ts`
- **Conditionally active fallback path**
  - `FallbackMannequin` inside `src/components/Viewer3D.tsx` (used when rig mapping/model loading fails)
- **Unused/legacy candidate**
  - `src/lib/animations.ts` (clip/mixer loader utilities; no imports from active viewer path)

## Validators / Schemas
- No runtime validator library usage found (`zod`, `yup`, `io-ts` not present in `src/`).
- Data typing is TypeScript type-based (not runtime-validated schemas).

## Bundle Map
- `move_definitions/`
  - `src_data_moves.ts`
  - `src_pages_Move.tsx`
  - `src_pages_Library.tsx`
  - `src_data_characters.ts`
  - `NOTES.md`
- `animation_engine/`
  - `src_components_Viewer3D.tsx`
  - `src_lib_procedural.ts`
  - `src_lib_animations.ts`
  - `NOTES.md`
- `rig_mapping/`
  - `src_lib_rig.ts`
  - `NOTES.md`
- `grounding_ik/`
  - `src_lib_grounding.ts`
  - `NOTES.md`
- `skeleton_reference/`
  - `asset_paths.md`
  - `bone_hierarchy_humanoid.txt`
  - `bone_hierarchy_character_a.txt`
  - `bone_hierarchy_character_b.txt`
