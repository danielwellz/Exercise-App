# Rig Mapping Notes

- `src_lib_rig.ts` discovers skeletons, detects rig type, maps canonical bones, and captures rest-pose quaternions.
- Rest-pose normalization is implemented by storing each mapped bone quaternion once, then composing procedural offsets relative to that baseline.
