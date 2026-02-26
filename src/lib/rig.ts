import { Bone, Object3D, Quaternion, Skeleton, SkinnedMesh } from 'three';

export type RigBoneKey =
  | 'hips'
  | 'spine1'
  | 'spine2'
  | 'chest'
  | 'neck'
  | 'head'
  | 'leftUpperArm'
  | 'leftLowerArm'
  | 'leftHand'
  | 'rightUpperArm'
  | 'rightLowerArm'
  | 'rightHand'
  | 'leftUpperLeg'
  | 'leftLowerLeg'
  | 'leftFoot'
  | 'leftToe'
  | 'rightUpperLeg'
  | 'rightLowerLeg'
  | 'rightFoot'
  | 'rightToe';

export type RigBones = Partial<Record<RigBoneKey, Bone>>;
export type RigRestPose = Partial<Record<RigBoneKey, Quaternion>>;
export type RigType = 'mixamo' | 'custom' | 'unknown';

export type NormalizedRig = {
  bones: RigBones;
  skeleton: Skeleton;
  skinnedMeshes: SkinnedMesh[];
  restPoseQuats: RigRestPose;
};

export type RigFailureInfo = {
  boneCount: number;
  sampleNames: string[];
  missing: string[];
  detectedRigType: RigType;
  found: RigBoneKey[];
};

type NamedBone = {
  bone: Bone;
  rawName: string;
  sideName: string;
  patternName: string;
  lookupName: string;
  side: 'left' | 'right' | null;
};

const COMMON_PREFIXES = ['mixamorig', 'armature', 'rig', 'skeleton', 'bip001', 'bip01', 'ccbase', 'jnt', 'bone'];

function escapeRegExp(value: string) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function stripCommonPrefixes(input: string) {
  let value = input.trim();
  let changed = true;

  while (changed && value) {
    changed = false;

    for (const prefix of COMMON_PREFIXES) {
      const prefixRegex = new RegExp(`^${escapeRegExp(prefix)}(?:[:|._-]+)`, 'i');
      if (prefixRegex.test(value)) {
        value = value.replace(prefixRegex, '');
        changed = true;
        continue;
      }

      if (value.toLowerCase() === prefix) {
        value = '';
        changed = true;
        continue;
      }

      // Allow prefixes glued to camelCase names (mixamorigRightArm, rigHips, etc.)
      if (value.length > prefix.length && value.slice(0, prefix.length).toLowerCase() === prefix) {
        const nextChar = value.charAt(prefix.length);
        if (nextChar >= 'A' && nextChar <= 'Z') {
          value = value.slice(prefix.length);
          changed = true;
        }
      }
    }
  }

  return value;
}

function normalizeForSideDetection(input: string) {
  return stripCommonPrefixes(input)
    .replace(/([a-z])([A-Z])/g, '$1_$2')
    .replace(/[:|]/g, '_')
    .replace(/[.\-\s]+/g, '_')
    .replace(/_+/g, '_')
    .toLowerCase();
}

function normalizeForPatternMatching(input: string) {
  return input
    .toLowerCase()
    .replace(/[._-]/g, '')
    .replace(/[^a-z0-9]/g, '');
}

function detectSide(sideName: string): 'left' | 'right' | null {
  const value = sideName.toLowerCase();

  // Check explicit side words first, including camelCase-normalized forms.
  if (value.startsWith('left') || /(^|[^a-z])left/.test(value)) {
    return 'left';
  }
  if (value.startsWith('right') || /(^|[^a-z])right/.test(value)) {
    return 'right';
  }

  const tokens = value.split(/[^a-z0-9]+/).filter(Boolean);

  if (tokens.includes('left')) {
    return 'left';
  }
  if (tokens.includes('right')) {
    return 'right';
  }

  if (/([._-]|^)l(\d+)?$/.test(value) || /^l[._-]/.test(value)) {
    return 'left';
  }
  if (/([._-]|^)r(\d+)?$/.test(value) || /^r[._-]/.test(value)) {
    return 'right';
  }

  const hasLeftToken = tokens.includes('l');
  const hasRightToken = tokens.includes('r');
  if (hasLeftToken && !hasRightToken) {
    return 'left';
  }
  if (hasRightToken && !hasLeftToken) {
    return 'right';
  }

  const compact = value.replace(/[^a-z0-9]/g, '');
  if (/^l(arm|forearm|hand|wrist|upperarm|lowerarm|thigh|leg|calf|foot|toe)/.test(compact)) {
    return 'left';
  }
  if (/^r(arm|forearm|hand|wrist|upperarm|lowerarm|thigh|leg|calf|foot|toe)/.test(compact)) {
    return 'right';
  }

  return null;
}

