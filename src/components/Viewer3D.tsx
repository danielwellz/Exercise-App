import {
  Component,
  Suspense,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react';
import { Canvas, useFrame, useThree } from '@react-three/fiber';
import { ContactShadows, Environment, OrbitControls, useGLTF } from '@react-three/drei';
import {
  Box3,
  Color,
  Group,
  InstancedMesh,
  Matrix4,
  Object3D,
  PerspectiveCamera,
  Quaternion,
  SkeletonHelper,
  Vector3,
  type Material,
  type Mesh,
  type SkinnedMesh,
} from 'three';
import type { OrbitControls as OrbitControlsImpl } from 'three-stdlib';
import type { GLTF } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { clone } from 'three/examples/jsm/utils/SkeletonUtils.js';
import { CHARACTERS } from '../data/characters';
import type { CameraPreset, ExerciseMove, GroundMode } from '../data/moves';
import {
  applyCameraFrame,
  computeBaseFraming,
  computeCharacterBounds,
  getPresetFrame,
  type BoundsInfo,
} from '../lib/cameraFit';
import { applyGroundingOffset } from '../lib/grounding';
import { getAnimator } from '../lib/procedural';
import {
  buildNormalizedRig,
  explainRigFailure,
  getRigBoneList,
  type NormalizedRig,
  type RigFailureInfo,
} from '../lib/rig';

type CharacterModelProps = {
  modelUrl: string;
  modelScale?: number;
  modelRotationY?: number;
  modelYOffset?: number;
  flipFacing?: boolean;
  characterName?: string;
};

type Viewer3DProps = CharacterModelProps & {
  move: ExerciseMove;
  playing: boolean;
  speed: number;
  cameraPreset: CameraPreset;
  showSkeleton: boolean;
  showMesh: boolean;
  showJoints: boolean;
  highlightTargets: boolean;
  globalRotationY?: number;
  forcedTNorm?: number | null;
  quality?: 'high' | 'low';
  interactive?: boolean;
  className?: string;
  onRepChange?: (value: number) => void;
  onPhaseChange?: (value: string) => void;
  onLoopDurationChange?: (durationSeconds: number) => void;
  onCanvasReady?: (canvas: HTMLCanvasElement | null) => void;
  onModelMetrics?: (metrics: ModelMetrics) => void;
};

type RigState = 'loading' | 'loaded' | 'fallback';
type BoundsSource = 'rig' | 'fallback';

export type ModelMetrics = {
  height: number;
  minY: number;
  maxY: number;
  width: number;
  depth: number;
  centerY: number;
  source: BoundsSource;
};

type ErrorBoundaryProps = {
  children: ReactNode;
  onError: (error: Error) => void;
  resetKey: string;
};

type ErrorBoundaryState = {
  hasError: boolean;
};

class ModelErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
  state: ErrorBoundaryState = {
    hasError: false,
  };

  static getDerivedStateFromError() {
    return { hasError: true };
  }

  componentDidCatch(error: Error) {
    this.props.onError(error);
  }

  componentDidUpdate(prevProps: ErrorBoundaryProps) {
    if (prevProps.resetKey !== this.props.resetKey && this.state.hasError) {
      this.setState({ hasError: false });
    }
  }

  render() {
    if (this.state.hasError) {
      return null;
    }

    return this.props.children;
  }
}

const DEFAULT_BOUNDS: BoundsInfo = {
  box: new Box3(new Vector3(-0.7, 0, -0.4), new Vector3(0.7, 1.9, 0.4)),
  center: new Vector3(0, 0.95, 0),
  size: new Vector3(1.4, 1.9, 0.8),
  maxDimension: 1.9,
};

const CAMERA_FIT_SAMPLE_TIMES = [0, 0.2, 0.4, 0.6, 0.8, 0.95] as const;

const CATEGORY_HIGHLIGHT: Record<ExerciseMove['category'], string> = {
  push: '#ff7b5c',
  pull: '#4f7cff',
  legs: '#f4b000',
  core: '#15b8a6',
  cardio: '#ef4c9b',
  mobility: '#8f67ff',
};

type MuscleMarker = {
  positions: [number, number, number][];
  radius: number;
};

const MUSCLE_MARKERS: Record<string, MuscleMarker> = {
  chest: { positions: [[0, 1.42, 0.17]], radius: 0.16 },
  triceps: {
    positions: [
      [-0.32, 1.3, 0.04],
      [0.32, 1.3, 0.04],
    ],
    radius: 0.09,
  },
  'front-delts': {
    positions: [
      [-0.2, 1.46, 0.14],
      [0.2, 1.46, 0.14],
    ],
    radius: 0.09,
  },
  shoulders: {
    positions: [
      [-0.22, 1.48, 0.05],
      [0.22, 1.48, 0.05],
    ],
    radius: 0.1,
  },
  'upper-back': {
    positions: [[0, 1.42, -0.14]],
    radius: 0.14,
  },
  'mid-back': {
    positions: [[0, 1.3, -0.13]],
    radius: 0.14,
  },
  lats: {
    positions: [
      [-0.26, 1.3, -0.08],
      [0.26, 1.3, -0.08],
    ],
    radius: 0.11,
  },
  biceps: {
    positions: [
      [-0.3, 1.35, 0.08],
      [0.3, 1.35, 0.08],
    ],
    radius: 0.08,
  },
  'rear-delts': {
    positions: [
      [-0.2, 1.46, -0.12],
      [0.2, 1.46, -0.12],
    ],
    radius: 0.09,
  },
  'rotator-cuff': {
    positions: [
      [-0.19, 1.43, -0.03],
      [0.19, 1.43, -0.03],
    ],
    radius: 0.08,
  },
  glutes: { positions: [[0, 1.02, -0.08]], radius: 0.16 },
  quads: {
    positions: [
      [-0.14, 0.73, 0.1],
      [0.14, 0.73, 0.1],
    ],
    radius: 0.13,
  },
  hamstrings: {
    positions: [
      [-0.14, 0.7, -0.08],
      [0.14, 0.7, -0.08],
    ],
    radius: 0.12,
  },
  calves: {
    positions: [
      [-0.13, 0.33, -0.03],
      [0.13, 0.33, -0.03],
    ],
    radius: 0.1,
  },
  adductors: { positions: [[0, 0.75, 0.02]], radius: 0.11 },
  core: { positions: [[0, 1.12, 0.13]], radius: 0.16 },
  'lower-abs': { positions: [[0, 1.0, 0.12]], radius: 0.13 },
  'hip-flexors': {
    positions: [
      [-0.1, 0.96, 0.08],
      [0.1, 0.96, 0.08],
    ],
    radius: 0.09,
  },
  serratus: {
    positions: [
      [-0.2, 1.3, 0.12],
      [0.2, 1.3, 0.12],
    ],
    radius: 0.09,
  },
};

