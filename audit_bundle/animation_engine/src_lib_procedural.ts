/*
Summary:
- Procedural timeline animation engine keyed by move/animator IDs.
- Interpolates keyframe poses with easing and applies local bone quaternion offsets from rest pose.
- Core path: `getAnimator` -> `animate` -> `applyPose`.
*/
import { Euler, Quaternion } from 'three';
import type { ExerciseMove } from '../data/moves';
import type { GroundMode } from './grounding';
import type { NormalizedRig, RigBoneKey } from './rig';

export type AnimatorResult = {
  phaseLabel?: string;
  groundedOffsetY?: number;
};

export type AnimatorOptions = {
  move: ExerciseMove;
  groundMode?: GroundMode;
};

export type Animator = (rig: NormalizedRig, tNorm: number, dt: number, options: AnimatorOptions) => AnimatorResult;

export type AnimatorDefinition = {
  key: string;
  loopDuration: number;
  animate: Animator;
};

export type Pose = Partial<Record<RigBoneKey, [number, number, number]>>;

type TimelineKeyframe = {
  t: number;
  pose: Pose;
  label?: string;
  easing?: (value: number) => number;
};

const tempEuler = new Euler();
const tempOffsetQuat = new Quaternion();
const tempTargetQuat = new Quaternion();

const ZERO_ROTATION: [number, number, number] = [0, 0, 0];

const deg = (value: number) => (value * Math.PI) / 180;

export function smoothstep(value: number) {
  const t = Math.max(0, Math.min(1, value));
  return t * t * (3 - 2 * t);
}

export function cubicInOut(value: number) {
  const t = Math.max(0, Math.min(1, value));
  if (t < 0.5) {
    return 4 * t * t * t;
  }
  const f = -2 * t + 2;
  return 1 - (f * f * f) / 2;
}

export function cycleSine(tNorm: number) {
  return Math.sin(tNorm * Math.PI * 2);
}

function normalizeTime(tNorm: number) {
  return ((tNorm % 1) + 1) % 1;
}

export function poseBlend(poseA: Pose, poseB: Pose, weight: number): Pose {
  const result: Pose = {};
  const t = Math.max(0, Math.min(1, weight));
  const keys = new Set<RigBoneKey>([
    ...(Object.keys(poseA) as RigBoneKey[]),
    ...(Object.keys(poseB) as RigBoneKey[]),
  ]);

  for (const key of keys) {
    const a = poseA[key] ?? ZERO_ROTATION;
    const b = poseB[key] ?? ZERO_ROTATION;
    result[key] = [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t];
  }

  return result;
}

function clonePose(pose: Pose): Pose {
  const result: Pose = {};
  for (const [key, value] of Object.entries(pose) as Array<[RigBoneKey, [number, number, number]]>) {
    result[key] = [value[0], value[1], value[2]];
  }
  return result;
}

function combinePoses(...poses: Pose[]): Pose {
  const result: Pose = {};

  for (const pose of poses) {
    for (const [key, value] of Object.entries(pose) as Array<[RigBoneKey, [number, number, number]]>) {
      const current = result[key] ?? ZERO_ROTATION;
      result[key] = [current[0] + value[0], current[1] + value[1], current[2] + value[2]];
    }
  }

  return result;
}

function withBasePose(base: Pose, pose: Pose): Pose {
  return combinePoses(base, pose);
}

export function applyPose(rig: NormalizedRig, pose: Pose, alpha = 1) {
  const blendAlpha = Math.max(0, Math.min(1, alpha));

  for (const [key, bone] of Object.entries(rig.bones) as Array<[RigBoneKey, NormalizedRig['bones'][RigBoneKey]]>) {
    if (!bone) {
      continue;
    }

    const rest = rig.restPoseQuats[key];
    if (!rest) {
      continue;
    }

    const offset = pose[key] ?? ZERO_ROTATION;
    tempEuler.set(offset[0], offset[1], offset[2], 'XYZ');
    tempOffsetQuat.setFromEuler(tempEuler);
    tempTargetQuat.copy(rest).multiply(tempOffsetQuat);

    if (blendAlpha >= 0.999) {
      bone.quaternion.copy(tempTargetQuat);
    } else {
      bone.quaternion.slerp(tempTargetQuat, blendAlpha);
    }
  }
}

function createTimelineAnimator(key: string, loopDuration: number, keyframes: TimelineKeyframe[]): AnimatorDefinition {
  const ordered = [...keyframes].sort((a, b) => a.t - b.t);
  if (ordered.length === 0) {
    ordered.push({ t: 0, pose: {} });
  }

  if (ordered[0].t !== 0) {
    ordered.unshift({ ...ordered[0], t: 0 });
  }

  if (ordered[ordered.length - 1].t < 1) {
    ordered.push({ ...ordered[0], t: 1, pose: clonePose(ordered[0].pose) });
  } else if (ordered[ordered.length - 1].t === 1) {
    // Keep loops continuous to avoid visible pops between frames 1 -> 0.
    ordered[ordered.length - 1] = {
      ...ordered[ordered.length - 1],
      pose: clonePose(ordered[0].pose),
    };
  }

  const animate: Animator = (rig, tNorm) => {
    const t = normalizeTime(tNorm);

    let segmentIndex = 0;
    for (let index = 0; index < ordered.length - 1; index += 1) {
      if (t >= ordered[index].t && t < ordered[index + 1].t) {
        segmentIndex = index;
        break;
      }
    }

    const from = ordered[segmentIndex];
    const to = ordered[segmentIndex + 1] ?? ordered[0];

    const span = Math.max(0.0001, to.t - from.t);
    const local = (t - from.t) / span;
    const eased = (to.easing ?? from.easing ?? cubicInOut)(local);

    const blended = poseBlend(from.pose, to.pose, eased);
    applyPose(rig, blended, 1);

    return {
      phaseLabel: from.label,
    };
  };

  return {
    key,
    loopDuration,
    animate,
  };
}

const ATHLETIC_STANCE: Pose = {
  hips: [deg(2), 0, 0],
  chest: [deg(2), 0, 0],
  neck: [deg(-1), 0, 0],
  leftUpperLeg: [deg(-8), 0, 0],
  rightUpperLeg: [deg(-8), 0, 0],
  leftLowerLeg: [deg(14), 0, 0],
  rightLowerLeg: [deg(14), 0, 0],
  leftFoot: [deg(-4), 0, 0],
  rightFoot: [deg(-4), 0, 0],
  leftUpperArm: [deg(8), 0, deg(4)],
  rightUpperArm: [deg(8), 0, deg(-4)],
  leftLowerArm: [deg(8), 0, 0],
  rightLowerArm: [deg(8), 0, 0],
};