function collectNamedBones(skeleton: Skeleton): NamedBone[] {
  return skeleton.bones.map((bone) => {
    const sideName = normalizeForSideDetection(bone.name);
    const stripped = stripCommonPrefixes(bone.name);

    return {
      bone,
      rawName: bone.name,
      sideName,
      patternName: normalizeForPatternMatching(sideName),
      lookupName: normalizeForPatternMatching(stripped),
      side: detectSide(sideName),
    };
  });
}

function detectRigType(namedBones: NamedBone[]): RigType {
  if (!namedBones.length) {
    return 'unknown';
  }

  const hasMixamo = namedBones.some((entry) => /^mixamorig(?:$|[:._-]|[A-Z])/.test(entry.rawName) || entry.rawName.toLowerCase().startsWith('mixamorig'));
  if (hasMixamo) {
    return 'mixamo';
  }

  return 'custom';
}

function scoreByPatterns(name: string, patterns: RegExp[], exclusion?: RegExp[]) {
  if (exclusion?.some((regex) => regex.test(name))) {
    return -1;
  }

  for (let index = 0; index < patterns.length; index += 1) {
    if (patterns[index].test(name)) {
      return patterns.length - index;
    }
  }

  return -1;
}

function pickBone(
  namedBones: NamedBone[],
  used: Set<string>,
  patterns: RegExp[],
  exclusion?: RegExp[],
  side?: 'left' | 'right',
): Bone | undefined {
  let bestBone: NamedBone | null = null;
  let bestScore = -1;

  for (const entry of namedBones) {
    const boneId = `${entry.rawName}_${entry.bone.id}`;
    if (used.has(boneId)) {
      continue;
    }

    if (side && entry.side !== side) {
      continue;
    }

    const score = scoreByPatterns(entry.patternName, patterns, exclusion);
    if (score > bestScore) {
      bestScore = score;
      bestBone = entry;
    }
  }

  if (!bestBone) {
    return undefined;
  }

  used.add(`${bestBone.rawName}_${bestBone.bone.id}`);
  return bestBone.bone;
}

function pickByLookup(
  namedBones: NamedBone[],
  used: Set<string>,
  candidates: string[],
  side?: 'left' | 'right',
): Bone | undefined {
  const normalizedCandidates = candidates.map((candidate) => normalizeForPatternMatching(candidate));

  for (const candidate of normalizedCandidates) {
    for (const entry of namedBones) {
      const boneId = `${entry.rawName}_${entry.bone.id}`;
      if (used.has(boneId)) {
        continue;
      }

      if (side && entry.side !== side) {
        continue;
      }

      if (entry.lookupName === candidate || entry.lookupName.endsWith(candidate)) {
        used.add(boneId);
        return entry.bone;
      }
    }
  }

  return undefined;
}

function discoverSkeleton(root: Object3D) {
  const skinnedMeshes: SkinnedMesh[] = [];

  root.traverse((object) => {
    if ((object as SkinnedMesh).isSkinnedMesh) {
      const mesh = object as SkinnedMesh;
      if (mesh.skeleton?.bones?.length) {
        skinnedMeshes.push(mesh);
      }
    }
  });

  if (!skinnedMeshes.length) {
    return null;
  }

  const primaryMesh = [...skinnedMeshes].sort((a, b) => b.skeleton.bones.length - a.skeleton.bones.length)[0];
  return {
    skeleton: primaryMesh.skeleton,
    skinnedMeshes,
  };
}