const tmpVec = new Vector3();

function toBoundsInfo(box: Box3): BoundsInfo {
  const center = box.getCenter(new Vector3());
  const size = box.getSize(new Vector3());
  return {
    box: box.clone(),
    center,
    size,
    maxDimension: Math.max(size.x, size.y, size.z, 0.001),
  };
}

function isRenderableMesh(object: Object3D): object is Mesh | SkinnedMesh {
  return (object as Mesh).isMesh === true || (object as SkinnedMesh).isSkinnedMesh === true;
}

function getPhaseLabel(move: ExerciseMove, tNorm: number) {
  const normalized = ((tNorm % 1) + 1) % 1;
  const phases = move.phases ?? [];
  if (!phases.length) {
    return '';
  }

  let active = phases[0].label;
  for (const phase of phases) {
    if (phase.t <= normalized) {
      active = phase.label;
    }
  }
  return active;
}

function collectRenderableMaterials(root: Object3D) {
  const materials: Array<Material & { emissive?: Color; emissiveIntensity?: number }> = [];

  root.traverse((object) => {
    if (!isRenderableMesh(object)) {
      return;
    }

    if (Array.isArray(object.material)) {
      for (const material of object.material) {
        materials.push(material as Material & { emissive?: Color; emissiveIntensity?: number });
      }
    } else if (object.material) {
      materials.push(object.material as Material & { emissive?: Color; emissiveIntensity?: number });
    }
  });

  return materials;
}

function JointMarkers({ bones, visible, color }: { bones: Object3D[]; visible: boolean; color: string }) {
  const instanceRef = useRef<InstancedMesh | null>(null);
  const matrix = useMemo(() => new Matrix4(), []);
  const quaternion = useMemo(() => new Quaternion(), []);
  const scale = useMemo(() => new Vector3(1, 1, 1), []);

  useFrame(() => {
    const instance = instanceRef.current;
    if (!instance || !visible) {
      return;
    }

    bones.forEach((bone, index) => {
      bone.getWorldPosition(tmpVec);
      matrix.compose(tmpVec, quaternion, scale);
      instance.setMatrixAt(index, matrix);
    });

    instance.instanceMatrix.needsUpdate = true;
  });

  if (!bones.length) {
    return null;
  }

  return (
    <instancedMesh ref={instanceRef} args={[undefined, undefined, bones.length]} visible={visible}>
      <sphereGeometry args={[0.025, 10, 10]} />
      <meshStandardMaterial color={color} emissive={color} emissiveIntensity={0.5} />
    </instancedMesh>
  );
}

function TargetMuscleOverlays({ move, bounds }: { move: ExerciseMove; bounds: BoundsInfo }) {
  const color = new Color(CATEGORY_HIGHLIGHT[move.category]);
  const markers = move.targetMuscles
    .map((muscle) => MUSCLE_MARKERS[muscle])
    .filter((marker): marker is MuscleMarker => Boolean(marker));

  if (!markers.length) {
    return null;
  }

  return (
    <group position={[bounds.center.x, bounds.box.min.y, bounds.center.z]} scale={[bounds.size.y / 1.8, bounds.size.y / 1.8, bounds.size.y / 1.8]}>
      {markers.map((marker, markerIndex) =>
        marker.positions.map((position, pointIndex) => (
          <mesh key={`${markerIndex}-${pointIndex}`} position={position} castShadow={false} receiveShadow={false}>
            <sphereGeometry args={[marker.radius, 18, 18]} />
            <meshStandardMaterial
              color={color}
              emissive={color}
              emissiveIntensity={0.45}
              transparent
              opacity={0.35}
              depthWrite={false}
            />
          </mesh>
        )),
      )}
    </group>
  );
}

function TrainerCamera({
  bounds,
  preset,
  interactive,
  resetSignal,
}: {
  bounds: BoundsInfo;
  preset: CameraPreset;
  interactive: boolean;
  resetSignal: number;
}) {
  const controlsRef = useRef<OrbitControlsImpl | null>(null);
  const { camera, size } = useThree();

  const baseRef = useRef(computeBaseFraming(bounds, camera as PerspectiveCamera, size.width / Math.max(1, size.height)));
  const desiredRef = useRef(getPresetFrame(baseRef.current, preset));
  const didInitRef = useRef(false);

  useEffect(() => {
    baseRef.current = computeBaseFraming(bounds, camera as PerspectiveCamera, size.width / Math.max(1, size.height));
    desiredRef.current = getPresetFrame(baseRef.current, preset);

    if (!didInitRef.current) {
      applyCameraFrame(camera as PerspectiveCamera, controlsRef.current, desiredRef.current, true);
      didInitRef.current = true;
    }
  }, [bounds, preset, camera, size.width, size.height]);

  useEffect(() => {
    desiredRef.current = getPresetFrame(baseRef.current, preset);
    applyCameraFrame(camera as PerspectiveCamera, controlsRef.current, desiredRef.current, true);
  }, [resetSignal, preset, camera]);

  useFrame(() => {
    if (!didInitRef.current) {
      return;
    }

    applyCameraFrame(camera as PerspectiveCamera, controlsRef.current, desiredRef.current, false);
  });

  return (
    <OrbitControls
      ref={controlsRef}
      enablePan={false}
      enableDamping
      dampingFactor={0.08}
      minDistance={1.2}
      maxDistance={30}
      enabled={interactive}
      maxPolarAngle={Math.PI / 2.02}
    />
  );
}

function createFallbackLoopDuration(move: ExerciseMove) {
  const key = move.animatorKey ?? '';
  if (key === 'pushupSlow') {
    return 5;
  }
  if (key === 'plank' || key === 'hollowHold' || key === 'hold') {
    return 3.2;
  }
  if (move.category === 'cardio') {
    return move.slug === 'treadmill-jog' ? 1 : 1.5;
  }
  return 2.2;
}

type FallbackJointRefs = {
  pelvis: Group | null;
  chest: Group | null;
  head: Group | null;
  leftElbow: Group | null;
  rightElbow: Group | null;
  leftHand: Group | null;
  rightHand: Group | null;
  leftKnee: Group | null;
  rightKnee: Group | null;
  leftFoot: Group | null;
  rightFoot: Group | null;
};