const HOLD_BREATH: AnimatorDefinition = createTimelineAnimator('hold', 3.2, [
  {
    t: 0,
    label: 'Hold',
    pose: withBasePose(ATHLETIC_STANCE, {}),
  },
  {
    t: 0.35,
    label: 'Breathe',
    easing: smoothstep,
    pose: withBasePose(ATHLETIC_STANCE, {
      chest: [deg(2.5), 0, 0],
      neck: [deg(0.6), 0, 0],
    }),
  },
  {
    t: 0.7,
    label: 'Hold',
    easing: smoothstep,
    pose: withBasePose(ATHLETIC_STANCE, {}),
  },
  {
    t: 1,
    label: 'Hold',
    pose: withBasePose(ATHLETIC_STANCE, {}),
  },
]);

const WALK: AnimatorDefinition = createTimelineAnimator('walk', 1.45, [
  {
    t: 0,
    label: 'Left support',
    pose: withBasePose(ATHLETIC_STANCE, {
      leftUpperLeg: [deg(26), 0, 0],
      rightUpperLeg: [deg(-18), 0, 0],
      leftLowerLeg: [deg(-10), 0, 0],
      rightLowerLeg: [deg(26), 0, 0],
      leftFoot: [deg(-4), 0, 0],
      rightFoot: [deg(10), 0, 0],
      leftUpperArm: [deg(-26), 0, 0],
      rightUpperArm: [deg(26), 0, 0],
      leftLowerArm: [deg(8), 0, 0],
      rightLowerArm: [deg(14), 0, 0],
      chest: [deg(1), 0, 0],
    }),
  },
  {
    t: 0.25,
    label: 'Mid-stance',
    easing: smoothstep,
    pose: withBasePose(ATHLETIC_STANCE, {
      leftUpperLeg: [deg(4), 0, 0],
      rightUpperLeg: [deg(-2), 0, 0],
      leftLowerLeg: [deg(4), 0, 0],
      rightLowerLeg: [deg(6), 0, 0],
      leftUpperArm: [deg(-8), 0, 0],
      rightUpperArm: [deg(8), 0, 0],
      chest: [deg(1), 0, 0],
    }),
  },
  {
    t: 0.5,
    label: 'Right support',
    pose: withBasePose(ATHLETIC_STANCE, {
      leftUpperLeg: [deg(-18), 0, 0],
      rightUpperLeg: [deg(26), 0, 0],
      leftLowerLeg: [deg(26), 0, 0],
      rightLowerLeg: [deg(-10), 0, 0],
      leftFoot: [deg(10), 0, 0],
      rightFoot: [deg(-4), 0, 0],
      leftUpperArm: [deg(26), 0, 0],
      rightUpperArm: [deg(-26), 0, 0],
      leftLowerArm: [deg(14), 0, 0],
      rightLowerArm: [deg(8), 0, 0],
      chest: [deg(1), 0, 0],
    }),
  },
  {
    t: 0.75,
    label: 'Mid-stance',
    easing: smoothstep,
    pose: withBasePose(ATHLETIC_STANCE, {
      leftUpperLeg: [deg(-2), 0, 0],
      rightUpperLeg: [deg(4), 0, 0],
      leftLowerLeg: [deg(6), 0, 0],
      rightLowerLeg: [deg(4), 0, 0],
      leftUpperArm: [deg(8), 0, 0],
      rightUpperArm: [deg(-8), 0, 0],
      chest: [deg(1), 0, 0],
    }),
  },
  {
    t: 1,
    label: 'Left support',
    pose: withBasePose(ATHLETIC_STANCE, {
      leftUpperLeg: [deg(26), 0, 0],
      rightUpperLeg: [deg(-18), 0, 0],
      leftLowerLeg: [deg(-10), 0, 0],
      rightLowerLeg: [deg(26), 0, 0],
      leftFoot: [deg(-4), 0, 0],
      rightFoot: [deg(10), 0, 0],
      leftUpperArm: [deg(-26), 0, 0],
      rightUpperArm: [deg(26), 0, 0],
      leftLowerArm: [deg(8), 0, 0],
      rightLowerArm: [deg(14), 0, 0],
      chest: [deg(1), 0, 0],
    }),
  },
]);

const JOG: AnimatorDefinition = createTimelineAnimator('jog', 1.0, [
  {
    t: 0,
    label: 'Drive',
    pose: withBasePose(ATHLETIC_STANCE, {
      hips: [deg(-2), 0, 0],
      chest: [deg(2), 0, 0],
      leftUpperLeg: [deg(36), 0, 0],
      rightUpperLeg: [deg(-30), 0, 0],
      leftLowerLeg: [deg(-8), 0, 0],
      rightLowerLeg: [deg(45), 0, 0],
      leftUpperArm: [deg(-42), 0, 0],
      rightUpperArm: [deg(42), 0, 0],
      leftLowerArm: [deg(26), 0, 0],
      rightLowerArm: [deg(18), 0, 0],
    }),
  },
  {
    t: 0.25,
    label: 'Float',
    easing: smoothstep,
    pose: withBasePose(ATHLETIC_STANCE, {
      hips: [deg(-1), 0, 0],
      chest: [deg(3), 0, 0],
      leftUpperLeg: [deg(8), 0, 0],
      rightUpperLeg: [deg(-8), 0, 0],
      leftLowerLeg: [deg(24), 0, 0],
      rightLowerLeg: [deg(20), 0, 0],
      leftUpperArm: [deg(-14), 0, 0],
      rightUpperArm: [deg(14), 0, 0],
      leftLowerArm: [deg(24), 0, 0],
      rightLowerArm: [deg(24), 0, 0],
    }),
  },
  {
    t: 0.5,
    label: 'Drive',
    pose: withBasePose(ATHLETIC_STANCE, {
      hips: [deg(-2), 0, 0],
      chest: [deg(2), 0, 0],
      leftUpperLeg: [deg(-30), 0, 0],
      rightUpperLeg: [deg(36), 0, 0],
      leftLowerLeg: [deg(45), 0, 0],
      rightLowerLeg: [deg(-8), 0, 0],
      leftUpperArm: [deg(42), 0, 0],
      rightUpperArm: [deg(-42), 0, 0],
      leftLowerArm: [deg(18), 0, 0],
      rightLowerArm: [deg(26), 0, 0],
    }),
  },
  {
    t: 0.75,
    label: 'Float',
    easing: smoothstep,
    pose: withBasePose(ATHLETIC_STANCE, {
      hips: [deg(-1), 0, 0],
      chest: [deg(3), 0, 0],
      leftUpperLeg: [deg(-8), 0, 0],
      rightUpperLeg: [deg(8), 0, 0],
      leftLowerLeg: [deg(20), 0, 0],
      rightLowerLeg: [deg(24), 0, 0],
      leftUpperArm: [deg(14), 0, 0],
      rightUpperArm: [deg(-14), 0, 0],
      leftLowerArm: [deg(24), 0, 0],
      rightLowerArm: [deg(24), 0, 0],
    }),
  },
  {
    t: 1,
    label: 'Drive',
    pose: withBasePose(ATHLETIC_STANCE, {
      hips: [deg(-2), 0, 0],
      chest: [deg(2), 0, 0],
      leftUpperLeg: [deg(36), 0, 0],
      rightUpperLeg: [deg(-30), 0, 0],
      leftLowerLeg: [deg(-8), 0, 0],
      rightLowerLeg: [deg(45), 0, 0],
      leftUpperArm: [deg(-42), 0, 0],
      rightUpperArm: [deg(42), 0, 0],
      leftLowerArm: [deg(26), 0, 0],
      rightLowerArm: [deg(18), 0, 0],
    }),
  },
]);