function spineLikeScore(entry: NamedBone) {
  const pattern = entry.patternName;
  const sideName = entry.sideName;
  const spineNumber = sideName.match(/(?:spine|spn)[._-]*0*([0-9]+)/);
  if (spineNumber) {
    return Number.parseInt(spineNumber[1], 10);
  }

  if (/upperchest|chest|thorax|ribcage/.test(pattern)) {
    return 999;
  }
  if (/abdomen|lowerback/.test(pattern)) {
    return 1;
  }
  if (/spine|back|spn/.test(pattern)) {
    return 2;
  }

  return 0;
}

function collectSpineLikeBones(namedBones: NamedBone[]) {
  return namedBones
    .filter((entry) => entry.side == null)
    .filter((entry) => /(spine|abdomen|back|spn|chest|thorax|ribcage)/.test(entry.patternName))
    .sort((a, b) => spineLikeScore(a) - spineLikeScore(b));
}

function applyStructuralFallbacks(bones: RigBones, spineLikeBones: NamedBone[]) {
  const firstSpineLike = spineLikeBones[0]?.bone;
  const highestSpineLike = spineLikeBones[spineLikeBones.length - 1]?.bone;

  if (!bones.spine1 && firstSpineLike) {
    bones.spine1 = firstSpineLike;
  }

  if (!bones.chest) {
    bones.chest = bones.spine2 ?? bones.spine1 ?? highestSpineLike;
  }

  if (!bones.spine2 && bones.chest) {
    bones.spine2 = bones.chest;
  }

  if (!bones.spine1 && firstSpineLike) {
    bones.spine1 = firstSpineLike;
  }

  if (!bones.head && bones.neck) {
    bones.head = bones.neck;
  }
}

function getMissingCriticalBones(bones: RigBones): string[] {
  const missing: string[] = [];

  if (!bones.hips) {
    missing.push('hips');
  }
  if (!(bones.spine1 || bones.spine2 || bones.chest)) {
    missing.push('spine/chest');
  }

  const required: RigBoneKey[] = [
    'leftUpperArm',
    'leftLowerArm',
    'rightUpperArm',
    'rightLowerArm',
    'leftUpperLeg',
    'leftLowerLeg',
    'rightUpperLeg',
    'rightLowerLeg',
    'leftFoot',
    'rightFoot',
  ];

  for (const key of required) {
    if (!bones[key]) {
      missing.push(key);
    }
  }

  return missing;
}

function applyMixamoMapping(namedBones: NamedBone[], used: Set<string>, bones: RigBones) {
  bones.hips = bones.hips ?? pickByLookup(namedBones, used, ['Hips']);
  bones.spine1 = bones.spine1 ?? pickByLookup(namedBones, used, ['Spine']);
  bones.spine2 = bones.spine2 ?? pickByLookup(namedBones, used, ['Spine1']);
  bones.chest = bones.chest ?? pickByLookup(namedBones, used, ['Spine2']);
  bones.neck = bones.neck ?? pickByLookup(namedBones, used, ['Neck']);
  bones.head = bones.head ?? pickByLookup(namedBones, used, ['Head']);

  bones.leftUpperArm =
    bones.leftUpperArm ??
    pickByLookup(namedBones, used, ['LeftArm'], 'left') ??
    pickByLookup(namedBones, used, ['LeftShoulder'], 'left');
  bones.leftLowerArm = bones.leftLowerArm ?? pickByLookup(namedBones, used, ['LeftForeArm'], 'left');
  bones.leftHand = bones.leftHand ?? pickByLookup(namedBones, used, ['LeftHand'], 'left');

  bones.rightUpperArm =
    bones.rightUpperArm ??
    pickByLookup(namedBones, used, ['RightArm'], 'right') ??
    pickByLookup(namedBones, used, ['RightShoulder'], 'right');
  bones.rightLowerArm = bones.rightLowerArm ?? pickByLookup(namedBones, used, ['RightForeArm'], 'right');
  bones.rightHand = bones.rightHand ?? pickByLookup(namedBones, used, ['RightHand'], 'right');

  bones.leftUpperLeg = bones.leftUpperLeg ?? pickByLookup(namedBones, used, ['LeftUpLeg'], 'left');
  bones.leftLowerLeg = bones.leftLowerLeg ?? pickByLookup(namedBones, used, ['LeftLeg'], 'left');
  bones.leftFoot = bones.leftFoot ?? pickByLookup(namedBones, used, ['LeftFoot'], 'left');
  bones.leftToe = bones.leftToe ?? pickByLookup(namedBones, used, ['LeftToeBase'], 'left');

  bones.rightUpperLeg = bones.rightUpperLeg ?? pickByLookup(namedBones, used, ['RightUpLeg'], 'right');
  bones.rightLowerLeg = bones.rightLowerLeg ?? pickByLookup(namedBones, used, ['RightLeg'], 'right');
  bones.rightFoot = bones.rightFoot ?? pickByLookup(namedBones, used, ['RightFoot'], 'right');
  bones.rightToe = bones.rightToe ?? pickByLookup(namedBones, used, ['RightToeBase'], 'right');
}