function buildFallbackJointRefs(): FallbackJointRefs {
  return {
    pelvis: null,
    chest: null,
    head: null,
    leftElbow: null,
    rightElbow: null,
    leftHand: null,
    rightHand: null,
    leftKnee: null,
    rightKnee: null,
    leftFoot: null,
    rightFoot: null,
  };
}

function FallbackMannequin({
  move,
  playing,
  speed,
  showMesh,
  showJoints,
  showSkeleton,
  highlightTargets,
  forcedTNorm,
  modelScale,
  modelRotationY,
  modelYOffset,
  onLoopDurationChange,
  onTNorm,
  onBoundsChange,
}: {
  move: ExerciseMove;
  playing: boolean;
  speed: number;
  showMesh: boolean;
  showJoints: boolean;
  showSkeleton: boolean;
  highlightTargets: boolean;
  forcedTNorm: number | null;
  modelScale: number;
  modelRotationY: number;
  modelYOffset: number;
  onLoopDurationChange?: (value: number) => void;
  onTNorm: (value: number) => void;
  onBoundsChange: (bounds: BoundsInfo, source: BoundsSource) => void;
}) {
  const rootRef = useRef<Group>(null);
  const torsoRef = useRef<Group>(null);
  const leftArmRef = useRef<Group>(null);
  const rightArmRef = useRef<Group>(null);
  const leftForearmRef = useRef<Group>(null);
  const rightForearmRef = useRef<Group>(null);
  const leftThighRef = useRef<Group>(null);
  const rightThighRef = useRef<Group>(null);
  const leftShinRef = useRef<Group>(null);
  const rightShinRef = useRef<Group>(null);

  const localClockRef = useRef(0);
  const joints = useRef<FallbackJointRefs>(buildFallbackJointRefs());

  const loopDuration = useMemo(() => createFallbackLoopDuration(move), [move]);

  useEffect(() => {
    localClockRef.current = 0;
    onLoopDurationChange?.(loopDuration);
  }, [loopDuration, move.slug, onLoopDurationChange]);

  const applyMannequinPose = useCallback(
    (t: number) => {
      if (!rootRef.current) {
        return;
      }

      const wave = Math.sin(t * Math.PI * 2);
      const half = Math.sin(t * Math.PI);

      rootRef.current.scale.setScalar(modelScale);
      rootRef.current.position.y = modelYOffset;
      rootRef.current.rotation.y = modelRotationY;

      if (torsoRef.current) {
        torsoRef.current.rotation.set(0, 0, 0);
        torsoRef.current.position.y = move.category === 'cardio' ? 0.02 * Math.sin(t * Math.PI * 4) : 0;
      }

      leftArmRef.current?.rotation.set(0, 0, 0);
      rightArmRef.current?.rotation.set(0, 0, 0);
      leftForearmRef.current?.rotation.set(0, 0, 0);
      rightForearmRef.current?.rotation.set(0, 0, 0);
      leftThighRef.current?.rotation.set(0, 0, 0);
      rightThighRef.current?.rotation.set(0, 0, 0);
      leftShinRef.current?.rotation.set(0, 0, 0);
      rightShinRef.current?.rotation.set(0, 0, 0);

      if (move.category === 'cardio') {
        const stride = move.slug === 'treadmill-jog' ? 0.72 : 0.5;
        const armSwing = move.slug === 'treadmill-jog' ? 0.62 : 0.45;

        leftThighRef.current?.rotation.set(stride * wave, 0, 0);
        rightThighRef.current?.rotation.set(-stride * wave, 0, 0);
        leftShinRef.current?.rotation.set(Math.max(0, -0.78 * wave), 0, 0);
        rightShinRef.current?.rotation.set(Math.max(0, 0.78 * wave), 0, 0);
        leftArmRef.current?.rotation.set(-armSwing * wave, 0, 0);
        rightArmRef.current?.rotation.set(armSwing * wave, 0, 0);
        leftForearmRef.current?.rotation.set(Math.abs(0.35 * wave), 0, 0);
        rightForearmRef.current?.rotation.set(Math.abs(-0.35 * wave), 0, 0);
      } else if (move.category === 'legs') {
        const bend = move.slug === 'jump-squat' ? 0.95 * half : 0.78 * half;
        leftThighRef.current?.rotation.set(-bend, 0, 0);
        rightThighRef.current?.rotation.set(-bend, 0, 0);
        leftShinRef.current?.rotation.set(bend * 0.95, 0, 0);
        rightShinRef.current?.rotation.set(bend * 0.95, 0, 0);
        leftArmRef.current?.rotation.set(0.2 * wave, 0, 0.06);
        rightArmRef.current?.rotation.set(-0.2 * wave, 0, -0.06);

        if (move.slug === 'walking-lunge') {
          leftThighRef.current?.rotation.set(-0.95 * Math.max(0, wave), 0, 0);
          rightThighRef.current?.rotation.set(0.52 * Math.max(0, -wave), 0, 0);
          leftShinRef.current?.rotation.set(0.82 * Math.max(0, wave), 0, 0);
          rightShinRef.current?.rotation.set(0.82 * Math.max(0, -wave), 0, 0);
        }

        if (move.slug === 'jump-squat' && torsoRef.current) {
          torsoRef.current.position.y += Math.max(0, Math.sin(t * Math.PI * 2 - Math.PI / 2)) * 0.25;
        }
      } else if (move.category === 'push') {
        const press = half;
        leftArmRef.current?.rotation.set(-1.05 * press, 0, 0.2);
        rightArmRef.current?.rotation.set(-1.05 * press, 0, -0.2);
        leftForearmRef.current?.rotation.set(-0.9 + 0.95 * press, 0, 0);
        rightForearmRef.current?.rotation.set(-0.9 + 0.95 * press, 0, 0);

        if (move.slug.includes('dip') && torsoRef.current) {
          torsoRef.current.rotation.x = 0.15 * press;
        }
      } else if (move.category === 'pull') {
        const row = half;
        leftArmRef.current?.rotation.set(-0.2, 0, 0.3);
        rightArmRef.current?.rotation.set(-0.2, 0, -0.3);
        leftForearmRef.current?.rotation.set(-0.2 - 1.05 * row, 0, 0);
        rightForearmRef.current?.rotation.set(-0.2 - 1.05 * row, 0, 0);
        leftThighRef.current?.rotation.set(0.06 * wave, 0, 0);
        rightThighRef.current?.rotation.set(-0.06 * wave, 0, 0);
      } else if (move.category === 'core') {
        const lift = half;
        leftThighRef.current?.rotation.set(-0.95 * lift, 0, 0);
        rightThighRef.current?.rotation.set(-0.95 * lift, 0, 0);
        leftShinRef.current?.rotation.set(0.58 * lift, 0, 0);
        rightShinRef.current?.rotation.set(0.58 * lift, 0, 0);
        leftArmRef.current?.rotation.set(-0.5, 0, 0.05);
        rightArmRef.current?.rotation.set(-0.5, 0, -0.05);
      } else if (move.category === 'mobility') {
        leftArmRef.current?.rotation.set(-0.95, 0.1 * wave, 0.28);
        rightArmRef.current?.rotation.set(-0.95, -0.1 * wave, -0.28);
        leftForearmRef.current?.rotation.set(-0.24, 0, 0);
        rightForearmRef.current?.rotation.set(-0.24, 0, 0);
        torsoRef.current?.position.set(0, 0, 0.05 * wave);
      }
    },
    [modelRotationY, modelScale, modelYOffset, move.category, move.slug],
  );

  useEffect(() => {
    if (!rootRef.current) {
      return;
    }

    const root = rootRef.current;
    const unionBox = new Box3();
    const sampleBox = new Box3();
    let hasBounds = false;

    const previousPosition = root.position.clone();
    const previousRotationY = root.rotation.y;

    for (const sample of CAMERA_FIT_SAMPLE_TIMES) {
      root.position.y = modelYOffset;
      applyMannequinPose(sample);
      root.updateWorldMatrix(true, true);

      sampleBox.setFromObject(root);
      if (sampleBox.isEmpty()) {
        continue;
      }

      if (!hasBounds) {
        unionBox.copy(sampleBox);
        hasBounds = true;
      } else {
        unionBox.union(sampleBox);
      }
    }

    root.position.copy(previousPosition);
    root.rotation.y = previousRotationY;
    root.scale.setScalar(modelScale);
    applyMannequinPose(localClockRef.current);
    root.updateWorldMatrix(true, true);

    onBoundsChange(hasBounds ? toBoundsInfo(unionBox) : computeCharacterBounds(root), 'fallback');
  }, [applyMannequinPose, modelScale, modelYOffset, move.slug, modelRotationY, onBoundsChange]);

  useFrame((_state, delta) => {
    if (!rootRef.current) {
      return;
    }

    let tNorm = forcedTNorm ?? localClockRef.current;
    if (forcedTNorm == null && playing) {
      localClockRef.current = (localClockRef.current + (delta * speed) / loopDuration) % 1;
      tNorm = localClockRef.current;
    }

    const t = ((tNorm % 1) + 1) % 1;
    applyMannequinPose(t);

    onTNorm(t);
  });

  const bodyColor = highlightTargets ? CATEGORY_HIGHLIGHT[move.category] : '#d9dde8';
  const bodyEmissive = highlightTargets ? CATEGORY_HIGHLIGHT[move.category] : '#111827';

  const meshProps = {
    castShadow: true,
    receiveShadow: true,
    visible: showMesh,
  };

  const jointMarker = (
    <mesh castShadow={false} receiveShadow={false} visible={showJoints}>
      <sphereGeometry args={[0.028, 8, 8]} />
      <meshStandardMaterial color="#7dd3fc" emissive="#7dd3fc" emissiveIntensity={0.45} />
    </mesh>
  );

  return (
    <group ref={rootRef}>
      <group ref={(instance) => (joints.current.pelvis = instance)} position={[0, 1, 0]}>
        {jointMarker}
        <group ref={torsoRef}>
          <mesh {...meshProps} position={[0, 0.26, 0]}>
            <capsuleGeometry args={[0.16, 0.48, 6, 12]} />
            <meshStandardMaterial color={bodyColor} emissive={bodyEmissive} emissiveIntensity={highlightTargets ? 0.42 : 0.08} />
          </mesh>

          <group ref={(instance) => (joints.current.chest = instance)} position={[0, 0.52, 0]}>
            {jointMarker}
            <mesh {...meshProps} position={[0, 0.12, 0]}>
              <capsuleGeometry args={[0.13, 0.24, 6, 12]} />
              <meshStandardMaterial color={bodyColor} emissive={bodyEmissive} emissiveIntensity={highlightTargets ? 0.42 : 0.08} />
            </mesh>

            <group ref={(instance) => (joints.current.head = instance)} position={[0, 0.3, 0.02]}>
              {jointMarker}
              <mesh {...meshProps}>
                <sphereGeometry args={[0.12, 18, 18]} />
                <meshStandardMaterial color="#f0e9dd" />
              </mesh>
            </group>

            <group ref={leftArmRef} position={[-0.2, 0.22, 0]}>
              <mesh {...meshProps} position={[0, -0.16, 0]}>
                <capsuleGeometry args={[0.055, 0.26, 4, 8]} />
                <meshStandardMaterial color={bodyColor} emissive={bodyEmissive} emissiveIntensity={highlightTargets ? 0.32 : 0.05} />
              </mesh>
              <group ref={(instance) => (joints.current.leftElbow = instance)} position={[0, -0.32, 0]}>
                {jointMarker}
                <group ref={leftForearmRef}>
                  <mesh {...meshProps} position={[0, -0.15, 0]}>
                    <capsuleGeometry args={[0.045, 0.25, 4, 8]} />
                    <meshStandardMaterial color={bodyColor} emissive={bodyEmissive} emissiveIntensity={highlightTargets ? 0.32 : 0.05} />
                  </mesh>
                  <group ref={(instance) => (joints.current.leftHand = instance)} position={[0, -0.3, 0]}>
                    {jointMarker}
                    <mesh {...meshProps}>
                      <sphereGeometry args={[0.05, 10, 10]} />
                      <meshStandardMaterial color={bodyColor} />
                    </mesh>
                  </group>
                </group>
              </group>
            </group>

            <group ref={rightArmRef} position={[0.2, 0.22, 0]}>
              <mesh {...meshProps} position={[0, -0.16, 0]}>
                <capsuleGeometry args={[0.055, 0.26, 4, 8]} />
                <meshStandardMaterial color={bodyColor} emissive={bodyEmissive} emissiveIntensity={highlightTargets ? 0.32 : 0.05} />
              </mesh>
              <group ref={(instance) => (joints.current.rightElbow = instance)} position={[0, -0.32, 0]}>
                {jointMarker}
                <group ref={rightForearmRef}>
                  <mesh {...meshProps} position={[0, -0.15, 0]}>
                    <capsuleGeometry args={[0.045, 0.25, 4, 8]} />
                    <meshStandardMaterial color={bodyColor} emissive={bodyEmissive} emissiveIntensity={highlightTargets ? 0.32 : 0.05} />
                  </mesh>
                  <group ref={(instance) => (joints.current.rightHand = instance)} position={[0, -0.3, 0]}>
                    {jointMarker}
                    <mesh {...meshProps}>
                      <sphereGeometry args={[0.05, 10, 10]} />
                      <meshStandardMaterial color={bodyColor} />
                    </mesh>
                  </group>
                </group>
              </group>
            </group>
          </group>

          <group ref={leftThighRef} position={[-0.1, -0.05, 0]}>
            <mesh {...meshProps} position={[0, -0.22, 0]}>
              <capsuleGeometry args={[0.07, 0.34, 5, 10]} />
              <meshStandardMaterial color={bodyColor} emissive={bodyEmissive} emissiveIntensity={highlightTargets ? 0.32 : 0.05} />
            </mesh>
            <group ref={(instance) => (joints.current.leftKnee = instance)} position={[0, -0.44, 0]}>
              {jointMarker}
              <group ref={leftShinRef}>
                <mesh {...meshProps} position={[0, -0.2, 0]}>
                  <capsuleGeometry args={[0.06, 0.3, 5, 10]} />
                  <meshStandardMaterial color={bodyColor} emissive={bodyEmissive} emissiveIntensity={highlightTargets ? 0.32 : 0.05} />
                </mesh>
                <group ref={(instance) => (joints.current.leftFoot = instance)} position={[0, -0.4, 0.05]}>
                  {jointMarker}
                  <mesh {...meshProps}>
                    <boxGeometry args={[0.11, 0.05, 0.2]} />
                    <meshStandardMaterial color={bodyColor} />
                  </mesh>
                </group>
              </group>
            </group>
          </group>

          <group ref={rightThighRef} position={[0.1, -0.05, 0]}>
            <mesh {...meshProps} position={[0, -0.22, 0]}>
              <capsuleGeometry args={[0.07, 0.34, 5, 10]} />
              <meshStandardMaterial color={bodyColor} emissive={bodyEmissive} emissiveIntensity={highlightTargets ? 0.32 : 0.05} />
            </mesh>
            <group ref={(instance) => (joints.current.rightKnee = instance)} position={[0, -0.44, 0]}>
              {jointMarker}
              <group ref={rightShinRef}>
                <mesh {...meshProps} position={[0, -0.2, 0]}>
                  <capsuleGeometry args={[0.06, 0.3, 5, 10]} />
                  <meshStandardMaterial color={bodyColor} emissive={bodyEmissive} emissiveIntensity={highlightTargets ? 0.32 : 0.05} />
                </mesh>
                <group ref={(instance) => (joints.current.rightFoot = instance)} position={[0, -0.4, 0.05]}>
                  {jointMarker}
                  <mesh {...meshProps}>
                    <boxGeometry args={[0.11, 0.05, 0.2]} />
                    <meshStandardMaterial color={bodyColor} />
                  </mesh>
                </group>
              </group>
            </group>
          </group>
        </group>
      </group>

      {showSkeleton ? (
        <group>
          <mesh position={[0, 1.3, 0]}>
            <cylinderGeometry args={[0.02, 0.02, 0.9, 8]} />
            <meshStandardMaterial color="#60a5fa" emissive="#60a5fa" emissiveIntensity={0.2} />
          </mesh>
          <mesh position={[0, 0.6, 0]}>
            <cylinderGeometry args={[0.02, 0.02, 0.75, 8]} />
            <meshStandardMaterial color="#60a5fa" emissive="#60a5fa" emissiveIntensity={0.2} />
          </mesh>
          <mesh position={[-0.2, 1.34, 0]} rotation={[0, 0, Math.PI / 2]}>
            <cylinderGeometry args={[0.015, 0.015, 0.62, 8]} />
            <meshStandardMaterial color="#60a5fa" emissive="#60a5fa" emissiveIntensity={0.2} />
          </mesh>
          <mesh position={[0.2, 1.34, 0]} rotation={[0, 0, Math.PI / 2]}>
            <cylinderGeometry args={[0.015, 0.015, 0.62, 8]} />
            <meshStandardMaterial color="#60a5fa" emissive="#60a5fa" emissiveIntensity={0.2} />
          </mesh>
          <mesh position={[-0.1, 0.55, 0]}>
            <cylinderGeometry args={[0.018, 0.018, 0.94, 8]} />
            <meshStandardMaterial color="#60a5fa" emissive="#60a5fa" emissiveIntensity={0.2} />
          </mesh>
          <mesh position={[0.1, 0.55, 0]}>
            <cylinderGeometry args={[0.018, 0.018, 0.94, 8]} />
            <meshStandardMaterial color="#60a5fa" emissive="#60a5fa" emissiveIntensity={0.2} />
          </mesh>
        </group>
      ) : null}
    </group>
  );
}

