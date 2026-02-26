import {
  AnimationAction,
  AnimationClip,
  AnimationMixer,
  LoopRepeat,
  Object3D,
  SkinnedMesh,
  type Material,
  type Mesh,
} from 'three';
import type { GLTF } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { clone } from 'three/examples/jsm/utils/SkeletonUtils.js';
import type { ExerciseMove } from '../data/moves';

export type AnimationStrategy = 'single-model-clips' | 'per-move-glb';

export type AnimationAssetPaths = {
  strategy: AnimationStrategy;
  modelPath: string;
  animationPath?: string;
};

export const animationConfig = {
  strategy: (import.meta.env.VITE_ANIMATION_STRATEGY as AnimationStrategy | undefined) ?? 'single-model-clips',
  baseModelPath: import.meta.env.VITE_BASE_MODEL_PATH ?? '/models/humanoid.glb',
  clipLibraryPath: import.meta.env.VITE_CLIP_LIBRARY_PATH,
  perMovePathTemplate: import.meta.env.VITE_PER_MOVE_TEMPLATE ?? '/anims/{slug}.glb',
};

const gltfLoader = new GLTFLoader();
const gltfPromiseCache = new Map<string, Promise<GLTF>>();

function normalizeName(value: string) {
  return value.trim().toLowerCase().replace(/_/g, '-');
}

function buildPerMovePath(slug: string) {
  return animationConfig.perMovePathTemplate.replace('{slug}', slug);
}

export function getAnimationAssetPaths(slug: string): AnimationAssetPaths {
  if (animationConfig.strategy === 'per-move-glb') {
    return {
      strategy: 'per-move-glb',
      modelPath: buildPerMovePath(slug),
    };
  }

  return {
    strategy: 'single-model-clips',
    modelPath: animationConfig.baseModelPath,
    animationPath: animationConfig.clipLibraryPath || animationConfig.baseModelPath,
  };
}

export function loadGLTF(path: string): Promise<GLTF> {
  const cached = gltfPromiseCache.get(path);
  if (cached) {
    return cached;
  }

  const promise = new Promise<GLTF>((resolve, reject) => {
    gltfLoader.load(path, resolve, undefined, reject);
  });

  gltfPromiseCache.set(path, promise);
  return promise;
}

export async function loadMoveModelAndClips(move: ExerciseMove): Promise<{
  root: Object3D;
  clips: AnimationClip[];
  paths: AnimationAssetPaths;
}> {
  const paths = getAnimationAssetPaths(move.slug);
  const model = await loadGLTF(paths.modelPath);

  let clipSource = model;
  if (paths.animationPath && paths.animationPath !== paths.modelPath) {
    clipSource = await loadGLTF(paths.animationPath);
  }

  const root = clone(model.scene);
  const clips = [
    ...model.animations,
    ...clipSource.animations.filter(
      (clip) => !model.animations.find((existing) => normalizeName(existing.name) === normalizeName(clip.name)),
    ),
  ];

  return {
    root,
    clips,
    paths,
  };
}

export function selectAnimationClip(move: ExerciseMove, clips: AnimationClip[]) {
  if (clips.length === 0) {
    return null;
  }

  const candidates = [move.animationName, move.slug, move.title]
    .filter(Boolean)
    .map((value) => normalizeName(value));

  for (const candidate of candidates) {
    const exact = clips.find((clip) => normalizeName(clip.name) === candidate);
    if (exact) {
      return exact;
    }

    const contains = clips.find((clip) => normalizeName(clip.name).includes(candidate));
    if (contains) {
      return contains;
    }
  }

  return clips[0];
}

export function createLoopedAction(
  mixer: AnimationMixer,
  root: Object3D,
  clip: AnimationClip,
  fadeSeconds = 0.22,
): AnimationAction {
  const action = mixer.clipAction(clip, root);
  action.enabled = true;
  action.clampWhenFinished = false;
  action.setLoop(LoopRepeat, Infinity);
  action.reset();
  action.fadeIn(fadeSeconds);
  action.play();
  return action;
}

export function crossFadeActions(fromAction: AnimationAction | null, toAction: AnimationAction, fadeSeconds = 0.22) {
  if (fromAction && fromAction !== toAction) {
    fromAction.crossFadeTo(toAction, fadeSeconds, false);
  }
}

export function setActionSpeed(action: AnimationAction | null, speed: number) {
  if (!action) {
    return;
  }
  action.timeScale = speed;
}

export function getClipProgress(action: AnimationAction | null) {
  if (!action) {
    return 0;
  }
  const duration = Math.max(action.getClip().duration, 0.001);
  const t = ((action.time % duration) + duration) % duration;
  return t / duration;
}

export function getClipDuration(action: AnimationAction | null) {
  if (!action) {
    return 1;
  }
  return Math.max(action.getClip().duration, 0.001);
}

function isRenderableMesh(object: Object3D): object is Mesh | SkinnedMesh {
  return (object as Mesh).isMesh === true || (object as SkinnedMesh).isSkinnedMesh === true;
}

export function setMeshVisibility(root: Object3D, visible: boolean) {
  root.traverse((object) => {
    if (isRenderableMesh(object)) {
      object.visible = visible;
    }
  });
}

export type EmissiveBackup = {
  material: Material;
  emissiveHex?: number;
  emissiveIntensity?: number;
};

export function getRenderableMaterials(root: Object3D): Material[] {
  const materials: Material[] = [];
  root.traverse((object) => {
    if (!isRenderableMesh(object)) {
      return;
    }

    if (Array.isArray(object.material)) {
      for (const material of object.material) {
        materials.push(material);
      }
    } else if (object.material) {
      materials.push(object.material);
    }
  });
  return materials;
}