function applyFuzzyMapping(namedBones: NamedBone[], used: Set<string>, bones: RigBones) {
  bones.hips =
    bones.hips ??
    pickBone(
      namedBones,
      used,
      [/torsojoint1$/, /(hips|pelvis|hip|root|cog)$/],
      [/thigh|upleg|upperleg|femur|calf|shin|foot|toe/],
    );

  bones.spine1 =
    bones.spine1 ??
    pickBone(namedBones, used, [/torsojoint2$/, /spine0*1$/, /spine1/, /spn1/, /^spine$/, /abdomen/, /lowerback/, /back/]);
  bones.spine2 =
    bones.spine2 ??
    pickBone(namedBones, used, [/torsojoint3$/, /spine0*2$/, /spine0*3$/, /spine2/, /spine3/, /spn2/, /spn3/, /upperback/]);
  bones.chest =
    bones.chest ??
    pickBone(namedBones, used, [/torsojoint3$/, /upperchest/, /chest/, /thorax/, /ribcage/, /spine0*3$/, /spine0*2$/]);
  bones.neck = bones.neck ?? pickBone(namedBones, used, [/neckjoint1$/, /neck/, /cervical/]);
  bones.head = bones.head ?? pickBone(namedBones, used, [/neckjoint2$/, /head$/, /headtop/, /skull/, /cranium/]);

  bones.leftUpperArm =
    bones.leftUpperArm ??
    pickBone(
      namedBones,
      used,
      [/armjointl1$/, /upperarm/, /uparm/, /humerus/, /arm/],
      [/lowerarm|forearm|loarm|radius|ulna|hand|wrist|palm/],
      'left',
    );
  bones.leftLowerArm =
    bones.leftLowerArm ??
    pickBone(
      namedBones,
      used,
      [/armjointl2$/, /lowerarm/, /forearm/, /loarm/, /radius/, /ulna/, /arm/],
      [/upperarm|uparm|humerus|hand|wrist|palm/],
      'left',
    );
  bones.leftHand = bones.leftHand ?? pickBone(namedBones, used, [/armjointl3$/, /hand/, /wrist/, /palm/], undefined, 'left');

  bones.rightUpperArm =
    bones.rightUpperArm ??
    pickBone(
      namedBones,
      used,
      [/armjointr1$/, /upperarm/, /uparm/, /humerus/, /arm/],
      [/lowerarm|forearm|loarm|radius|ulna|hand|wrist|palm/],
      'right',
    );
  bones.rightLowerArm =
    bones.rightLowerArm ??
    pickBone(
      namedBones,
      used,
      [/armjointr2$/, /lowerarm/, /forearm/, /loarm/, /radius/, /ulna/, /arm/],
      [/upperarm|uparm|humerus|hand|wrist|palm/],
      'right',
    );
  bones.rightHand = bones.rightHand ?? pickBone(namedBones, used, [/armjointr3$/, /hand/, /wrist/, /palm/], undefined, 'right');

  // Shoulder is not primary arm mapping, only a fallback when upper arm is missing.
  bones.leftUpperArm = bones.leftUpperArm ?? pickBone(namedBones, used, [/shoulder/], undefined, 'left');
  bones.rightUpperArm = bones.rightUpperArm ?? pickBone(namedBones, used, [/shoulder/], undefined, 'right');

  bones.leftUpperLeg =
    bones.leftUpperLeg ??
    pickBone(
      namedBones,
      used,
      [/legjointl1$/, /thigh/, /upperleg/, /upleg/, /femur/, /leg/],
      [/lowerleg|loleg|calf|shin|tibia|foot|ankle|toe|ball/],
      'left',
    );
  bones.leftLowerLeg =
    bones.leftLowerLeg ??
    pickBone(
      namedBones,
      used,
      [/legjointl2$/, /lowerleg/, /loleg/, /calf/, /shin/, /tibia/, /leg/],
      [/upperleg|upleg|thigh|femur|foot|ankle|toe|ball/],
      'left',
    );
  bones.leftFoot =
    bones.leftFoot ?? pickBone(namedBones, used, [/legjointl3$/, /legjointl5$/, /foot/, /ankle/], [/toe|ball/], 'left');
  bones.leftToe = bones.leftToe ?? pickBone(namedBones, used, [/legjointl5$/, /toe/, /toebase/, /ball/], undefined, 'left');

  bones.rightUpperLeg =
    bones.rightUpperLeg ??
    pickBone(
      namedBones,
      used,
      [/legjointr1$/, /thigh/, /upperleg/, /upleg/, /femur/, /leg/],
      [/lowerleg|loleg|calf|shin|tibia|foot|ankle|toe|ball/],
      'right',
    );
  bones.rightLowerLeg =
    bones.rightLowerLeg ??
    pickBone(
      namedBones,
      used,
      [/legjointr2$/, /lowerleg/, /loleg/, /calf/, /shin/, /tibia/, /leg/],
      [/upperleg|upleg|thigh|femur|foot|ankle|toe|ball/],
      'right',
    );
  bones.rightFoot =
    bones.rightFoot ?? pickBone(namedBones, used, [/legjointr3$/, /legjointr5$/, /foot/, /ankle/], [/toe|ball/], 'right');
  bones.rightToe = bones.rightToe ?? pickBone(namedBones, used, [/legjointr5$/, /toe/, /toebase/, /ball/], undefined, 'right');
}