function RigCharacter({
  move,
  playing,
  speed,
  showMesh,
  showSkeleton,
  showJoints,
  highlightTargets,
  forcedTNorm,
  modelUrl,
  modelScale,
  modelRotationY,
  modelYOffset,
  modelResetKey,
  onRigState,
  onTNorm,
  onBoundsChange,
  onLoopDurationChange,
}: {
  move: ExerciseMove;
  playing: boolean;
  speed: number;
  showMesh: boolean;
  showSkeleton: boolean;
  showJoints: boolean;
  highlightTargets: boolean;
  forcedTNorm: number | null;
  modelUrl: string;
  modelScale: number;
  modelRotationY: number;
  modelYOffset: number;
  modelResetKey: string;
  onRigState: (value: RigState, failure?: RigFailureInfo) => void;
  onTNorm: (value: number) => void;
  onBoundsChange: (bounds: BoundsInfo, source: BoundsSource) => void;
  onLoopDurationChange?: (value: number) => void;
}) {
  const gltf = useGLTF(modelUrl);
  const modelScene = (gltf as unknown as GLTF).scene;
  const modelRoot = useMemo(() => clone(modelScene), [modelScene, modelResetKey]);
  const wrapperRef = useRef<Group>(null);
  const localClockRef = useRef(0);

  const animator = useMemo(() => getAnimator(move.slug, move.animatorKey), [move.slug, move.animatorKey]);
  const rig = useMemo(() => buildNormalizedRig(modelRoot), [modelRoot]);
  const rigBones = useMemo(() => (rig ? getRigBoneList(rig) : []), [rig]);
  const skeletonHelper = useMemo(() => (rig ? new SkeletonHelper(modelRoot) : null), [rig, modelRoot]);
  const cachedLocalBoxes = useMemo(() => {
    const cache = new Map<SkinnedMesh, Box3>();
    if (!rig) {
      return cache;
    }

    for (const mesh of rig.skinnedMeshes) {
      const geometry = mesh.geometry;
      if (!geometry.boundingBox) {
        geometry.computeBoundingBox();
      }

      if (geometry.boundingBox) {
        cache.set(mesh, geometry.boundingBox.clone());
      }
    }

    return cache;
  }, [rig]);

  const highlightedRef = useRef<Array<{ material: Material & { emissive?: Color; emissiveIntensity?: number }; color: Color; intensity: number }>>([]);

  useEffect(() => {
    localClockRef.current = 0;
    onLoopDurationChange?.(animator.loopDuration);
  }, [animator.loopDuration, modelResetKey, move.slug, onLoopDurationChange]);

  useEffect(() => {
    if (!rig) {
      onRigState('fallback', explainRigFailure(modelRoot));
      return;
    }

    onRigState('loaded');
  }, [rig, modelRoot, onRigState]);

  useEffect(() => {
    if (!wrapperRef.current || !rig) {
      return;
    }

    const root = wrapperRef.current;
    const groundMode = (move.groundMode ?? 'feet') as GroundMode;
    const unionBox = new Box3();
    const sampleBox = new Box3();
    const meshBox = new Box3();
    let hasBounds = false;

    const previousPosition = root.position.clone();
    const previousRotationY = root.rotation.y;
    const previousScale = root.scale.clone();

    for (const sample of CAMERA_FIT_SAMPLE_TIMES) {
      root.scale.setScalar(modelScale);
      root.position.y = modelYOffset;
      root.rotation.y = modelRotationY;

      animator.animate(rig, sample, 0, {
        move,
        groundMode,
      });

      applyGroundingOffset({
        root,
        rig,
        mode: groundMode,
        smoothing: 1,
      });

      root.updateWorldMatrix(true, true);

      sampleBox.makeEmpty();
      for (const mesh of rig.skinnedMeshes) {
        const localBox = cachedLocalBoxes.get(mesh);
        if (!localBox) {
          continue;
        }

        meshBox.copy(localBox).applyMatrix4(mesh.matrixWorld);
        sampleBox.union(meshBox);
      }

      if (sampleBox.isEmpty()) {
        continue;
      }

      if (!hasBounds) {
        unionBox.copy(sampleBox);
        hasBounds = true;
      } else {
        unionBox.union(sampleBox);
      }
    }

    root.position.copy(previousPosition);
    root.rotation.y = previousRotationY;
    root.scale.copy(previousScale);

    animator.animate(rig, 0, 0, {
      move,
      groundMode,
    });
    applyGroundingOffset({
      root,
      rig,
      mode: groundMode,
      smoothing: 1,
    });
    root.updateWorldMatrix(true, true);

    onBoundsChange(hasBounds ? toBoundsInfo(unionBox) : computeCharacterBounds(root), 'rig');
  }, [animator, cachedLocalBoxes, modelRotationY, modelScale, modelYOffset, move, onBoundsChange, rig]);

  useEffect(() => {
    if (!rig) {
      return;
    }

    rig.skinnedMeshes.forEach((mesh) => {
      mesh.visible = showMesh;
    });
  }, [rig, showMesh]);

  useEffect(() => {
    if (!rig) {
      return;
    }

    for (const item of highlightedRef.current) {
      item.material.emissive?.copy(item.color);
      if (typeof item.material.emissiveIntensity === 'number') {
        item.material.emissiveIntensity = item.intensity;
      }
    }
    highlightedRef.current = [];

    if (!highlightTargets) {
      return;
    }

    const tint = new Color(CATEGORY_HIGHLIGHT[move.category]);
    const materials = collectRenderableMaterials(modelRoot);

    materials.forEach((material) => {
      if (!material.emissive) {
        return;
      }

      highlightedRef.current.push({
        material,
        color: material.emissive.clone(),
        intensity: material.emissiveIntensity ?? 1,
      });

      material.emissive.copy(tint);
      if (typeof material.emissiveIntensity === 'number') {
        material.emissiveIntensity = Math.max(material.emissiveIntensity, 0.4);
      }
    });

    return () => {
      for (const item of highlightedRef.current) {
        item.material.emissive?.copy(item.color);
        if (typeof item.material.emissiveIntensity === 'number') {
          item.material.emissiveIntensity = item.intensity;
        }
      }
      highlightedRef.current = [];
    };
  }, [rig, highlightTargets, move.category, modelRoot]);

  useEffect(() => {
    if (!skeletonHelper) {
      return;
    }

    return () => {
      skeletonHelper.geometry.dispose();
      const materials = Array.isArray(skeletonHelper.material) ? skeletonHelper.material : [skeletonHelper.material];
      materials.forEach((material) => material.dispose());
    };
  }, [skeletonHelper]);

  useFrame((_state, delta) => {
    if (!wrapperRef.current || !rig) {
      return;
    }

    let tNorm = forcedTNorm ?? localClockRef.current;
    if (forcedTNorm == null && playing) {
      localClockRef.current = (localClockRef.current + (delta * speed) / animator.loopDuration) % 1;
      tNorm = localClockRef.current;
    }

    const normalized = ((tNorm % 1) + 1) % 1;

    wrapperRef.current.scale.setScalar(modelScale);
    wrapperRef.current.rotation.y = modelRotationY;
    wrapperRef.current.position.y = modelYOffset;

    animator.animate(rig, normalized, delta, {
      move,
      groundMode: (move.groundMode ?? 'feet') as GroundMode,
    });

    applyGroundingOffset({
      root: wrapperRef.current,
      rig,
      mode: (move.groundMode ?? 'feet') as GroundMode,
    });

    wrapperRef.current.updateWorldMatrix(true, true);
    onTNorm(normalized);
  });

  if (!rig) {
    return null;
  }

  return (
    <group ref={wrapperRef}>
      <primitive object={modelRoot} />
      {skeletonHelper ? <primitive object={skeletonHelper} visible={showSkeleton} /> : null}
      <JointMarkers bones={rigBones} visible={showJoints} color="#38bdf8" />
    </group>
  );
}