const SQUAT: AnimatorDefinition = createTimelineAnimator('squat', 2.2, [
  {
    t: 0,
    label: 'Stand tall',
    pose: withBasePose(ATHLETIC_STANCE, {}),
  },
  {
    t: 0.35,
    label: 'Descend',
    easing: smoothstep,
    pose: withBasePose(ATHLETIC_STANCE, {
      hips: [deg(8), 0, 0],
      chest: [deg(-10), 0, 0],
      leftUpperLeg: [deg(-34), 0, 0],
      rightUpperLeg: [deg(-34), 0, 0],
      leftLowerLeg: [deg(32), 0, 0],
      rightLowerLeg: [deg(32), 0, 0],
      leftFoot: [deg(-3), 0, 0],
      rightFoot: [deg(-3), 0, 0],
      leftUpperArm: [deg(16), 0, deg(3)],
      rightUpperArm: [deg(16), 0, deg(-3)],
    }),
  },
  {
    t: 0.58,
    label: 'Bottom',
    pose: withBasePose(ATHLETIC_STANCE, {
      hips: [deg(14), 0, 0],
      chest: [deg(-16), 0, 0],
      leftUpperLeg: [deg(-62), 0, 0],
      rightUpperLeg: [deg(-62), 0, 0],
      leftLowerLeg: [deg(64), 0, 0],
      rightLowerLeg: [deg(64), 0, 0],
      leftFoot: [deg(-5), 0, 0],
      rightFoot: [deg(-5), 0, 0],
      leftUpperArm: [deg(24), 0, deg(4)],
      rightUpperArm: [deg(24), 0, deg(-4)],
      leftLowerArm: [deg(12), 0, 0],
      rightLowerArm: [deg(12), 0, 0],
    }),
  },
  {
    t: 1,
    label: 'Stand tall',
    easing: smoothstep,
    pose: withBasePose(ATHLETIC_STANCE, {}),
  },
]);

const SPLIT_SQUAT: AnimatorDefinition = createTimelineAnimator('splitSquat', 2.4, [
  {
    t: 0,
    label: 'Set split stance',
    pose: withBasePose(ATHLETIC_STANCE, {
      leftUpperLeg: [deg(-30), 0, 0],
      rightUpperLeg: [deg(22), 0, 0],
      leftLowerLeg: [deg(12), 0, 0],
      rightLowerLeg: [deg(18), 0, 0],
      chest: [deg(-4), 0, 0],
    }),
  },
  {
    t: 0.35,
    label: 'Lower down',
    easing: smoothstep,
    pose: withBasePose(ATHLETIC_STANCE, {
      leftUpperLeg: [deg(-54), 0, 0],
      rightUpperLeg: [deg(30), 0, 0],
      leftLowerLeg: [deg(56), 0, 0],
      rightLowerLeg: [deg(40), 0, 0],
      chest: [deg(-8), 0, 0],
      hips: [deg(8), 0, 0],
    }),
  },
  {
    t: 0.58,
    label: 'Bottom',
    pose: withBasePose(ATHLETIC_STANCE, {
      leftUpperLeg: [deg(-64), 0, 0],
      rightUpperLeg: [deg(38), 0, 0],
      leftLowerLeg: [deg(70), 0, 0],
      rightLowerLeg: [deg(52), 0, 0],
      chest: [deg(-10), 0, 0],
      hips: [deg(10), 0, 0],
    }),
  },
  {
    t: 1,
    label: 'Drive up',
    pose: withBasePose(ATHLETIC_STANCE, {
      leftUpperLeg: [deg(-30), 0, 0],
      rightUpperLeg: [deg(22), 0, 0],
      leftLowerLeg: [deg(12), 0, 0],
      rightLowerLeg: [deg(18), 0, 0],
      chest: [deg(-4), 0, 0],
    }),
  },
]);

const JUMP_SQUAT: AnimatorDefinition = createTimelineAnimator('jumpSquat', 1.8, [
  {
    t: 0,
    label: 'Dip',
    pose: withBasePose(ATHLETIC_STANCE, {
      hips: [deg(10), 0, 0],
      chest: [deg(-12), 0, 0],
      leftUpperLeg: [deg(-44), 0, 0],
      rightUpperLeg: [deg(-44), 0, 0],
      leftLowerLeg: [deg(48), 0, 0],
      rightLowerLeg: [deg(48), 0, 0],
      leftUpperArm: [deg(22), 0, deg(4)],
      rightUpperArm: [deg(22), 0, deg(-4)],
    }),
  },
  {
    t: 0.33,
    label: 'Explode',
    easing: smoothstep,
    pose: withBasePose(ATHLETIC_STANCE, {
      hips: [deg(-6), 0, 0],
      chest: [deg(6), 0, 0],
      leftUpperLeg: [deg(12), 0, 0],
      rightUpperLeg: [deg(12), 0, 0],
      leftLowerLeg: [deg(-10), 0, 0],
      rightLowerLeg: [deg(-10), 0, 0],
      leftFoot: [deg(18), 0, 0],
      rightFoot: [deg(18), 0, 0],
      leftUpperArm: [deg(-34), 0, deg(4)],
      rightUpperArm: [deg(-34), 0, deg(-4)],
    }),
  },
  {
    t: 0.68,
    label: 'Land soft',
    pose: withBasePose(ATHLETIC_STANCE, {
      hips: [deg(6), 0, 0],
      chest: [deg(-10), 0, 0],
      leftUpperLeg: [deg(-36), 0, 0],
      rightUpperLeg: [deg(-36), 0, 0],
      leftLowerLeg: [deg(42), 0, 0],
      rightLowerLeg: [deg(42), 0, 0],
    }),
  },
  {
    t: 1,
    label: 'Reset',
    pose: withBasePose(ATHLETIC_STANCE, {}),
  },
]);