function applyJointChainFallback(namedBones: NamedBone[], bones: RigBones) {
  const missingAfterFuzzy = getMissingCriticalBones(bones);
  if (!missingAfterFuzzy.length) {
    return;
  }

  const byPatternName = new Map<string, Bone>();
  for (const entry of namedBones) {
    byPatternName.set(entry.patternName, entry.bone);
  }

  const hasJointChain =
    byPatternName.has('torsojoint1') &&
    byPatternName.has('torsojoint2') &&
    byPatternName.has('torsojoint3') &&
    byPatternName.has('armjointl1') &&
    byPatternName.has('armjointl2') &&
    byPatternName.has('armjointl3') &&
    byPatternName.has('armjointr1') &&
    byPatternName.has('armjointr2') &&
    byPatternName.has('armjointr3') &&
    byPatternName.has('legjointl1') &&
    byPatternName.has('legjointl2') &&
    (byPatternName.has('legjointl3') || byPatternName.has('legjointl5')) &&
    byPatternName.has('legjointr1') &&
    byPatternName.has('legjointr2') &&
    (byPatternName.has('legjointr3') || byPatternName.has('legjointr5'));

  if (!hasJointChain) {
    return;
  }

  bones.hips = bones.hips ?? byPatternName.get('torsojoint1');
  bones.spine1 = bones.spine1 ?? byPatternName.get('torsojoint2');
  bones.spine2 = bones.spine2 ?? byPatternName.get('torsojoint3');
  bones.chest = bones.chest ?? byPatternName.get('torsojoint3');
  bones.neck = bones.neck ?? byPatternName.get('neckjoint1');
  bones.head = bones.head ?? byPatternName.get('neckjoint2') ?? byPatternName.get('neckjoint1');

  bones.leftUpperArm = bones.leftUpperArm ?? byPatternName.get('armjointl1');
  bones.leftLowerArm = bones.leftLowerArm ?? byPatternName.get('armjointl2');
  bones.leftHand = bones.leftHand ?? byPatternName.get('armjointl3');
  bones.rightUpperArm = bones.rightUpperArm ?? byPatternName.get('armjointr1');
  bones.rightLowerArm = bones.rightLowerArm ?? byPatternName.get('armjointr2');
  bones.rightHand = bones.rightHand ?? byPatternName.get('armjointr3');

  bones.leftUpperLeg = bones.leftUpperLeg ?? byPatternName.get('legjointl1');
  bones.leftLowerLeg = bones.leftLowerLeg ?? byPatternName.get('legjointl2');
  bones.leftFoot = bones.leftFoot ?? byPatternName.get('legjointl3') ?? byPatternName.get('legjointl5');
  bones.leftToe = bones.leftToe ?? byPatternName.get('legjointl5');
  bones.rightUpperLeg = bones.rightUpperLeg ?? byPatternName.get('legjointr1');
  bones.rightLowerLeg = bones.rightLowerLeg ?? byPatternName.get('legjointr2');
  bones.rightFoot = bones.rightFoot ?? byPatternName.get('legjointr3') ?? byPatternName.get('legjointr5');
  bones.rightToe = bones.rightToe ?? byPatternName.get('legjointr5');
}