function SceneRoot({
  move,
  playing,
  speed,
  cameraPreset,
  showSkeleton,
  showMesh,
  showJoints,
  highlightTargets,
  forcedTNorm,
  modelUrl,
  modelScale,
  modelRotationY,
  modelYOffset,
  modelResetKey,
  interactive,
  quality,
  resetCameraSignal,
  onLoopDurationChange,
  onTNorm,
  onRigStateChange,
  onBoundsComputed,
}: {
  move: ExerciseMove;
  playing: boolean;
  speed: number;
  cameraPreset: CameraPreset;
  showSkeleton: boolean;
  showMesh: boolean;
  showJoints: boolean;
  highlightTargets: boolean;
  forcedTNorm: number | null;
  modelUrl: string;
  modelScale: number;
  modelRotationY: number;
  modelYOffset: number;
  modelResetKey: string;
  interactive: boolean;
  quality: 'high' | 'low';
  resetCameraSignal: number;
  onLoopDurationChange?: (value: number) => void;
  onTNorm: (value: number) => void;
  onRigStateChange: (state: RigState, reason?: string, debug?: RigFailureInfo | null) => void;
  onBoundsComputed?: (bounds: BoundsInfo, source: BoundsSource) => void;
}) {
  const [rigState, setRigState] = useState<RigState>('loading');
  const [bounds, setBounds] = useState<BoundsInfo>(DEFAULT_BOUNDS);

  useEffect(() => {
    setRigState('loading');
  }, [modelUrl, move.slug]);

  const handleRigState = useCallback(
    (value: RigState, failure?: RigFailureInfo) => {
      setRigState(value);
      if (value === 'loaded') {
        onRigStateChange('loaded', undefined, null);
      }
      if (value === 'fallback') {
        if (failure) {
          const missingText = failure.missing.length ? failure.missing.join(', ') : 'unknown';
          const rigTypeText =
            failure.detectedRigType === 'mixamo'
              ? 'Detected rig: Mixamo'
              : failure.detectedRigType === 'custom'
                ? 'Detected rig: custom'
                : 'Detected rig: unknown';
          onRigStateChange(
            'fallback',
            `Fallback mannequin: rig mapping failed. Missing bones: ${missingText}. Bone count: ${failure.boneCount}. ${rigTypeText}. (Open debug for names)`,
            failure,
          );
          return;
        }

        onRigStateChange('fallback', 'Fallback mannequin: rig mapping failed.', null);
      }
    },
    [onRigStateChange],
  );

  const handleModelError = useCallback(
    (error: Error) => {
      setRigState('fallback');
      onRigStateChange('fallback', error.message, null);
    },
    [onRigStateChange],
  );

  const handleBoundsChange = useCallback(
    (nextBounds: BoundsInfo, source: BoundsSource) => {
      setBounds(nextBounds);
      onBoundsComputed?.(nextBounds, source);
    },
    [onBoundsComputed],
  );

  return (
    <>
      <color attach="background" args={[quality === 'high' ? '#f6fbff' : '#f8fafc']} />
      <fog attach="fog" args={['#eaf1f9', 6.5, 15]} />

      <ambientLight intensity={0.45} />
      <directionalLight
        position={[4, 6.5, 4]}
        intensity={1.05}
        castShadow
        shadow-mapSize-width={2048}
        shadow-mapSize-height={2048}
        shadow-bias={-0.00018}
      />
      <directionalLight position={[-3, 3, 2]} intensity={0.45} />
      <directionalLight position={[0, 3, -4]} intensity={0.35} />

      <Environment preset={quality === 'high' ? 'warehouse' : 'city'} blur={0.6} />

      <Suspense fallback={null}>
        <ModelErrorBoundary resetKey={modelResetKey} onError={handleModelError}>
          <RigCharacter
            move={move}
            playing={playing}
            speed={speed}
            showMesh={showMesh}
            showSkeleton={showSkeleton}
            showJoints={showJoints}
            highlightTargets={highlightTargets}
            forcedTNorm={forcedTNorm}
            modelUrl={modelUrl}
            modelScale={modelScale}
            modelRotationY={modelRotationY}
            modelYOffset={modelYOffset}
            modelResetKey={modelResetKey}
            onRigState={handleRigState}
            onTNorm={onTNorm}
            onBoundsChange={handleBoundsChange}
            onLoopDurationChange={onLoopDurationChange}
          />
        </ModelErrorBoundary>
      </Suspense>

      {rigState === 'fallback' ? (
        <FallbackMannequin
          move={move}
          playing={playing}
          speed={speed}
          showMesh={showMesh}
          showJoints={showJoints}
          showSkeleton={showSkeleton}
          highlightTargets={highlightTargets}
          forcedTNorm={forcedTNorm}
          modelScale={modelScale}
          modelRotationY={modelRotationY}
          modelYOffset={modelYOffset}
          onLoopDurationChange={onLoopDurationChange}
          onTNorm={onTNorm}
          onBoundsChange={handleBoundsChange}
        />
      ) : null}

      {highlightTargets ? <TargetMuscleOverlays move={move} bounds={bounds} /> : null}

      <mesh position={[0, -0.002, 0]} rotation={[-Math.PI / 2, 0, 0]} receiveShadow>
        <circleGeometry args={[4.4, 64]} />
        <meshStandardMaterial color="#dbe8f7" roughness={0.92} metalness={0.02} />
      </mesh>

      <ContactShadows
        position={[0, 0.001, 0]}
        opacity={0.35}
        scale={6}
        blur={2.4}
        far={3.4}
        resolution={quality === 'high' ? 1024 : 512}
        color="#99acc4"
      />

      <TrainerCamera bounds={bounds} preset={cameraPreset} interactive={interactive} resetSignal={resetCameraSignal} />
    </>
  );
}