const LUNGE_WALK: AnimatorDefinition = createTimelineAnimator('walkingLunge', 2.3, [
  {
    t: 0,
    label: 'Left lunge',
    pose: withBasePose(ATHLETIC_STANCE, {
      leftUpperLeg: [deg(-58), 0, 0],
      leftLowerLeg: [deg(72), 0, 0],
      rightUpperLeg: [deg(26), 0, 0],
      rightLowerLeg: [deg(28), 0, 0],
      chest: [deg(-8), 0, 0],
      leftUpperArm: [deg(14), 0, deg(3)],
      rightUpperArm: [deg(-10), 0, deg(-3)],
    }),
  },
  {
    t: 0.25,
    label: 'Step through',
    easing: smoothstep,
    pose: withBasePose(ATHLETIC_STANCE, {
      leftUpperLeg: [deg(-10), 0, 0],
      leftLowerLeg: [deg(12), 0, 0],
      rightUpperLeg: [deg(8), 0, 0],
      rightLowerLeg: [deg(8), 0, 0],
      chest: [deg(-4), 0, 0],
    }),
  },
  {
    t: 0.5,
    label: 'Right lunge',
    pose: withBasePose(ATHLETIC_STANCE, {
      rightUpperLeg: [deg(-58), 0, 0],
      rightLowerLeg: [deg(72), 0, 0],
      leftUpperLeg: [deg(26), 0, 0],
      leftLowerLeg: [deg(28), 0, 0],
      chest: [deg(-8), 0, 0],
      leftUpperArm: [deg(-10), 0, deg(3)],
      rightUpperArm: [deg(14), 0, deg(-3)],
    }),
  },
  {
    t: 0.75,
    label: 'Step through',
    easing: smoothstep,
    pose: withBasePose(ATHLETIC_STANCE, {
      rightUpperLeg: [deg(-10), 0, 0],
      rightLowerLeg: [deg(12), 0, 0],
      leftUpperLeg: [deg(8), 0, 0],
      leftLowerLeg: [deg(8), 0, 0],
      chest: [deg(-4), 0, 0],
    }),
  },
  {
    t: 1,
    label: 'Left lunge',
    pose: withBasePose(ATHLETIC_STANCE, {
      leftUpperLeg: [deg(-58), 0, 0],
      leftLowerLeg: [deg(72), 0, 0],
      rightUpperLeg: [deg(26), 0, 0],
      rightLowerLeg: [deg(28), 0, 0],
      chest: [deg(-8), 0, 0],
      leftUpperArm: [deg(14), 0, deg(3)],
      rightUpperArm: [deg(-10), 0, deg(-3)],
    }),
  },
]);

const CALF_RAISE: AnimatorDefinition = createTimelineAnimator('calfRaise', 1.6, [
  {
    t: 0,
    label: 'Flat foot',
    pose: withBasePose(ATHLETIC_STANCE, {
      leftUpperLeg: [deg(6), 0, 0],
      rightUpperLeg: [deg(6), 0, 0],
      leftLowerLeg: [deg(-8), 0, 0],
      rightLowerLeg: [deg(-8), 0, 0],
    }),
  },
  {
    t: 0.45,
    label: 'Rise up',
    easing: smoothstep,
    pose: withBasePose(ATHLETIC_STANCE, {
      leftFoot: [deg(22), 0, 0],
      rightFoot: [deg(22), 0, 0],
      leftLowerLeg: [deg(-8), 0, 0],
      rightLowerLeg: [deg(-8), 0, 0],
      chest: [deg(3), 0, 0],
    }),
  },
  {
    t: 1,
    label: 'Lower slow',
    pose: withBasePose(ATHLETIC_STANCE, {
      leftUpperLeg: [deg(6), 0, 0],
      rightUpperLeg: [deg(6), 0, 0],
      leftLowerLeg: [deg(-8), 0, 0],
      rightLowerLeg: [deg(-8), 0, 0],
    }),
  },
]);

const PUSH_UP: AnimatorDefinition = createTimelineAnimator('pushup', 2.2, [
  {
    t: 0,
    label: 'Top plank',
    pose: {
      hips: [deg(-70), 0, 0],
      chest: [deg(26), 0, 0],
      leftUpperArm: [deg(-94), 0, deg(8)],
      rightUpperArm: [deg(-94), 0, deg(-8)],
      leftLowerArm: [deg(-16), 0, 0],
      rightLowerArm: [deg(-16), 0, 0],
      leftUpperLeg: [deg(42), 0, 0],
      rightUpperLeg: [deg(42), 0, 0],
      leftLowerLeg: [deg(-18), 0, 0],
      rightLowerLeg: [deg(-18), 0, 0],
    },
  },
  {
    t: 0.34,
    label: 'Lower down',
    easing: smoothstep,
    pose: {
      hips: [deg(-68), 0, 0],
      chest: [deg(30), 0, 0],
      leftUpperArm: [deg(-74), 0, deg(13)],
      rightUpperArm: [deg(-74), 0, deg(-13)],
      leftLowerArm: [deg(-64), 0, 0],
      rightLowerArm: [deg(-64), 0, 0],
      leftUpperLeg: [deg(40), 0, 0],
      rightUpperLeg: [deg(40), 0, 0],
    },
  },
  {
    t: 0.58,
    label: 'Bottom',
    pose: {
      hips: [deg(-66), 0, 0],
      chest: [deg(34), 0, 0],
      leftUpperArm: [deg(-60), 0, deg(16)],
      rightUpperArm: [deg(-60), 0, deg(-16)],
      leftLowerArm: [deg(-94), 0, 0],
      rightLowerArm: [deg(-94), 0, 0],
      leftUpperLeg: [deg(38), 0, 0],
      rightUpperLeg: [deg(38), 0, 0],
    },
  },
  {
    t: 1,
    label: 'Press up',
    easing: smoothstep,
    pose: {
      hips: [deg(-70), 0, 0],
      chest: [deg(26), 0, 0],
      leftUpperArm: [deg(-94), 0, deg(8)],
      rightUpperArm: [deg(-94), 0, deg(-8)],
      leftLowerArm: [deg(-16), 0, 0],
      rightLowerArm: [deg(-16), 0, 0],
      leftUpperLeg: [deg(42), 0, 0],
      rightUpperLeg: [deg(42), 0, 0],
      leftLowerLeg: [deg(-18), 0, 0],
      rightLowerLeg: [deg(-18), 0, 0],
    },
  },
]);

const PUSH_UP_SLOW: AnimatorDefinition = {
  ...PUSH_UP,
  key: 'pushupSlow',
  loopDuration: 5.0,
};