function mapBones(namedBones: NamedBone[], detectedRigType: RigType): RigBones {
  const used = new Set<string>();
  const spineLikeBones = collectSpineLikeBones(namedBones);
  const bones: RigBones = {};

  if (detectedRigType === 'mixamo') {
    applyMixamoMapping(namedBones, used, bones);
  }

  applyFuzzyMapping(namedBones, used, bones);
  applyJointChainFallback(namedBones, bones);
  applyStructuralFallbacks(bones, spineLikeBones);

  return bones;
}

function buildRestPose(bones: RigBones): RigRestPose {
  const restPoseQuats: RigRestPose = {};
  for (const [key, bone] of Object.entries(bones) as Array<[RigBoneKey, Bone | undefined]>) {
    if (bone) {
      restPoseQuats[key] = bone.quaternion.clone();
    }
  }
  return restPoseQuats;
}

export function explainRigFailure(root: Object3D): RigFailureInfo {
  const skeletonInfo = discoverSkeleton(root);
  if (!skeletonInfo) {
    return {
      boneCount: 0,
      sampleNames: [],
      missing: ['skeleton'],
      detectedRigType: 'unknown',
      found: [],
    };
  }

  const namedBones = collectNamedBones(skeletonInfo.skeleton);
  const detectedRigType = detectRigType(namedBones);
  const bones = mapBones(namedBones, detectedRigType);

  return {
    boneCount: namedBones.length,
    sampleNames: namedBones.map((entry) => entry.rawName).slice(0, 40),
    missing: getMissingCriticalBones(bones),
    detectedRigType,
    found: (Object.keys(bones) as RigBoneKey[]).filter((key) => Boolean(bones[key])),
  };
}

export function buildNormalizedRig(root: Object3D): NormalizedRig | null {
  const skeletonInfo = discoverSkeleton(root);
  if (!skeletonInfo) {
    return null;
  }

  const namedBones = collectNamedBones(skeletonInfo.skeleton);
  const detectedRigType = detectRigType(namedBones);
  const bones = mapBones(namedBones, detectedRigType);

  if (getMissingCriticalBones(bones).length) {
    return null;
  }

  return {
    bones,
    skeleton: skeletonInfo.skeleton,
    skinnedMeshes: skeletonInfo.skinnedMeshes,
    restPoseQuats: buildRestPose(bones),
  };
}

export function getRigBoneList(rig: NormalizedRig) {
  return Object.values(rig.bones).filter((bone): bone is Bone => Boolean(bone));
}