export default function Viewer3D({
  move,
  playing,
  speed,
  cameraPreset,
  showSkeleton,
  showMesh,
  showJoints,
  highlightTargets,
  modelUrl,
  modelScale = 1,
  modelRotationY = 0,
  modelYOffset = 0,
  flipFacing = false,
  characterName,
  globalRotationY = 0,
  forcedTNorm = null,
  quality = 'high',
  interactive = true,
  className,
  onRepChange,
  onPhaseChange,
  onLoopDurationChange,
  onCanvasReady,
  onModelMetrics,
}: Viewer3DProps) {
  const [rigState, setRigState] = useState<RigState>('loading');
  const [fallbackReason, setFallbackReason] = useState<string | null>(null);
  const [fallbackDebug, setFallbackDebug] = useState<RigFailureInfo | null>(null);
  const [resetCameraSignal, setResetCameraSignal] = useState(0);

  const previousTNormRef = useRef(0);
  const repRef = useRef(0);
  const phaseRef = useRef('');

  const composedRotationY =
    modelRotationY + (flipFacing ? Math.PI : 0) + (move.modelRotationY ?? 0) + globalRotationY;
  const modelResetKey = `${modelUrl}:${move.slug}`;

  useEffect(() => {
    repRef.current = 0;
    previousTNormRef.current = 0;
    phaseRef.current = '';
    onRepChange?.(0);

    const initialPhase = getPhaseLabel(move, 0);
    onPhaseChange?.(initialPhase);
    phaseRef.current = initialPhase;

    setRigState('loading');
    setFallbackReason(null);
    setFallbackDebug(null);
  }, [modelUrl, move.slug, onRepChange, onPhaseChange, move]);

  const onTNorm = useCallback(
    (tNorm: number) => {
      if (playing && forcedTNorm == null && previousTNormRef.current > 0.85 && tNorm < 0.15) {
        repRef.current += 1;
        onRepChange?.(repRef.current);
      }

      const phase = getPhaseLabel(move, tNorm);
      if (phase && phase !== phaseRef.current) {
        phaseRef.current = phase;
        onPhaseChange?.(phase);
      }

      previousTNormRef.current = tNorm;
    },
    [forcedTNorm, move, onPhaseChange, onRepChange, playing],
  );

  const handleBoundsComputed = useCallback(
    (bounds: BoundsInfo, source: BoundsSource) => {
      onModelMetrics?.({
        height: bounds.size.y,
        minY: bounds.box.min.y,
        maxY: bounds.box.max.y,
        width: bounds.size.x,
        depth: bounds.size.z,
        centerY: bounds.center.y,
        source,
      });
    },
    [onModelMetrics],
  );

  useEffect(() => {
    return () => {
      onCanvasReady?.(null);
    };
  }, [onCanvasReady]);

  const statusText =
    rigState === 'loaded'
      ? `Rig loaded: ${characterName ?? 'Character'}`
      : rigState === 'fallback'
        ? 'Fallback mannequin (missing model or unmapped rig)'
        : 'Loading rig...';

  return (
    <div className={`relative overflow-hidden rounded-2xl border border-slate-200 bg-white ${className ?? ''}`}>
      <Canvas
        dpr={quality === 'high' ? [1, 2] : [1, 1.25]}
        shadows
        camera={{ position: [2.5, 1.5, 2.5], fov: 42, near: 0.1, far: 80 }}
        onCreated={({ gl }) => {
          gl.setClearColor('#f6fbff');
          gl.shadowMap.enabled = true;
          gl.shadowMap.autoUpdate = true;
          gl.outputColorSpace = 'srgb';
          onCanvasReady?.(gl.domElement);
        }}
      >
        <SceneRoot
          move={move}
          playing={playing}
          speed={speed}
          cameraPreset={cameraPreset}
          showSkeleton={showSkeleton}
          showMesh={showMesh}
          showJoints={showJoints}
          highlightTargets={highlightTargets}
          forcedTNorm={forcedTNorm}
          modelUrl={modelUrl}
          modelScale={modelScale}
          modelRotationY={composedRotationY}
          modelYOffset={modelYOffset}
          modelResetKey={modelResetKey}
          interactive={interactive}
          quality={quality}
          resetCameraSignal={resetCameraSignal}
          onLoopDurationChange={onLoopDurationChange}
          onTNorm={onTNorm}
          onRigStateChange={(state, reason, debug) => {
            setRigState(state);
            setFallbackReason(reason ?? null);
            setFallbackDebug(debug ?? null);
          }}
          onBoundsComputed={handleBoundsComputed}
        />
      </Canvas>

      <div className="absolute left-3 top-3 flex items-center gap-2">
        <span
          className={`rounded-lg border px-2.5 py-1 text-[11px] font-semibold ${
            rigState === 'loaded'
              ? 'border-emerald-200 bg-emerald-50 text-emerald-700'
              : rigState === 'fallback'
                ? 'border-amber-200 bg-amber-50 text-amber-700'
                : 'border-slate-200 bg-white/90 text-slate-600'
          }`}
        >
          {statusText}
        </span>
      </div>

      <div className="absolute right-3 top-3">
        <button
          type="button"
          onClick={() => setResetCameraSignal((value) => value + 1)}
          className="rounded-lg border border-slate-200 bg-white/95 px-2.5 py-1 text-xs font-semibold text-slate-700 shadow-sm transition hover:border-slate-300"
        >
          Reset Camera
        </button>
      </div>

      {rigState === 'fallback' && interactive && fallbackDebug ? (
        <details className="absolute bottom-3 right-3 z-10 w-[min(420px,calc(100%-1.5rem))] rounded-lg border border-slate-200 bg-white/95 p-2 text-xs text-slate-700 shadow-sm">
          <summary className="cursor-pointer font-semibold text-slate-800">Open debug for names</summary>
          <div className="mt-2 space-y-1">
            <p>
              <span className="font-semibold">Detected:</span>{' '}
              {fallbackDebug.detectedRigType === 'mixamo'
                ? 'Mixamo rig'
                : fallbackDebug.detectedRigType === 'custom'
                  ? 'Custom rig'
                  : 'Unknown rig'}
            </p>
            <p>
              <span className="font-semibold">Bone count:</span> {fallbackDebug.boneCount}
            </p>
            <p>
              <span className="font-semibold">Missing:</span>{' '}
              {fallbackDebug.missing.length ? fallbackDebug.missing.join(', ') : 'none'}
            </p>
            <p>
              <span className="font-semibold">Found:</span>{' '}
              {fallbackDebug.found.length ? fallbackDebug.found.join(', ') : 'none'}
            </p>
            <pre className="max-h-40 overflow-auto rounded border border-slate-200 bg-slate-50 p-2 text-[11px] leading-relaxed text-slate-700">
              {fallbackDebug.sampleNames.join('\n') || '(no bone names available)'}
            </pre>
          </div>
        </details>
      ) : null}

      {fallbackReason ? (
        <div className="pointer-events-none absolute bottom-3 left-3 right-3 rounded-lg border border-amber-200 bg-amber-50/95 px-3 py-2 text-xs text-amber-800">
          {fallbackReason}
        </div>
      ) : null}
    </div>
  );
}

for (const character of CHARACTERS) {
  useGLTF.preload(character.url);
}