const SCAPULAR_PUSH_UP: AnimatorDefinition = createTimelineAnimator('scapularPushup', 2.4, [
  {
    t: 0,
    label: 'Set plank',
    pose: {
      hips: [deg(-70), 0, 0],
      chest: [deg(24), 0, 0],
      leftUpperArm: [deg(-94), deg(3), deg(10)],
      rightUpperArm: [deg(-94), deg(-3), deg(-10)],
      leftLowerArm: [deg(-12), 0, 0],
      rightLowerArm: [deg(-12), 0, 0],
      leftUpperLeg: [deg(40), 0, 0],
      rightUpperLeg: [deg(40), 0, 0],
    },
  },
  {
    t: 0.38,
    label: 'Pinch scapula',
    easing: smoothstep,
    pose: {
      hips: [deg(-68), 0, 0],
      chest: [deg(31), 0, 0],
      leftUpperArm: [deg(-90), deg(-6), deg(5)],
      rightUpperArm: [deg(-90), deg(6), deg(-5)],
      leftLowerArm: [deg(-12), 0, 0],
      rightLowerArm: [deg(-12), 0, 0],
      leftUpperLeg: [deg(38), 0, 0],
      rightUpperLeg: [deg(38), 0, 0],
    },
  },
  {
    t: 0.68,
    label: 'Push away',
    pose: {
      hips: [deg(-70), 0, 0],
      chest: [deg(22), 0, 0],
      leftUpperArm: [deg(-96), deg(6), deg(10)],
      rightUpperArm: [deg(-96), deg(-6), deg(-10)],
      leftLowerArm: [deg(-12), 0, 0],
      rightLowerArm: [deg(-12), 0, 0],
      leftUpperLeg: [deg(40), 0, 0],
      rightUpperLeg: [deg(40), 0, 0],
    },
  },
  {
    t: 1,
    label: 'Set plank',
    pose: {
      hips: [deg(-70), 0, 0],
      chest: [deg(24), 0, 0],
      leftUpperArm: [deg(-94), deg(3), deg(10)],
      rightUpperArm: [deg(-94), deg(-3), deg(-10)],
      leftLowerArm: [deg(-12), 0, 0],
      rightLowerArm: [deg(-12), 0, 0],
      leftUpperLeg: [deg(40), 0, 0],
      rightUpperLeg: [deg(40), 0, 0],
    },
  },
]);

const PIKE_PUSH_UP: AnimatorDefinition = createTimelineAnimator('pikePushup', 2.1, [
  {
    t: 0,
    label: 'Pike setup',
    pose: {
      hips: [deg(-42), 0, 0],
      chest: [deg(-18), 0, 0],
      leftUpperLeg: [deg(-64), 0, 0],
      rightUpperLeg: [deg(-64), 0, 0],
      leftLowerLeg: [deg(18), 0, 0],
      rightLowerLeg: [deg(18), 0, 0],
      leftUpperArm: [deg(-118), 0, deg(10)],
      rightUpperArm: [deg(-118), 0, deg(-10)],
      leftLowerArm: [deg(-16), 0, 0],
      rightLowerArm: [deg(-16), 0, 0],
    },
  },
  {
    t: 0.36,
    label: 'Lower head',
    easing: smoothstep,
    pose: {
      hips: [deg(-40), 0, 0],
      chest: [deg(-12), 0, 0],
      leftUpperLeg: [deg(-60), 0, 0],
      rightUpperLeg: [deg(-60), 0, 0],
      leftUpperArm: [deg(-104), 0, deg(14)],
      rightUpperArm: [deg(-104), 0, deg(-14)],
      leftLowerArm: [deg(-64), 0, 0],
      rightLowerArm: [deg(-64), 0, 0],
    },
  },
  {
    t: 0.58,
    label: 'Lower head',
    pose: {
      hips: [deg(-36), 0, 0],
      chest: [deg(-8), 0, 0],
      leftUpperLeg: [deg(-56), 0, 0],
      rightUpperLeg: [deg(-56), 0, 0],
      leftUpperArm: [deg(-92), 0, deg(16)],
      rightUpperArm: [deg(-92), 0, deg(-16)],
      leftLowerArm: [deg(-94), 0, 0],
      rightLowerArm: [deg(-94), 0, 0],
    },
  },
  {
    t: 1,
    label: 'Press up',
    easing: smoothstep,
    pose: {
      hips: [deg(-42), 0, 0],
      chest: [deg(-18), 0, 0],
      leftUpperLeg: [deg(-64), 0, 0],
      rightUpperLeg: [deg(-64), 0, 0],
      leftLowerLeg: [deg(18), 0, 0],
      rightLowerLeg: [deg(18), 0, 0],
      leftUpperArm: [deg(-118), 0, deg(10)],
      rightUpperArm: [deg(-118), 0, deg(-10)],
      leftLowerArm: [deg(-16), 0, 0],
      rightLowerArm: [deg(-16), 0, 0],
    },
  },
]);

const DIP: AnimatorDefinition = createTimelineAnimator('dip', 2.0, [
  {
    t: 0,
    label: 'Support',
    pose: {
      leftUpperArm: [deg(-10), 0, deg(8)],
      rightUpperArm: [deg(-10), 0, deg(-8)],
      leftLowerArm: [deg(-70), 0, 0],
      rightLowerArm: [deg(-70), 0, 0],
      chest: [deg(8), 0, 0],
      hips: [deg(6), 0, 0],
    },
  },
  {
    t: 0.5,
    label: 'Lower',
    pose: {
      leftUpperArm: [deg(18), 0, deg(14)],
      rightUpperArm: [deg(18), 0, deg(-14)],
      leftLowerArm: [deg(-128), 0, 0],
      rightLowerArm: [deg(-128), 0, 0],
      chest: [deg(-6), 0, 0],
      hips: [deg(10), 0, 0],
    },
  },
  { t: 1, label: 'Drive up', pose: {} },
]);

const BENCH_DIP: AnimatorDefinition = createTimelineAnimator('benchDip', 2.1, [
  {
    t: 0,
    label: 'Top support',
    pose: {
      leftUpperArm: [deg(10), 0, deg(16)],
      rightUpperArm: [deg(10), 0, deg(-16)],
      leftLowerArm: [deg(-72), 0, 0],
      rightLowerArm: [deg(-72), 0, 0],
      leftUpperLeg: [deg(28), 0, 0],
      rightUpperLeg: [deg(28), 0, 0],
      leftLowerLeg: [deg(20), 0, 0],
      rightLowerLeg: [deg(20), 0, 0],
      hips: [deg(8), 0, 0],
    },
  },
  {
    t: 0.55,
    label: 'Lower down',
    pose: {
      leftUpperArm: [deg(34), 0, deg(20)],
      rightUpperArm: [deg(34), 0, deg(-20)],
      leftLowerArm: [deg(-122), 0, 0],
      rightLowerArm: [deg(-122), 0, 0],
      leftUpperLeg: [deg(18), 0, 0],
      rightUpperLeg: [deg(18), 0, 0],
      hips: [deg(4), 0, 0],
    },
  },
  { t: 1, label: 'Press up', pose: {} },
]);

const PLANK: AnimatorDefinition = createTimelineAnimator('plank', 3.2, [
  {
    t: 0,
    label: 'Set plank',
    pose: {
      hips: [deg(-72), 0, 0],
      chest: [deg(26), 0, 0],
      leftUpperArm: [deg(-108), 0, deg(8)],
      rightUpperArm: [deg(-108), 0, deg(-8)],
      leftLowerArm: [deg(-86), 0, 0],
      rightLowerArm: [deg(-86), 0, 0],
      leftUpperLeg: [deg(42), 0, 0],
      rightUpperLeg: [deg(42), 0, 0],
      leftLowerLeg: [deg(-18), 0, 0],
      rightLowerLeg: [deg(-18), 0, 0],
    },
  },
  {
    t: 0.5,
    label: 'Hold + breathe',
    pose: {
      hips: [deg(-71), 0, 0],
      chest: [deg(29), 0, 0],
      leftUpperArm: [deg(-108), 0, deg(8)],
      rightUpperArm: [deg(-108), 0, deg(-8)],
      leftLowerArm: [deg(-86), 0, 0],
      rightLowerArm: [deg(-86), 0, 0],
      leftUpperLeg: [deg(42), 0, 0],
      rightUpperLeg: [deg(42), 0, 0],
      leftLowerLeg: [deg(-18), 0, 0],
      rightLowerLeg: [deg(-18), 0, 0],
    },
  },
  { t: 1, label: 'Hold + breathe', pose: {} },
]);

const HOLLOW_HOLD: AnimatorDefinition = createTimelineAnimator('hollowHold', 3.0, [
  {
    t: 0,
    label: 'Set hollow',
    pose: {
      hips: [deg(16), 0, 0],
      chest: [deg(26), 0, 0],
      leftUpperLeg: [deg(-42), 0, 0],
      rightUpperLeg: [deg(-42), 0, 0],
      leftLowerLeg: [deg(24), 0, 0],
      rightLowerLeg: [deg(24), 0, 0],
      leftUpperArm: [deg(-34), 0, deg(8)],
      rightUpperArm: [deg(-34), 0, deg(-8)],
    },
  },
  {
    t: 0.5,
    label: 'Hold tight',
    pose: {
      hips: [deg(20), 0, 0],
      chest: [deg(29), 0, 0],
      leftUpperLeg: [deg(-48), 0, 0],
      rightUpperLeg: [deg(-48), 0, 0],
      leftLowerLeg: [deg(20), 0, 0],
      rightLowerLeg: [deg(20), 0, 0],
      leftUpperArm: [deg(-40), 0, deg(8)],
      rightUpperArm: [deg(-40), 0, deg(-8)],
    },
  },
  { t: 1, label: 'Hold tight', pose: {} },
]);

const GLUTE_BRIDGE: AnimatorDefinition = createTimelineAnimator('gluteBridge', 2.1, [
  {
    t: 0,
    label: 'Start',
    pose: {
      hips: [deg(10), 0, 0],
      chest: [deg(8), 0, 0],
      leftUpperLeg: [deg(34), 0, 0],
      rightUpperLeg: [deg(34), 0, 0],
      leftLowerLeg: [deg(54), 0, 0],
      rightLowerLeg: [deg(54), 0, 0],
    },
  },
  {
    t: 0.45,
    label: 'Bridge up',
    pose: {
      hips: [deg(-8), 0, 0],
      chest: [deg(18), 0, 0],
      leftUpperLeg: [deg(18), 0, 0],
      rightUpperLeg: [deg(18), 0, 0],
      leftLowerLeg: [deg(42), 0, 0],
      rightLowerLeg: [deg(42), 0, 0],
    },
  },
  { t: 1, label: 'Lower control', pose: {} },
]);

const NORDIC: AnimatorDefinition = createTimelineAnimator('nordicCurl', 2.5, [
  {
    t: 0,
    label: 'Tall kneel',
    pose: {
      leftUpperLeg: [deg(-86), 0, 0],
      rightUpperLeg: [deg(-86), 0, 0],
      leftLowerLeg: [deg(86), 0, 0],
      rightLowerLeg: [deg(86), 0, 0],
      chest: [deg(2), 0, 0],
      hips: [deg(8), 0, 0],
      leftUpperArm: [deg(-10), 0, deg(6)],
      rightUpperArm: [deg(-10), 0, deg(-6)],
    },
  },
  {
    t: 0.65,
    label: 'Lower slowly',
    pose: {
      leftUpperLeg: [deg(-86), 0, 0],
      rightUpperLeg: [deg(-86), 0, 0],
      leftLowerLeg: [deg(86), 0, 0],
      rightLowerLeg: [deg(86), 0, 0],
      chest: [deg(-44), 0, 0],
      hips: [deg(2), 0, 0],
      leftUpperArm: [deg(38), 0, deg(10)],
      rightUpperArm: [deg(38), 0, deg(-10)],
      leftLowerArm: [deg(-62), 0, 0],
      rightLowerArm: [deg(-62), 0, 0],
    },
  },
  { t: 1, label: 'Push back', pose: {} },
]);

const HAMSTRING_SLIDE: AnimatorDefinition = createTimelineAnimator('hamstringSlide', 2.4, [
  {
    t: 0,
    label: 'Bridge set',
    pose: {
      hips: [deg(-6), 0, 0],
      leftUpperLeg: [deg(22), 0, 0],
      rightUpperLeg: [deg(22), 0, 0],
      leftLowerLeg: [deg(72), 0, 0],
      rightLowerLeg: [deg(72), 0, 0],
      chest: [deg(14), 0, 0],
    },
  },
  {
    t: 0.5,
    label: 'Heels out',
    pose: {
      hips: [deg(-2), 0, 0],
      leftUpperLeg: [deg(8), 0, 0],
      rightUpperLeg: [deg(8), 0, 0],
      leftLowerLeg: [deg(20), 0, 0],
      rightLowerLeg: [deg(20), 0, 0],
      chest: [deg(12), 0, 0],
    },
  },
  { t: 1, label: 'Pull in', pose: {} },
]);

const BAND_ROW: AnimatorDefinition = createTimelineAnimator('bandRow', 1.9, [
  {
    t: 0,
    label: 'Reach',
    pose: withBasePose(ATHLETIC_STANCE, {
      leftUpperArm: [deg(-20), 0, deg(20)],
      rightUpperArm: [deg(-20), 0, deg(-20)],
      leftLowerArm: [deg(-20), 0, 0],
      rightLowerArm: [deg(-20), 0, 0],
      chest: [deg(6), 0, 0],
    }),
  },
  {
    t: 0.38,
    label: 'Row back',
    easing: smoothstep,
    pose: withBasePose(ATHLETIC_STANCE, {
      leftUpperArm: [deg(12), 0, deg(34)],
      rightUpperArm: [deg(12), 0, deg(-34)],
      leftLowerArm: [deg(-82), 0, 0],
      rightLowerArm: [deg(-82), 0, 0],
      chest: [deg(12), 0, 0],
      hips: [deg(2), 0, 0],
    }),
  },
  {
    t: 1,
    label: 'Slow return',
    pose: withBasePose(ATHLETIC_STANCE, {
      leftUpperArm: [deg(-20), 0, deg(20)],
      rightUpperArm: [deg(-20), 0, deg(-20)],
      leftLowerArm: [deg(-20), 0, 0],
      rightLowerArm: [deg(-20), 0, 0],
      chest: [deg(6), 0, 0],
    }),
  },
]);

const INVERTED_ROW: AnimatorDefinition = createTimelineAnimator('invertedRow', 2.0, [
  {
    t: 0,
    label: 'Arms long',
    pose: {
      hips: [deg(-18), 0, 0],
      chest: [deg(14), 0, 0],
      leftUpperLeg: [deg(16), 0, 0],
      rightUpperLeg: [deg(16), 0, 0],
      leftUpperArm: [deg(-90), 0, deg(8)],
      rightUpperArm: [deg(-90), 0, deg(-8)],
      leftLowerArm: [deg(-18), 0, 0],
      rightLowerArm: [deg(-18), 0, 0],
    },
  },
  {
    t: 0.5,
    label: 'Chest to bar',
    pose: {
      hips: [deg(-12), 0, 0],
      chest: [deg(26), 0, 0],
      leftUpperLeg: [deg(12), 0, 0],
      rightUpperLeg: [deg(12), 0, 0],
      leftUpperArm: [deg(-54), 0, deg(18)],
      rightUpperArm: [deg(-54), 0, deg(-18)],
      leftLowerArm: [deg(-102), 0, 0],
      rightLowerArm: [deg(-102), 0, 0],
    },
  },
  { t: 1, label: 'Control down', pose: {} },
]);

const FACE_PULL: AnimatorDefinition = createTimelineAnimator('facePull', 1.8, [
  {
    t: 0,
    label: 'Arms long',
    pose: withBasePose(ATHLETIC_STANCE, {
      leftUpperArm: [deg(-12), 0, deg(24)],
      rightUpperArm: [deg(-12), 0, deg(-24)],
      leftLowerArm: [deg(-22), 0, 0],
      rightLowerArm: [deg(-22), 0, 0],
      chest: [deg(6), 0, 0],
    }),
  },
  {
    t: 0.38,
    label: 'Pull to face',
    easing: smoothstep,
    pose: withBasePose(ATHLETIC_STANCE, {
      leftUpperArm: [deg(20), 0, deg(42)],
      rightUpperArm: [deg(20), 0, deg(-42)],
      leftLowerArm: [deg(-98), 0, 0],
      rightLowerArm: [deg(-98), 0, 0],
      chest: [deg(10), 0, 0],
    }),
  },
  {
    t: 1,
    label: 'Return',
    pose: withBasePose(ATHLETIC_STANCE, {
      leftUpperArm: [deg(-12), 0, deg(24)],
      rightUpperArm: [deg(-12), 0, deg(-24)],
      leftLowerArm: [deg(-22), 0, 0],
      rightLowerArm: [deg(-22), 0, 0],
      chest: [deg(6), 0, 0],
    }),
  },
]);

const PULL_UP: AnimatorDefinition = createTimelineAnimator('pullup', 2.2, [
  {
    t: 0,
    label: 'Dead hang',
    pose: {
      leftUpperArm: [deg(-154), 0, deg(8)],
      rightUpperArm: [deg(-154), 0, deg(-8)],
      leftLowerArm: [deg(-12), 0, 0],
      rightLowerArm: [deg(-12), 0, 0],
      chest: [deg(4), 0, 0],
      leftUpperLeg: [deg(6), 0, 0],
      rightUpperLeg: [deg(6), 0, 0],
    },
  },
  {
    t: 0.22,
    label: 'Set shoulders',
    easing: smoothstep,
    pose: {
      leftUpperArm: [deg(-150), 0, deg(8)],
      rightUpperArm: [deg(-150), 0, deg(-8)],
      leftLowerArm: [deg(-18), 0, 0],
      rightLowerArm: [deg(-18), 0, 0],
      chest: [deg(8), 0, 0],
      leftUpperLeg: [deg(6), 0, 0],
      rightUpperLeg: [deg(6), 0, 0],
    },
  },
  {
    t: 0.52,
    label: 'Pull up',
    pose: {
      leftUpperArm: [deg(-126), 0, deg(14)],
      rightUpperArm: [deg(-126), 0, deg(-14)],
      leftLowerArm: [deg(-94), 0, 0],
      rightLowerArm: [deg(-94), 0, 0],
      chest: [deg(20), 0, 0],
      neck: [deg(-6), 0, 0],
      leftUpperLeg: [deg(12), 0, 0],
      rightUpperLeg: [deg(12), 0, 0],
    },
  },
  {
    t: 1,
    label: 'Lower control',
    easing: smoothstep,
    pose: {
      leftUpperArm: [deg(-154), 0, deg(8)],
      rightUpperArm: [deg(-154), 0, deg(-8)],
      leftLowerArm: [deg(-12), 0, 0],
      rightLowerArm: [deg(-12), 0, 0],
      chest: [deg(4), 0, 0],
      leftUpperLeg: [deg(6), 0, 0],
      rightUpperLeg: [deg(6), 0, 0],
    },
  },
]);

const CHIN_UP: AnimatorDefinition = createTimelineAnimator('chinup', 2.2, [
  {
    t: 0,
    label: 'Full hang',
    pose: {
      leftUpperArm: [deg(-150), 0, deg(6)],
      rightUpperArm: [deg(-150), 0, deg(-6)],
      leftLowerArm: [deg(-8), 0, 0],
      rightLowerArm: [deg(-8), 0, 0],
      chest: [deg(4), 0, 0],
    },
  },
  {
    t: 0.22,
    label: 'Set shoulders',
    easing: smoothstep,
    pose: {
      leftUpperArm: [deg(-146), 0, deg(6)],
      rightUpperArm: [deg(-146), 0, deg(-6)],
      leftLowerArm: [deg(-22), 0, 0],
      rightLowerArm: [deg(-22), 0, 0],
      chest: [deg(8), 0, 0],
    },
  },
  {
    t: 0.52,
    label: 'Chin over bar',
    pose: {
      leftUpperArm: [deg(-120), 0, deg(12)],
      rightUpperArm: [deg(-120), 0, deg(-12)],
      leftLowerArm: [deg(-112), 0, 0],
      rightLowerArm: [deg(-112), 0, 0],
      chest: [deg(22), 0, 0],
    },
  },
  {
    t: 1,
    label: 'Lower slow',
    easing: smoothstep,
    pose: {
      leftUpperArm: [deg(-150), 0, deg(6)],
      rightUpperArm: [deg(-150), 0, deg(-6)],
      leftLowerArm: [deg(-8), 0, 0],
      rightLowerArm: [deg(-8), 0, 0],
      chest: [deg(4), 0, 0],
    },
  },
]);

const HANGING_LEG_RAISE: AnimatorDefinition = createTimelineAnimator('hangingLegRaise', 2.0, [
  {
    t: 0,
    label: 'Dead hang',
    pose: {
      leftUpperArm: [deg(-152), 0, deg(8)],
      rightUpperArm: [deg(-152), 0, deg(-8)],
      leftLowerArm: [deg(-8), 0, 0],
      rightLowerArm: [deg(-8), 0, 0],
      leftUpperLeg: [deg(8), 0, 0],
      rightUpperLeg: [deg(8), 0, 0],
      leftLowerLeg: [deg(2), 0, 0],
      rightLowerLeg: [deg(2), 0, 0],
      chest: [deg(4), 0, 0],
    },
  },
  {
    t: 0.52,
    label: 'Legs up',
    pose: {
      leftUpperArm: [deg(-152), 0, deg(8)],
      rightUpperArm: [deg(-152), 0, deg(-8)],
      leftLowerArm: [deg(-8), 0, 0],
      rightLowerArm: [deg(-8), 0, 0],
      leftUpperLeg: [deg(-86), 0, 0],
      rightUpperLeg: [deg(-86), 0, 0],
      leftLowerLeg: [deg(8), 0, 0],
      rightLowerLeg: [deg(8), 0, 0],
      chest: [deg(14), 0, 0],
      hips: [deg(12), 0, 0],
    },
  },
  { t: 1, label: 'Lower slow', pose: {} },
]);

const HANGING_KNEE_RAISE: AnimatorDefinition = createTimelineAnimator('hangingKneeRaise', 1.9, [
  {
    t: 0,
    label: 'Dead hang',
    pose: {
      leftUpperArm: [deg(-152), 0, deg(8)],
      rightUpperArm: [deg(-152), 0, deg(-8)],
      leftLowerArm: [deg(-8), 0, 0],
      rightLowerArm: [deg(-8), 0, 0],
      chest: [deg(4), 0, 0],
    },
  },
  {
    t: 0.5,
    label: 'Knees to chest',
    pose: {
      leftUpperArm: [deg(-152), 0, deg(8)],
      rightUpperArm: [deg(-152), 0, deg(-8)],
      leftLowerArm: [deg(-8), 0, 0],
      rightLowerArm: [deg(-8), 0, 0],
      leftUpperLeg: [deg(-74), 0, 0],
      rightUpperLeg: [deg(-74), 0, 0],
      leftLowerLeg: [deg(84), 0, 0],
      rightLowerLeg: [deg(84), 0, 0],
      chest: [deg(12), 0, 0],
      hips: [deg(10), 0, 0],
    },
  },
  { t: 1, label: 'Lower control', pose: {} },
]);

const IDLE: AnimatorDefinition = HOLD_BREATH;

const REGISTRY: Record<string, AnimatorDefinition> = {
  hold: HOLD_BREATH,
  walk: WALK,
  inclineWalk: WALK,
  jog: JOG,
  squat: SQUAT,
  splitSquat: SPLIT_SQUAT,
  jumpSquat: JUMP_SQUAT,
  lungeWalk: LUNGE_WALK,
  calfRaise: CALF_RAISE,
  pushup: PUSH_UP,
  pushupSlow: PUSH_UP_SLOW,
  scapularPushup: SCAPULAR_PUSH_UP,
  pikePushup: PIKE_PUSH_UP,
  dip: DIP,
  benchDip: BENCH_DIP,
  plank: PLANK,
  hollowHold: HOLLOW_HOLD,
  gluteBridge: GLUTE_BRIDGE,
  nordic: NORDIC,
  hamstringSlide: HAMSTRING_SLIDE,
  bandRow: BAND_ROW,
  invertedRow: INVERTED_ROW,
  facePull: FACE_PULL,
  pullup: PULL_UP,
  chinup: CHIN_UP,
  hangingLegRaise: HANGING_LEG_RAISE,
  hangingKneeRaise: HANGING_KNEE_RAISE,
  idle: IDLE,
};

const SLUG_TO_KEY: Record<string, string> = {
  'scapular-push-up': 'scapularPushup',
  'treadmill-walk': 'walk',
  'push-up': 'pushup',
  'pike-push-up': 'pikePushup',
  dip: 'dip',
  'bench-dip': 'benchDip',
  'push-up-slow-tempo': 'pushupSlow',
  plank: 'plank',
  'hollow-body-hold': 'hollowHold',
  'glute-bridge': 'gluteBridge',
  'bodyweight-squat': 'squat',
  'bulgarian-split-squat': 'splitSquat',
  'jump-squat': 'jumpSquat',
  'nordic-curl': 'nordic',
  'hamstring-slide': 'hamstringSlide',
  'walking-lunge': 'lungeWalk',
  'calf-raise': 'calfRaise',
  'hanging-leg-raise': 'hangingLegRaise',
  'treadmill-jog': 'jog',
  'band-row': 'bandRow',
  'pull-up': 'pullup',
  'inverted-row': 'invertedRow',
  'chin-up': 'chinup',
  'face-pull-band': 'facePull',
  'hanging-knee-raise': 'hangingKneeRaise',
  'treadmill-incline-walk': 'inclineWalk',
};

export function getAnimator(slug: string, animatorKey?: string): AnimatorDefinition {
  if (animatorKey && REGISTRY[animatorKey]) {
    return REGISTRY[animatorKey];
  }

  const mapped = SLUG_TO_KEY[slug];
  if (mapped && REGISTRY[mapped]) {
    return REGISTRY[mapped];
  }

  return IDLE;
}
